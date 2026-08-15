import { cookies } from "next/headers";
import { NextResponse } from "next/server";

import { getStudentClubUrl } from "@/lib/appConfig";
import { exchangeAuthorizationCode, OAuthError, userInfoForAccessToken } from "@/lib/server/oauth";
import { verifyOAuthClientState } from "@/lib/server/oauthClientState";

export const runtime = "nodejs";

const CLIENT_STATE_COOKIE = "cadesca_studentclub_oauth_state";

function clearState(response: NextResponse) {
  response.cookies.set(CLIENT_STATE_COOKIE, "", {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/auth",
    maxAge: 0,
    expires: new Date(0)
  });
  return response;
}

export async function GET(request: Request) {
  const url = new URL(request.url);
  const cookieStore = await cookies();
  const clientState = verifyOAuthClientState(cookieStore.get(CLIENT_STATE_COOKIE)?.value);
  const suppliedState = url.searchParams.get("state") || "";
  const code = url.searchParams.get("code") || "";
  const returnedError = url.searchParams.get("error");
  const fallback = new URL("/application", getStudentClubUrl());

  if (!clientState || suppliedState !== clientState.state || returnedError || !code) {
    fallback.searchParams.set("auth_error", returnedError || "invalid_callback");
    return clearState(NextResponse.redirect(fallback));
  }

  try {
    const token = await exchangeAuthorizationCode({
      grantType: "authorization_code",
      clientId: "studentclub",
      code,
      redirectUri: `${getStudentClubUrl()}/auth/callback`,
      codeVerifier: clientState.verifier
    });
    // Resolve the immutable Cadesca sub now. The existing same-project portal
    // continues to use the secure shared Cadesca session for backend requests.
    await userInfoForAccessToken(token.access_token);
    return clearState(NextResponse.redirect(new URL(clientState.returnTo, getStudentClubUrl())));
  } catch (error) {
    fallback.searchParams.set("auth_error", error instanceof OAuthError ? error.code : "server_error");
    return clearState(NextResponse.redirect(fallback));
  }
}

