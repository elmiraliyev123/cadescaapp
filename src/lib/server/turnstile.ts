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

type TurnstileExpectations = {
  expectedAction?: string;
  allowedHostnames?: string[];
};

function normalizeHostname(value: string) {
  return value.trim().toLowerCase().replace(/\.$/, "");
}

export function getStudentClubTurnstileHostnames() {
  const hostnames = new Set(
    (process.env.TURNSTILE_ALLOWED_HOSTNAMES || "")
      .split(",")
      .map(normalizeHostname)
      .filter(Boolean)
  );

  for (const value of [
    process.env.NEXT_PUBLIC_STUDENT_CLUB_ORIGIN,
    process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : "",
    "https://studentclub.cadesca.com"
  ]) {
    if (!value) continue;
    try {
      hostnames.add(normalizeHostname(new URL(value).hostname));
    } catch {
      // Invalid deployment configuration is ignored in favor of the canonical host.
    }
  }

  if (process.env.NODE_ENV !== "production") {
    hostnames.add("localhost");
    hostnames.add("127.0.0.1");
  }
  return [...hostnames];
}

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

export async function verifyTurnstileToken(
  token: unknown,
  remoteIp?: string | null,
  expectations: TurnstileExpectations = {}
): Promise<TurnstileVerificationResult> {
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

    if (expectations.expectedAction && result.action !== expectations.expectedAction) {
      console.error("[turnstile] turnstile_invalid", { reason: "action_mismatch" });
      return { success: false, errorCode: "turnstile_invalid" };
    }

    const allowedHostnames = new Set((expectations.allowedHostnames || []).map(normalizeHostname).filter(Boolean));
    if (allowedHostnames.size && (!result.hostname || !allowedHostnames.has(normalizeHostname(result.hostname)))) {
      console.error("[turnstile] turnstile_invalid", { reason: "hostname_mismatch" });
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
