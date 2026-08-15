import { NextResponse } from "next/server";

import { OAuthError, userInfoForAccessToken } from "@/lib/server/oauth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const authorization = request.headers.get("authorization") || "";
  const [scheme, token] = authorization.split(/\s+/, 2);
  if (scheme?.toLowerCase() !== "bearer" || !token) {
    return NextResponse.json({ error: "invalid_token" }, { status: 401 });
  }
  try {
    return NextResponse.json(await userInfoForAccessToken(token), {
      headers: { "cache-control": "private, no-store" }
    });
  } catch (error) {
    if (error instanceof OAuthError) {
      return NextResponse.json({ error: error.code }, { status: error.status });
    }
    return NextResponse.json({ error: "server_error" }, { status: 500 });
  }
}

