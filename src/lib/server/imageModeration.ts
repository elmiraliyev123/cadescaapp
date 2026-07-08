import "server-only";

export type ImageModerationSource = "avatar" | "post";

type ModerationDecision = {
  allowed: boolean;
  reason?: string;
  labels?: string[];
};

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

function fileToBase64(bytes: Uint8Array) {
  let binary = "";
  const chunkSize = 0x8000;
  for (let index = 0; index < bytes.length; index += chunkSize) {
    binary += String.fromCharCode(...bytes.subarray(index, index + chunkSize));
  }
  return btoa(binary);
}

function labelIsBlocked(label: string) {
  return BLOCKED_LABEL_PATTERNS.some((pattern) => pattern.test(label));
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

async function moderateWithCloudflareWorker(input: {
  bytes: Uint8Array;
  contentType: string;
  filename: string;
  source: ImageModerationSource;
}) {
  const endpoint = process.env.CLOUDFLARE_IMAGE_MODERATION_URL?.trim();
  if (!endpoint) return null;

  const token = process.env.CLOUDFLARE_IMAGE_MODERATION_TOKEN?.trim();
  const response = await fetch(endpoint, {
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
    throw new Error("image_moderation_unavailable");
  }

  return normalizeDecision(await response.json().catch(() => null));
}

async function moderateWithWorkersAiRest(input: {
  bytes: Uint8Array;
  contentType: string;
  source: ImageModerationSource;
}) {
  const accountId = process.env.CLOUDFLARE_ACCOUNT_ID?.trim();
  const token = process.env.CLOUDFLARE_API_TOKEN?.trim() || process.env.CLOUDFLARE_AUTH_TOKEN?.trim();
  if (!accountId || !token) return null;

  const model = process.env.CLOUDFLARE_IMAGE_MODERATION_MODEL?.trim() || "@cf/meta/llama-3.2-11b-vision-instruct";
  const response = await fetch(`https://api.cloudflare.com/client/v4/accounts/${accountId}/ai/run/${model}`, {
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
    throw new Error("image_moderation_unavailable");
  }

  const payload = await response.json().catch(() => null) as { result?: { response?: string }; success?: boolean } | null;
  const rawResponse = payload?.result?.response;
  if (!payload?.success || typeof rawResponse !== "string") {
    throw new Error("image_moderation_unavailable");
  }

  return normalizeDecision(extractJsonObject(rawResponse));
}

export async function assertImageAllowed(file: File, source: ImageModerationSource) {
  const bytes = new Uint8Array(await file.arrayBuffer());
  let decision: ModerationDecision | null = null;

  try {
    decision =
      await moderateWithCloudflareWorker({
        bytes,
        contentType: file.type || "application/octet-stream",
        filename: file.name || "upload",
        source
      }) ||
      await moderateWithWorkersAiRest({
        bytes,
        contentType: file.type || "application/octet-stream",
        source
      });
  } catch (error) {
    console.error("[image_moderation] failed", {
      source,
      reason: error instanceof Error ? error.message : "unknown"
    });
    if (process.env.CLOUDFLARE_IMAGE_MODERATION_REQUIRED === "true") {
      throw new Error("image_moderation_failed");
    }
    return;
  }

  if (!decision) {
    if (process.env.CLOUDFLARE_IMAGE_MODERATION_REQUIRED === "true") {
      throw new Error("image_moderation_failed");
    }
    return;
  }

  if (!decision.allowed || decision.labels?.some(labelIsBlocked)) {
    console.warn("[image_moderation] blocked", {
      source,
      reason: decision.reason || "policy",
      labels: decision.labels || []
    });
    throw new Error("image_rejected");
  }
}
