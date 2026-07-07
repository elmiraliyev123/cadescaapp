import "server-only";

export type TurnstileErrorCode = "turnstile_missing" | "turnstile_invalid" | "turnstile_verification_failed";

type TurnstileSiteverifyResponse = {
  success?: boolean;
  challenge_ts?: string;
  hostname?: string;
  "error-codes"?: string[];
  action?: string;
  cdata?: string;
};

export type TurnstileVerificationResult =
  | { success: true; response: TurnstileSiteverifyResponse }
  | { success: false; errorCode: TurnstileErrorCode };

export function getRequestIp(request: Request) {
  const forwardedFor = request.headers.get("x-forwarded-for");
  return (
    request.headers.get("cf-connecting-ip") ||
    forwardedFor?.split(",")[0]?.trim() ||
    request.headers.get("x-real-ip") ||
    undefined
  );
}

export function turnstileStatus(errorCode: TurnstileErrorCode) {
  return errorCode === "turnstile_verification_failed" ? 503 : 400;
}

export async function verifyTurnstileToken(token: unknown, remoteIp?: string | null): Promise<TurnstileVerificationResult> {
  const normalizedToken = typeof token === "string" ? token.trim() : "";
  if (!normalizedToken) return { success: false, errorCode: "turnstile_missing" };
  if (normalizedToken.length > 2048) return { success: false, errorCode: "turnstile_invalid" };

  if (process.env.NODE_ENV === "development" && normalizedToken === "dev_dummy_token") {
    return { success: true, response: {} };
  }

  const secret = process.env.TURNSTILE_SECRET_KEY;
  if (!secret) {
    if (process.env.NODE_ENV === "development") {
       console.warn("[turnstile] bypassed locally because TURNSTILE_SECRET_KEY is missing");
       return { success: true, response: {} };
    }
    console.error("[turnstile] turnstile_verification_failed", { reason: "secret_missing" });
    return { success: false, errorCode: "turnstile_verification_failed" };
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 8000);

  try {
    const response = await fetch("https://challenges.cloudflare.com/turnstile/v0/siteverify", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        secret,
        response: normalizedToken,
        remoteip: remoteIp || undefined
      }),
      signal: controller.signal
    });

    if (!response.ok) {
      console.error("[turnstile] turnstile_verification_failed", { status: response.status });
      return { success: false, errorCode: "turnstile_verification_failed" };
    }

    const result = (await response.json().catch(() => null)) as TurnstileSiteverifyResponse | null;
    if (!result) {
      console.error("[turnstile] turnstile_verification_failed", { reason: "invalid_json" });
      return { success: false, errorCode: "turnstile_verification_failed" };
    }

    if (!result.success) {
      console.error("[turnstile] turnstile_invalid", { errorCodes: result["error-codes"] || [] });
      return { success: false, errorCode: "turnstile_invalid" };
    }

    return { success: true, response: result };
  } catch (error) {
    console.error("[turnstile] turnstile_verification_failed", { reason: error instanceof Error ? error.name : "unknown" });
    return { success: false, errorCode: "turnstile_verification_failed" };
  } finally {
    clearTimeout(timeout);
  }
}
