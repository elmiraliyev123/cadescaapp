import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { getRequestIp, turnstileStatus, verifyTurnstileToken } from "@/lib/server/turnstile";
import { authenticateUserInDb } from "@/lib/server/users";
import { USER_SESSION_COOKIE, createUserSessionToken } from "@/lib/server/userSession";
import { signInSupabaseAuthOnResponse, SupabaseAuthBridgeError } from "@/lib/server/supabaseAuthBridge";
import { withSharedCookieDomain } from "@/lib/cookieDomain";
import { getUserClubAccessSummary, type UserClubAccessSummary } from "@/lib/server/studentClubs";

export const runtime = "nodejs";

const NO_CLUB_ACCESS: UserClubAccessSummary = {
  available: true,
  hasActiveMembership: false,
  invitationCount: 0,
  gatewayHref: "/app/user/club"
};

export async function POST(request: Request) {
  const body = (await request.json().catch(() => ({}))) as { email?: string; password?: string; turnstileToken?: string };
  const turnstile = await verifyTurnstileToken(body.turnstileToken, getRequestIp(request));

  if (!turnstile.success) {
    return NextResponse.json({ error: turnstile.errorCode }, { status: turnstileStatus(turnstile.errorCode) });
  }

  if (!body.email || !body.password) {
    return NextResponse.json({ error: "missing_credentials" }, { status: 400 });
  }

  if (process.env.NODE_ENV === "development") {
    const secret = process.env.AUTH_SECRET || "D5UcOA1nG+qxyqr5PEr3RF6uIxMYsTNIHMT4CR0YJnE=";
    const session = await createUserSessionToken("user_mock", body.email, "user", secret);
    const cookieStore = await cookies();
    cookieStore.set(USER_SESSION_COOKIE, session.token, withSharedCookieDomain({
      httpOnly: true,
      secure: false,
      sameSite: "lax",
      maxAge: 3600
    }));
    return NextResponse.json({
      ok: true,
      user: { id: "user_mock", name: "Demo User", email: body.email, role: "user" },
      clubAccess: NO_CLUB_ACCESS
    });
  }

  try {
    const user = await authenticateUserInDb(body.email, body.password);
    
    if (user.status !== "active") {
      return NextResponse.json({ error: "account_inactive" }, { status: 401 });
    }

    if (!user.email_verified) {
      return NextResponse.json(
        {
          error: "email_not_verified",
          user: {
            name: user.name,
            email: user.email
          }
        },
        { status: 403 }
      );
    }

    const secret = process.env.AUTH_SECRET;
    if (!secret) {
      return NextResponse.json({ error: "internal_server_error" }, { status: 500 });
    }

    const session = await createUserSessionToken(user.id, user.email, "user", secret);
    const clubAccess = await getUserClubAccessSummary(user.id).catch((error) => {
      console.error("[user_login] club_access_resolution_failed", {
        reason: error instanceof Error ? error.name : "unknown"
      });
      return { ...NO_CLUB_ACCESS, available: false };
    });
    const response = NextResponse.json({
      ok: true,
      user: { id: user.id, name: user.name, email: user.email, role: user.role },
      clubAccess
    });

    response.cookies.set(USER_SESSION_COOKIE, session.token, withSharedCookieDomain({
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: Math.floor((session.payload.expiresAt - Date.now()) / 1000)
    }));

    try {
      await signInSupabaseAuthOnResponse({
        response,
        email: user.email,
        password: body.password
      });
    } catch (error) {
      if (error instanceof SupabaseAuthBridgeError) {
        console.error("[user_login] supabase_cookie_sync_failed", { code: error.code });
      }
    }

    return response;
  } catch {
    return NextResponse.json({ error: "invalid_credentials" }, { status: 401 });
  }
}
