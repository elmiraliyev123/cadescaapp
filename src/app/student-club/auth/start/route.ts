import { NextResponse } from "next/server";

import { getAuthUrl, getStudentClubUrl } from "@/lib/appConfig";
import { createOAuthClientState, oauthPkceChallenge } from "@/lib/server/oauthClientState";

export const runtime = "nodejs";

const CLIENT_STATE_COOKIE = "cadesca_studentclub_oauth_state";

function safeReturnTo(value: string | null) {
  const candidate = value || "/resolve";
  if (["/", "/resolve", "/application", "/clubs"].includes(candidate)) return candidate;
  if (/^\/application\/[0-9a-f-]{36}(?:\/status)?$/i.test(candidate)) return candidate;
  if (/^\/dashboard\/[a-z0-9](?:[a-z0-9-]{1,90}[a-z0-9])?(?:\/[a-z0-9/_-]+)?$/i.test(candidate)) return candidate;
  return "/resolve";
}

export async function GET(request: Request) {
  const returnTo = safeReturnTo(new URL(request.url).searchParams.get("return_to"));
  const { state, token } = createOAuthClientState(returnTo);
  const callback = `${getStudentClubUrl()}/auth/callback`;
  const authorize = new URL("/authorize", getAuthUrl());
  authorize.searchParams.set("client_id", "studentclub");
  authorize.searchParams.set("redirect_uri", callback);
  authorize.searchParams.set("response_type", "code");
  authorize.searchParams.set("scope", "openid profile university");
  authorize.searchParams.set("state", state.state);
  authorize.searchParams.set("nonce", state.nonce);
  authorize.searchParams.set("code_challenge", oauthPkceChallenge(state.verifier));
  authorize.searchParams.set("code_challenge_method", "S256");

  const response = NextResponse.redirect(authorize);
  response.cookies.set(CLIENT_STATE_COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/auth",
    maxAge: 10 * 60
  });
  return response;
}
