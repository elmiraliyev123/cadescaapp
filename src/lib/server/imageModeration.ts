import "server-only";

export type ImageModerationSource = "avatar" | "post";

type ImageModerationProvider = "cloudflare_worker" | "workers_ai_rest" | "none";

type ModerationDecision = {
  allowed: boolean;
  reason?: string;
  labels?: string[];
};

type ProviderResult = {
  provider: ImageModerationProvider;
  httpStatus?: number;
  decision: ModerationDecision | null;
};

class ImageModerationProviderError extends Error {
  provider: ImageModerationProvider;
  httpStatus?: number;

  constructor(provider: ImageModerationProvider, message: string, httpStatus?: number) {
    super(message);
    this.name = "ImageModerationProviderError";
    this.provider = provider;
    this.httpStatus = httpStatus;
  }
}

const BLOCKED_LABEL_PATTERNS = [
  /adult/i,
  /blood/i,
  /corpse/i,
  /explicit/i,
  /gore/i,
  /gun/i,
  /knife/i,
  /naked/i,
  /nudity/i,
  /porn/i,
  /sexual/i,
  /weapon/i,
  /violence/i,
  /violent/i
];

const IMAGE_EXTENSION_PATTERN = /\.(avif|gif|heic|heif|jpe?g|png|webp)$/i;
const DEFAULT_TIMEOUT_MS = 10_000;

function moderationRequired() {
  return process.env.CLOUDFLARE_IMAGE_MODERATION_REQUIRED === "true";
}

function moderationTimeoutMs() {
  const configured = Number(process.env.CLOUDFLARE_IMAGE_MODERATION_TIMEOUT_MS);
  return Number.isFinite(configured) && configured > 0 ? configured : DEFAULT_TIMEOUT_MS;
}

function fileToBase64(bytes: Uint8Array) {
  return Buffer.from(bytes).toString("base64");
}

function labelIsBlocked(label: string) {
  return BLOCKED_LABEL_PATTERNS.some((pattern) => pattern.test(label));
}

function blockedCategory(decision: ModerationDecision) {
  return decision.labels?.find(labelIsBlocked) || decision.reason || "policy";
}

function normalizeDecision(value: unknown): ModerationDecision | null {
  if (!value || typeof value !== "object") return null;
  const record = value as Record<string, unknown>;
  const labels = Array.isArray(record.labels)
    ? record.labels.map((label) => String(label)).filter(Boolean)
    : [];

  if (typeof record.allowed === "boolean") {
    return {
      allowed: record.allowed,
      reason: typeof record.reason === "string" ? record.reason : undefined,
      labels
    };
  }

  if (typeof record.safe === "boolean") {
    return {
      allowed: record.safe,
      reason: typeof record.reason === "string" ? record.reason : undefined,
      labels
    };
  }

  if (typeof record.block === "boolean") {
    return {
      allowed: !record.block,
      reason: typeof record.reason === "string" ? record.reason : undefined,
      labels
    };
  }

  return labels.length ? { allowed: !labels.some(labelIsBlocked), labels } : null;
}

function extractJsonObject(value: string) {
  const trimmed = value.trim();
  const start = trimmed.indexOf("{");
  const end = trimmed.lastIndexOf("}");
  if (start === -1 || end === -1 || end <= start) return null;

  try {
    return JSON.parse(trimmed.slice(start, end + 1));
  } catch {
    return null;
  }
}

function isLikelyImageFile(file: File, bytes: Uint8Array) {
  if (!bytes.length) return false;
  const contentType = (file.type || "").toLowerCase();
  return contentType.startsWith("image/") || IMAGE_EXTENSION_PATTERN.test(file.name || "");
}

function providerErrorDetails(error: unknown) {
  if (error instanceof ImageModerationProviderError) {
    return {
      provider: error.provider,
      httpStatus: error.httpStatus,
      reason: error.message
    };
  }

  return {
    provider: "none" as const,
    reason: error instanceof Error ? error.message : "unknown"
  };
}

function logModeration(
  level: "info" | "warn" | "error",
  event: string,
  details: {
    source: ImageModerationSource;
    provider: ImageModerationProvider;
    enabled: boolean;
    required: boolean;
    allowed?: boolean;
    reason?: string;
    category?: string;
    labels?: string[];
    httpStatus?: number;
  }
) {
  const payload = {
    event,
    source: details.source,
    provider: details.provider,
    enabled: details.enabled,
    required: details.required,
    allowed: details.allowed,
    reason: details.reason,
    category: details.category,
    labels: details.labels,
    httpStatus: details.httpStatus
  };

  if (level === "error") {
    console.error("[image_moderation]", payload);
    return;
  }

  if (level === "warn") {
    console.warn("[image_moderation]", payload);
    return;
  }

  console.info("[image_moderation]", payload);
}

async function fetchModeration(provider: ImageModerationProvider, url: string, init: RequestInit) {
  try {
    return await fetch(url, {
      ...init,
      signal: AbortSignal.timeout(moderationTimeoutMs())
    });
  } catch (error) {
    throw new ImageModerationProviderError(
      provider,
      error instanceof Error ? error.message : "request_failed"
    );
  }
}

