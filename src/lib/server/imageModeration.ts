import "server-only";

export type ImageModerationSource = "avatar" | "post" | "club_logo" | "event_cover";

type ImageModerationProvider = "cloudflare_worker" | "workers_ai_rest" | "none";
type CloudflareFailureKind =
  | "authentication_failed"
  | "cloudflare_http_error"
  | "image_format_unsupported"
  | "invalid_payload"
  | "license_acceptance_required"
  | "model_unavailable"
  | "parsing_error"
  | "timeout";

type ModerationDecision = {
  allowed: boolean;
  reason?: string;
  labels?: string[];
};

type ProviderResult = {
  provider: ImageModerationProvider;
  httpStatus?: number;
  decision: ModerationDecision | null;
  requestUrl?: string;
  model?: string;
  responseBody?: string;
  parsedJson?: unknown;
  cloudflareErrorCodes?: string[];
  failureKind?: CloudflareFailureKind;
};

class ImageModerationProviderError extends Error {
  provider: ImageModerationProvider;
  httpStatus?: number;
  requestUrl?: string;
  model?: string;
  responseBody?: string;
  parsedJson?: unknown;
  cloudflareErrorCodes?: string[];
  failureKind?: CloudflareFailureKind;

  constructor(
    provider: ImageModerationProvider,
    message: string,
    details: Omit<ProviderResult, "provider" | "decision"> = {}
  ) {
    super(message);
    this.name = "ImageModerationProviderError";
    this.provider = provider;
    this.httpStatus = details.httpStatus;
    this.requestUrl = details.requestUrl;
    this.model = details.model;
    this.responseBody = details.responseBody;
    this.parsedJson = details.parsedJson;
    this.cloudflareErrorCodes = details.cloudflareErrorCodes;
    this.failureKind = details.failureKind;
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
const LLAMA_VISION_MODEL = "@cf/meta/llama-3.2-11b-vision-instruct";
const SUPPORTED_IMAGE_CONTENT_TYPES = new Set([
  "image/avif",
  "image/gif",
  "image/heic",
  "image/heif",
  "image/jpeg",
  "image/jpg",
  "image/png",
  "image/webp"
]);
const CONTENT_TYPE_BY_EXTENSION: Record<string, string> = {
  avif: "image/avif",
  gif: "image/gif",
  heic: "image/heic",
  heif: "image/heif",
  jpeg: "image/jpeg",
  jpg: "image/jpeg",
  png: "image/png",
  webp: "image/webp"
};
const llamaLicenseAgreementCache = new Set<string>();

function moderationRequired(source?: ImageModerationSource) {
  if (process.env.CLOUDFLARE_IMAGE_MODERATION_REQUIRED === "true") return true;
  return process.env.NODE_ENV === "production" && (source === "event_cover" || source === "club_logo");
}

function moderationTimeoutMs() {
  const configured = Number(process.env.CLOUDFLARE_IMAGE_MODERATION_TIMEOUT_MS);
  return Number.isFinite(configured) && configured > 0 ? configured : DEFAULT_TIMEOUT_MS;
}

function fileToBase64(bytes: Uint8Array) {
  return Buffer.from(bytes).toString("base64");
}

function normalizeDeclaredContentType(contentType: string) {
  const normalized = contentType.split(";")[0]?.trim().toLowerCase();
  if (normalized === "image/jpg") return "image/jpeg";
  return normalized || null;
}

function imageContentTypeFromName(name: string) {
  const extension = name.split(".").pop()?.toLowerCase();
  return extension ? CONTENT_TYPE_BY_EXTENSION[extension] || null : null;
}

function imageContentTypeFromMagic(bytes: Uint8Array) {
  if (bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) return "image/jpeg";
  if (bytes.length >= 8 && bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4e && bytes[3] === 0x47) return "image/png";
  if (bytes.length >= 6) {
    const header = Buffer.from(bytes.subarray(0, 6)).toString("ascii");
    if (header === "GIF87a" || header === "GIF89a") return "image/gif";
  }
  if (bytes.length >= 12) {
    const riff = Buffer.from(bytes.subarray(0, 4)).toString("ascii");
    const webp = Buffer.from(bytes.subarray(8, 12)).toString("ascii");
    if (riff === "RIFF" && webp === "WEBP") return "image/webp";
  }
  if (bytes.length >= 12) {
    const boxType = Buffer.from(bytes.subarray(4, 8)).toString("ascii");
    const brand = Buffer.from(bytes.subarray(8, 12)).toString("ascii").toLowerCase();
    if (boxType === "ftyp") {
      if (brand === "avif" || brand === "avis") return "image/avif";
      if (["heic", "heix", "hevc", "hevx", "heim", "heis", "mif1", "msf1"].includes(brand)) return "image/heic";
    }
  }

  return null;
}

function normalizeImageContentType(file: File, bytes: Uint8Array) {
  const declared = normalizeDeclaredContentType(file.type || "");
  const fromName = imageContentTypeFromName(file.name || "");
  const magic = imageContentTypeFromMagic(bytes);
  if (!magic) return null;
  const canonical = (value: string | null) => value === "image/heif" ? "image/heic" : value;
  if (declared && (!SUPPORTED_IMAGE_CONTENT_TYPES.has(declared) || canonical(declared) !== canonical(magic))) return null;
  if (fromName && canonical(fromName) !== canonical(magic)) return null;
  return magic;
}

function imageDataUrl(bytes: Uint8Array, contentType: string) {
  return `data:${contentType};base64,${fileToBase64(bytes)}`;
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
  return Boolean(normalizeImageContentType(file, bytes) && IMAGE_EXTENSION_PATTERN.test(file.name || ""));
}

function providerErrorDetails(error: unknown) {
  if (error instanceof ImageModerationProviderError) {
    return {
      provider: error.provider,
      httpStatus: error.httpStatus,
      reason: error.message,
      requestUrl: error.requestUrl,
      model: error.model,
      responseBody: error.responseBody,
      parsedJson: error.parsedJson,
      cloudflareErrorCodes: error.cloudflareErrorCodes,
      failureKind: error.failureKind
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
    requestUrl?: string;
    model?: string;
    responseBody?: string;
    parsedJson?: unknown;
    cloudflareErrorCodes?: string[];
    failureKind?: CloudflareFailureKind;
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
    httpStatus: details.httpStatus,
    requestUrl: details.requestUrl,
    model: details.model,
    responseBody: details.responseBody,
    parsedJson: details.parsedJson,
    cloudflareErrorCodes: details.cloudflareErrorCodes,
    failureKind: details.failureKind
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

function parseJsonResponseBody(responseBody: string) {
  if (!responseBody) return null;
  try {
    return JSON.parse(responseBody);
  } catch {
    return null;
  }
}

async function readProviderResponse(response: Response) {
  const responseBody = await response.text().catch((error) => (
    error instanceof Error ? `response_body_unreadable:${error.message}` : "response_body_unreadable"
  ));
  return {
    responseBody,
    parsedJson: parseJsonResponseBody(responseBody)
  };
}

function collectCloudflareErrorCodes(value: unknown) {
  const codes: string[] = [];
  const collect = (item: unknown) => {
    if (!item || typeof item !== "object") return;
    const record = item as Record<string, unknown>;
    const code = record.code ?? record.errorCode ?? record.error_code;
    if (typeof code === "string" || typeof code === "number") {
      codes.push(String(code));
      return;
    }
    if (typeof record.message === "string") {
      codes.push(record.message);
    }
  };

  if (value && typeof value === "object") {
    const record = value as Record<string, unknown>;
    if (Array.isArray(record.errors)) record.errors.forEach(collect);
    if (Array.isArray(record.messages)) record.messages.forEach(collect);
    collect(record.error);
  }

  return Array.from(new Set(codes));
}

function failureSearchText(responseBody?: string, parsedJson?: unknown) {
  const jsonText = parsedJson ? JSON.stringify(parsedJson) : "";
  return `${responseBody || ""} ${jsonText}`.toLowerCase();
}

function classifyCloudflareFailure(
  httpStatus: number | undefined,
  responseBody?: string,
  parsedJson?: unknown,
  fallback: CloudflareFailureKind = "cloudflare_http_error"
): CloudflareFailureKind {
  const text = failureSearchText(responseBody, parsedJson);

  if (text.includes("timeout") || text.includes("timed out")) return "timeout";
  if (text.includes("unsupported") && (text.includes("image") || text.includes("format") || text.includes("decode"))) {
    return "image_format_unsupported";
  }
  if (
    text.includes("license") ||
    text.includes("acceptable use") ||
    text.includes("acceptance") ||
    text.includes("\"prompt\"") && text.includes("agree")
  ) {
    return "license_acceptance_required";
  }
  if (httpStatus === 401) return "authentication_failed";
  if (
    httpStatus === 403 &&
    (text.includes("auth") || text.includes("token") || text.includes("permission") || text.includes("forbidden") || text.includes("unauthorized"))
  ) {
    return "authentication_failed";
  }
  if (httpStatus === 404 || httpStatus === 410 || text.includes("model not found") || text.includes("model unavailable")) {
    return "model_unavailable";
  }
  if (httpStatus === 400 || httpStatus === 415 || httpStatus === 422 || text.includes("invalid payload") || text.includes("schema")) {
    return "invalid_payload";
  }
  if (httpStatus === 408 || httpStatus === 504) {
    return "timeout";
  }

  return fallback;
}

function cloudflareResponseMessage(responseBody?: string, parsedJson?: unknown) {
  return failureSearchText(responseBody, parsedJson);
}

function isLlamaLicenseAcceptedResponse(httpStatus: number, responseBody?: string, parsedJson?: unknown) {
  const message = cloudflareResponseMessage(responseBody, parsedJson);
  const codes = collectCloudflareErrorCodes(parsedJson);

  return (
    httpStatus === 403 &&
    codes.includes("5016") &&
    message.includes("thank you for agreeing") &&
    message.includes("you may now use the model")
  );
}

function classifyFetchError(error: unknown): CloudflareFailureKind {
  const name = error instanceof Error ? error.name.toLowerCase() : "";
  const message = error instanceof Error ? error.message.toLowerCase() : "";
  if (name.includes("abort") || name.includes("timeout") || message.includes("timeout") || message.includes("timed out")) {
    return "timeout";
  }
  return "cloudflare_http_error";
}

function extractWorkersAiResponseText(payload: unknown) {
  if (!payload || typeof payload !== "object") return null;
  const record = payload as Record<string, unknown>;
  const result = record.result;
  if (typeof result === "string") return result;
  if (result && typeof result === "object") {
    const resultRecord = result as Record<string, unknown>;
    for (const key of ["response", "text", "answer"]) {
      if (typeof resultRecord[key] === "string") return resultRecord[key];
    }
  }
  return null;
}

async function fetchModeration(provider: ImageModerationProvider, url: string, init: RequestInit, model?: string) {
  try {
    return await fetch(url, {
      ...init,
      signal: AbortSignal.timeout(moderationTimeoutMs())
    });
  } catch (error) {
    const failureKind = classifyFetchError(error);
    throw new ImageModerationProviderError(
      provider,
      failureKind,
      {
        requestUrl: url,
        model,
        failureKind
      }
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
  const { responseBody, parsedJson } = await readProviderResponse(response);
  const cloudflareErrorCodes = collectCloudflareErrorCodes(parsedJson);

  if (!response.ok) {
    const failureKind = classifyCloudflareFailure(response.status, responseBody, parsedJson);
    throw new ImageModerationProviderError(provider, failureKind, {
      httpStatus: response.status,
      requestUrl: endpoint,
      responseBody,
      parsedJson,
      cloudflareErrorCodes,
      failureKind
    });
  }

  return {
    provider,
    httpStatus: response.status,
    decision: normalizeDecision(parsedJson),
    requestUrl: endpoint,
    responseBody,
    parsedJson,
    cloudflareErrorCodes
  };
}

function shouldTryLlamaVisionLicenseAgreement(model: string, failureKind: CloudflareFailureKind) {
  if (process.env.CLOUDFLARE_WORKERS_AI_ACCEPT_LICENSE_ON_403 === "false") return false;
  if (!model.includes("llama-3.2-11b-vision-instruct")) return false;
  if (llamaLicenseAgreementCache.has(model)) return false;
  return failureKind === "license_acceptance_required";
}

async function agreeToLlamaVisionLicense(input: {
  provider: ImageModerationProvider;
  requestUrl: string;
  model: string;
  token: string;
  source: ImageModerationSource;
  required: boolean;
}) {
  const response = await fetchModeration(input.provider, input.requestUrl, {
    method: "POST",
    headers: {
      authorization: `Bearer ${input.token}`,
      "content-type": "application/json"
    },
    body: JSON.stringify({ prompt: "agree" })
  }, input.model);
  const { responseBody, parsedJson } = await readProviderResponse(response);
  const cloudflareErrorCodes = collectCloudflareErrorCodes(parsedJson);
  const accepted = response.ok || isLlamaLicenseAcceptedResponse(response.status, responseBody, parsedJson);
  const failureKind = accepted
    ? undefined
    : classifyCloudflareFailure(response.status, responseBody, parsedJson);

  logModeration(accepted ? "info" : "error", "workers_ai_license_response", {
    source: input.source,
    provider: input.provider,
    enabled: true,
    required: input.required,
    allowed: accepted,
    reason: accepted ? "license_accepted" : failureKind,
    httpStatus: response.status,
    requestUrl: input.requestUrl,
    model: input.model,
    responseBody,
    parsedJson,
    cloudflareErrorCodes,
    failureKind
  });

  if (!accepted) {
    throw new ImageModerationProviderError(input.provider, failureKind || "cloudflare_http_error", {
      httpStatus: response.status,
      requestUrl: input.requestUrl,
      model: input.model,
      responseBody,
      parsedJson,
      cloudflareErrorCodes,
      failureKind
    });
  }

  llamaLicenseAgreementCache.add(input.model);
}

async function runWorkersAiModerationRequest(input: {
  bytes: Uint8Array;
  contentType: string;
  source: ImageModerationSource;
  provider: ImageModerationProvider;
  requestUrl: string;
  model: string;
  token: string;
  required: boolean;
}) {
  const response = await fetchModeration(input.provider, input.requestUrl, {
    method: "POST",
    headers: {
      authorization: `Bearer ${input.token}`,
      "content-type": "application/json"
    },
    body: JSON.stringify({
      image: imageDataUrl(input.bytes, input.contentType),
      max_tokens: 180,
      temperature: 0,
      prompt:
        "Classify this image for a university social app. Return only valid compact JSON with exactly these keys: " +
        "{\"allowed\":boolean,\"reason\":string,\"labels\":string[]}. " +
        "Set allowed=false for pornographic, sexually explicit, nude, violent, weapon, blood, gore, self-harm, or graphic content."
    })
  }, input.model);
  const { responseBody, parsedJson } = await readProviderResponse(response);
  const cloudflareErrorCodes = collectCloudflareErrorCodes(parsedJson);

  logModeration(response.ok ? "info" : "error", "workers_ai_response", {
    source: input.source,
    provider: input.provider,
    enabled: true,
    required: input.required,
    allowed: response.ok,
    reason: response.ok ? "response_received" : classifyCloudflareFailure(response.status, responseBody, parsedJson),
    httpStatus: response.status,
    requestUrl: input.requestUrl,
    model: input.model,
    responseBody,
    parsedJson,
    cloudflareErrorCodes,
    failureKind: response.ok ? undefined : classifyCloudflareFailure(response.status, responseBody, parsedJson)
  });

  if (!response.ok) {
    const failureKind = classifyCloudflareFailure(response.status, responseBody, parsedJson);
    throw new ImageModerationProviderError(input.provider, failureKind, {
      httpStatus: response.status,
      requestUrl: input.requestUrl,
      model: input.model,
      responseBody,
      parsedJson,
      cloudflareErrorCodes,
      failureKind
    });
  }

  const rawResponse = extractWorkersAiResponseText(parsedJson);
  const decision = rawResponse
    ? normalizeDecision(extractJsonObject(rawResponse))
    : normalizeDecision((parsedJson as { result?: unknown } | null)?.result);

  if (!decision) {
    throw new ImageModerationProviderError(input.provider, "parsing_error", {
      httpStatus: response.status,
      requestUrl: input.requestUrl,
      model: input.model,
      responseBody,
      parsedJson,
      cloudflareErrorCodes,
      failureKind: "parsing_error"
    });
  }

  return {
    provider: input.provider,
    httpStatus: response.status,
    decision,
    requestUrl: input.requestUrl,
    model: input.model,
    responseBody,
    parsedJson,
    cloudflareErrorCodes
  } satisfies ProviderResult;
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
  const model = process.env.CLOUDFLARE_IMAGE_MODERATION_MODEL?.trim() || LLAMA_VISION_MODEL;
  const requestUrl = `https://api.cloudflare.com/client/v4/accounts/${accountId}/ai/run/${model}`;
  const required = moderationRequired(input.source);

  try {
    return await runWorkersAiModerationRequest({
      ...input,
      provider,
      requestUrl,
      model,
      token,
      required
    });
  } catch (error) {
    if (
      error instanceof ImageModerationProviderError &&
      shouldTryLlamaVisionLicenseAgreement(model, error.failureKind || "cloudflare_http_error")
    ) {
      await agreeToLlamaVisionLicense({
        provider,
        requestUrl,
        model,
        token,
        source: input.source,
        required
      });
      return runWorkersAiModerationRequest({
        ...input,
        provider,
        requestUrl,
        model,
        token,
        required
      });
    }

    throw error;
  }
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
  const required = moderationRequired(source);
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

  const contentType = normalizeImageContentType(file, bytes);

  if (!contentType || !isLikelyImageFile(file, bytes)) {
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
      contentType,
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
      httpStatus: details.httpStatus,
      requestUrl: details.requestUrl,
      model: details.model,
      responseBody: details.responseBody,
      parsedJson: details.parsedJson,
      cloudflareErrorCodes: details.cloudflareErrorCodes,
      failureKind: details.failureKind
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
      httpStatus: result.httpStatus,
      requestUrl: result.requestUrl,
      model: result.model,
      responseBody: result.responseBody,
      parsedJson: result.parsedJson,
      cloudflareErrorCodes: result.cloudflareErrorCodes,
      failureKind: result.failureKind
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
    httpStatus: result.httpStatus,
    requestUrl: result.requestUrl,
    model: result.model,
    responseBody: result.responseBody,
    parsedJson: result.parsedJson,
    cloudflareErrorCodes: result.cloudflareErrorCodes
  });

  if (blocked) {
    throw new Error("image_rejected");
  }
}
