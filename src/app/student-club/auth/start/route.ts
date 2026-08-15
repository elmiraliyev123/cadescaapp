import { NextResponse } from "next/server";

import { getAuthUrl, getStudentClubUrl } from "@/lib/appConfig";
import { createOAuthClientState, oauthPkceChallenge } from "@/lib/server/oauthClientState";

export const runtime = "nodejs";

const CLIENT_STATE_COOKIE = "cadesca_studentclub_oauth_state";
const SAFE_DESTINATIONS = new Set(["/application", "/dashboard", "/waiting-approval", "/clubs"]);

export async function GET(request: Request) {
  const requestedReturn = new URL(request.url).searchParams.get("return_to") || "/application";
  const returnTo = SAFE_DESTINATIONS.has(requestedReturn) ? requestedReturn : "/application";
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

