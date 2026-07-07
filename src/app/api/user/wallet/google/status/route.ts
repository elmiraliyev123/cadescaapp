import { NextResponse } from "next/server";
import { cookies } from "next/headers";

import { getGoogleWalletStatus } from "@/lib/server/googleWallet";
import { USER_SESSION_COOKIE, verifyUserSessionToken } from "@/lib/server/userSession";

export const runtime = "nodejs";

async function requireUserSession() {
  const cookieStore = await cookies();
  const token = cookieStore.get(USER_SESSION_COOKIE)?.value;
  const secret = process.env.AUTH_SECRET;

  if (!token || !secret) return null;

  const session = await verifyUserSessionToken(token, secret);
  return session?.role === "user" ? session : null;
}

export async function GET() {
  const session = await requireUserSession();
  if (!session) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  try {
    const status = await getGoogleWalletStatus(session.id);
    return NextResponse.json({ ok: true, wallet: status });
  } catch (error) {
    console.error("[google_wallet_status] failed", { reason: error instanceof Error ? error.name : "unknown" });
    return NextResponse.json({ error: "internal_server_error" }, { status: 500 });
  }
}
