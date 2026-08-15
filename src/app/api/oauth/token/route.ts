import { NextResponse } from "next/server";

import { OAuthError, exchangeAuthorizationCode } from "@/lib/server/oauth";
import { assertRateLimit, RateLimitError, rateLimitResponseHeaders } from "@/lib/server/rateLimit";
import { getRequestIp } from "@/lib/server/turnstile";

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    await assertRateLimit({
      namespace: "oauth_token_ip",
      identifier: getRequestIp(request) || "unknown",
      limit: 30,
      windowSeconds: 60
    });
    const body = await request.formData();
    const result = await exchangeAuthorizationCode({
      grantType: String(body.get("grant_type") || ""),
      clientId: String(body.get("client_id") || ""),
      code: String(body.get("code") || ""),
      redirectUri: String(body.get("redirect_uri") || ""),
      codeVerifier: String(body.get("code_verifier") || "")
    });
    return NextResponse.json(result, { headers: { "cache-control": "no-store", pragma: "no-cache" } });
  } catch (error) {
    if (error instanceof RateLimitError) {
      return NextResponse.json({ error: "temporarily_unavailable" }, { status: 429, headers: rateLimitResponseHeaders(error) });
    }
    if (error instanceof OAuthError) {
      return NextResponse.json({ error: error.code }, { status: error.status, headers: { "cache-control": "no-store" } });
    }
    console.error("[oauth_token] failed", { reason: error instanceof Error ? error.name : "unknown" });
    return NextResponse.json({ error: "server_error" }, { status: 500, headers: { "cache-control": "no-store" } });
  }
}