async function moderateWithCloudflareWorker(input: {
  bytes: Uint8Array;
  contentType: string;
  filename: string;
  source: ImageModerationSource;
}): Promise<ProviderResult | null> {
  const endpoint = process.env.CLOUDFLARE_IMAGE_MODERATION_URL?.trim();
  if (!endpoint) return null;

  const provider = "cloudflare_worker";
  const token = process.env.CLOUDFLARE_IMAGE_MODERATION_TOKEN?.trim();
  const response = await fetchModeration(provider, endpoint, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      ...(token ? { authorization: `Bearer ${token}` } : {})
    },
    body: JSON.stringify({
      filename: input.filename,
      contentType: input.contentType,
      source: input.source,
      imageBase64: fileToBase64(input.bytes)
    })
  });

  if (!response.ok) {
    throw new ImageModerationProviderError(provider, "cloudflare_http_error", response.status);
  }

  const payload = await response.json().catch(() => null);
  return {
    provider,
    httpStatus: response.status,
    decision: normalizeDecision(payload)
  };
}

async function moderateWithWorkersAiRest(input: {
  bytes: Uint8Array;
  contentType: string;
  source: ImageModerationSource;
}): Promise<ProviderResult | null> {
  const accountId = process.env.CLOUDFLARE_ACCOUNT_ID?.trim();
  const token = process.env.CLOUDFLARE_API_TOKEN?.trim() || process.env.CLOUDFLARE_AUTH_TOKEN?.trim();
  if (!accountId || !token) return null;

  const provider = "workers_ai_rest";
  const model = process.env.CLOUDFLARE_IMAGE_MODERATION_MODEL?.trim() || "@cf/meta/llama-3.2-11b-vision-instruct";
  const response = await fetchModeration(provider, `https://api.cloudflare.com/client/v4/accounts/${accountId}/ai/run/${model}`, {
    method: "POST",
    headers: {
      authorization: `Bearer ${token}`,
      "content-type": "application/json"
    },
    body: JSON.stringify({
      image: Array.from(input.bytes),
      max_tokens: 180,
      temperature: 0,
      prompt:
        "Classify this image for a university social app. Return only compact JSON: " +
        "{\"allowed\":boolean,\"reason\":string,\"labels\":string[]}. " +
        "Set allowed=false for pornographic, sexually explicit, nude, violent, weapon, blood, gore, self-harm, or graphic content."
    })
  });

  if (!response.ok) {
    throw new ImageModerationProviderError(provider, "cloudflare_http_error", response.status);
  }

  const payload = await response.json().catch(() => null) as { result?: { response?: string }; success?: boolean } | null;
  const rawResponse = payload?.result?.response;
  if (!payload?.success || typeof rawResponse !== "string") {
    throw new ImageModerationProviderError(provider, "cloudflare_invalid_response", response.status);
  }

  return {
    provider,
    httpStatus: response.status,
    decision: normalizeDecision(extractJsonObject(rawResponse))
  };
}

async function runConfiguredProvider(input: {
  bytes: Uint8Array;
  contentType: string;
  filename: string;
  source: ImageModerationSource;
}) {
  return (
    await moderateWithCloudflareWorker(input) ||
    await moderateWithWorkersAiRest(input)
  );
}

export async function assertImageAllowed(file: File, source: ImageModerationSource) {
  const required = moderationRequired();
  let bytes: Uint8Array;

  try {
    bytes = new Uint8Array(await file.arrayBuffer());
  } catch (error) {
    logModeration("error", "read_failed", {
      source,
      provider: "none",
      enabled: false,
      required,
      allowed: false,
      reason: error instanceof Error ? error.message : "unknown"
    });
    throw new Error("image_moderation_failed");
  }

  if (!isLikelyImageFile(file, bytes)) {
    logModeration("warn", "invalid_input", {
      source,
      provider: "none",
      enabled: false,
      required,
      allowed: false,
      reason: "invalid_image_input"
    });
    throw new Error("image_moderation_invalid_input");
  }

  let result: ProviderResult | null = null;

  try {
    result = await runConfiguredProvider({
      bytes,
      contentType: file.type || "application/octet-stream",
      filename: file.name || "upload",
      source
    });
  } catch (error) {
    const details = providerErrorDetails(error);
    logModeration("error", "provider_error", {
      source,
      provider: details.provider,
      enabled: details.provider !== "none",
      required,
      allowed: false,
      reason: details.reason,
      httpStatus: details.httpStatus
    });

    if (required) {
      throw new Error("image_moderation_failed");
    }
    return;
  }

  if (!result) {
    logModeration("info", "disabled", {
      source,
      provider: "none",
      enabled: false,
      required,
      allowed: !required,
      reason: "no_provider_configured"
    });

    if (required) {
      throw new Error("image_moderation_failed");
    }
    return;
  }

  if (!result.decision) {
    logModeration(required ? "error" : "warn", "no_decision", {
      source,
      provider: result.provider,
      enabled: true,
      required,
      allowed: !required,
      reason: "no_parseable_decision",
      httpStatus: result.httpStatus
    });

    if (required) {
      throw new Error("image_moderation_failed");
    }
    return;
  }

  const category = blockedCategory(result.decision);
  const blocked = !result.decision.allowed || result.decision.labels?.some(labelIsBlocked);

  logModeration(blocked ? "warn" : "info", "provider_decision", {
    source,
    provider: result.provider,
    enabled: true,
    required,
    allowed: !blocked,
    reason: result.decision.reason || (blocked ? "policy" : "safe"),
    category,
    labels: result.decision.labels || [],
    httpStatus: result.httpStatus
  });

  if (blocked) {
    throw new Error("image_rejected");
  }
}
