import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { USER_SESSION_COOKIE, verifyUserSessionToken } from "@/lib/server/userSession";
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
  if (!session || session.role !== "merchant") {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  try {
    const pool = await getReadyPool();
    const merchantResult = await pool.query("SELECT * FROM merchant_accounts WHERE id = $1 LIMIT 1", [session.id]);
    const merchant = merchantResult.rows[0];

    if (!merchant || merchant.status !== "active") {
      return NextResponse.json({ error: "account_inactive" }, { status: 401 });
    }

    const checkInsResult = await pool.query(`
      SELECT c.*, u.name as userName, u.email as userEmail
      FROM student_check_ins c
      JOIN users u ON c.user_id = u.id
      WHERE c.merchant_user_id = $1
      ORDER BY c.created_at DESC
    `, [merchant.id]);

    const statsResult = await pool.query(`
      SELECT count(*) as total, sum(case when created_at >= current_date then 1 else 0 end) as today
      FROM student_check_ins
      WHERE merchant_user_id = $1
    `, [merchant.id]);

    return NextResponse.json({
      ok: true,
      merchant: {
        id: merchant.id,
        name: merchant.name,
        email: merchant.email,
        restaurantId: merchant.restaurant_id
      },
      checkIns: checkInsResult.rows.map(row => ({
        id: row.id,
        userName: row.username,
        userEmail: row.useremail,
        status: row.status,
        createdAt: row.created_at
      })),
      stats: {
        totalCheckIns: parseInt(statsResult.rows[0].total || "0", 10),
        todayCheckIns: parseInt(statsResult.rows[0].today || "0", 10)
      }
    });
  } catch (error) {
    console.error("[merchant_me] internal_server_error", { reason: error instanceof Error ? error.name : "unknown" });
    return NextResponse.json({ error: "internal_server_error" }, { status: 500 });
  }
}
