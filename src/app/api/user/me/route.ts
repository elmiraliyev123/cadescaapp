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

    const checkInsResult = await pool.query(`
      SELECT c.*, r.name as merchantName 
      FROM student_check_ins c
      JOIN restaurants r ON c.restaurant_id = r.id
      WHERE c.user_id = $1
      ORDER BY c.created_at DESC
    `, [user.id]);

    return NextResponse.json({
      ok: true,
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        studentStatus: user.student_status,
        studentMenuAccess: user.student_menu_access,
        universityName: user.university_name,
        universityDomain: user.university_domain
      },
      checkIns: checkInsResult.rows.map(row => ({
        id: row.id,
        merchantName: row.merchantname,
        status: row.status,
        createdAt: row.created_at
      }))
    });
  } catch (error) {
    console.error("[user_me] internal_server_error", { reason: error instanceof Error ? error.name : "unknown" });
    return NextResponse.json({ error: "internal_server_error" }, { status: 500 });
  }
}
