import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { USER_SESSION_COOKIE, verifyUserSessionToken } from "@/lib/server/userSession";
import { createFreshQrTokenForUser } from "@/lib/server/qr";
import { hasUserCheckedInToday } from "@/lib/server/check_ins";
import { getReadyPool } from "@/lib/server/users";

export const runtime = "nodejs";

export async function GET() {
  const cookieStore = await cookies();
  const token = cookieStore.get(USER_SESSION_COOKIE)?.value;
  const secret = process.env.AUTH_SECRET;

  if (!token || !secret) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const session = await verifyUserSessionToken(token, secret);
  if (!session || session.role !== "user") {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  try {
    const pool = await getReadyPool();
    const userResult = await pool.query("SELECT * FROM users WHERE id = $1 LIMIT 1", [session.id]);
    const user = userResult.rows[0];

    if (!user || user.status !== "active") {
      return NextResponse.json({ error: "account_inactive" }, { status: 401 });
    }

    if (user.student_status !== "verified" || !user.student_menu_access) {
      return NextResponse.json({ error: "not_eligible" }, { status: 403 });
    }

    const usedToday = await hasUserCheckedInToday(user.id);
    if (usedToday) {
      return NextResponse.json({ error: "already_used_today" }, { status: 403 });
    }

    const qrRecord = await createFreshQrTokenForUser(user.id);

    return NextResponse.json({
      ok: true,
      token: qrRecord.token,
      expiresAt: qrRecord.expires_at.toISOString()
    });
  } catch (error) {
    console.error("[user_qr] internal_server_error", { reason: error instanceof Error ? error.name : "unknown" });
    return NextResponse.json({ error: "internal_server_error" }, { status: 500 });
  }
}
