import { timingSafeEqual } from "crypto";
import { NextResponse } from "next/server";

import { ADMIN_SESSION_COOKIE, ADMIN_SESSION_TTL_SECONDS, createAdminSessionToken } from "@/lib/server/adminSession";

export const runtime = "nodejs";

type AdminLoginRequest = {
  email?: string;
  password?: string;
};

function isSameSecret(input: string, expected: string) {
  const inputBuffer = Buffer.from(input);
  const expectedBuffer = Buffer.from(expected);
  return inputBuffer.length === expectedBuffer.length && timingSafeEqual(inputBuffer, expectedBuffer);
}

export async function POST(request: Request) {
  const body = (await request.json().catch(() => ({}))) as AdminLoginRequest;
  const email = body.email?.trim().toLowerCase() || "";
  const password = body.password || "";

  const configuredEmails = (process.env.CADESCA_ADMIN_EMAILS || process.env.CADESCA_ADMIN_EMAIL || "")
    .split(",")
    .map((item) => item.trim().toLowerCase())
    .filter(Boolean);
  const configuredPassword = process.env.CADESCA_ADMIN_PASSWORD || "";
  const authSecret = process.env.AUTH_SECRET || "";

  if (!configuredEmails.length || !configuredPassword || !authSecret) {
    return NextResponse.json({ message: "admin_auth_not_configured" }, { status: 503 });
  }

  if (!configuredEmails.includes(email) || !isSameSecret(password, configuredPassword)) {
    return NextResponse.json({ message: "invalid_credentials" }, { status: 401 });
  }

  const session = await createAdminSessionToken(email, authSecret);
  const response = NextResponse.json({ ok: true, expiresAt: session.payload.expiresAt });
  response.cookies.set(ADMIN_SESSION_COOKIE, session.token, {
    httpOnly: true,
    maxAge: ADMIN_SESSION_TTL_SECONDS,
    path: "/",
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production"
  });

  return response;
}
