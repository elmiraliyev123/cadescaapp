import { cookies } from "next/headers";
import { NextResponse } from "next/server";

import { getStudentClubUrl } from "@/lib/appConfig";
import { exchangeAuthorizationCode, OAuthError, userInfoForAccessToken } from "@/lib/server/oauth";
import { verifyOAuthClientState } from "@/lib/server/oauthClientState";
import { getCurrentStudentContext } from "@/lib/server/social";

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
  const fallback = new URL("/", getStudentClubUrl());

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
      codeVerifier: clientState.verifier,
      expectedNonce: clientState.nonce
    });
    // Resolve the immutable Cadesca sub. The access token remains server-only;
    // Student Club continues with Cadesca's secure shared first-party session.
    const identity = await userInfoForAccessToken(token.access_token);
    const sessionUser = await getCurrentStudentContext();
    if (!sessionUser || sessionUser.status !== "active" || sessionUser.id !== identity.sub) {
      throw new OAuthError("invalid_grant", 401);
    }
    const resolver = new URL("/resolve", getStudentClubUrl());
    if (clientState.returnTo !== "/resolve") resolver.searchParams.set("return_to", clientState.returnTo);
    return clearState(NextResponse.redirect(resolver));
  } catch (error) {
    fallback.searchParams.set("auth_error", error instanceof OAuthError ? error.code : "server_error");
    return clearState(NextResponse.redirect(fallback));
  }
}
