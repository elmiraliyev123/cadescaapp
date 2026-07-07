import { NextResponse } from "next/server";

import { withSharedCookieDomain } from "@/lib/cookieDomain";
import { USER_SESSION_COOKIE } from "@/lib/server/userSession";

export const runtime = "nodejs";

export async function POST() {
  const response = NextResponse.json({ ok: true });
  response.cookies.set(USER_SESSION_COOKIE, "", withSharedCookieDomain({
    httpOnly: true,
    maxAge: 0,
    path: "/",
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production"
  }));

  return response;
}
