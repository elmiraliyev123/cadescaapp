import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

import { verifyUserSessionToken, USER_SESSION_COOKIE } from "@/lib/server/userSession";
import { updateUserLocale } from "@/lib/server/users";
import {
  isSupportedLocale,
  LOCALE_COOKIE_DOMAIN,
  LOCALE_COOKIE_MAX_AGE,
  NEXT_LOCALE_COOKIE_NAME
} from "@/lib/localization";

/**
 * POST /api/user/locale
 *
 * Updates the user's preferred locale.
 * - If authenticated: persists to DB `users.locale` column
 * - Always: sets the `NEXT_LOCALE` cookie so middleware and RSCs use it
 *
 * Body: { "locale": "tr" | "az" | "en" | "ru" }
 */
export async function POST(request: NextRequest) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  }

  const locale = (body as Record<string, unknown>)?.locale;

  if (!isSupportedLocale(locale)) {
    return NextResponse.json(
      { error: "invalid_locale", supported: ["tr", "az", "en", "ru"] },
      { status: 400 }
    );
  }

  // If user is authenticated, persist to database
  const sessionToken = request.cookies.get(USER_SESSION_COOKIE)?.value;
  const secret = process.env.AUTH_SECRET || "";

  if (sessionToken && secret) {
    const session = await verifyUserSessionToken(sessionToken, secret);
    if (session) {
      try {
        await updateUserLocale(session.id, locale);
      } catch (error) {
        console.error("[locale] update_failed", { reason: error instanceof Error ? error.name : "unknown" });
        // Non-fatal — we still set the cookie below
      }
    }
  }

  const response = NextResponse.json({ success: true, locale });

  response.cookies.set(NEXT_LOCALE_COOKIE_NAME, locale, {
    domain: LOCALE_COOKIE_DOMAIN,
    path: "/",
    maxAge: LOCALE_COOKIE_MAX_AGE,
    sameSite: "lax",
    httpOnly: false,
    secure: process.env.NODE_ENV === "production"
  });

  return response;
}
