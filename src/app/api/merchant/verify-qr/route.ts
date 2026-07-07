import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { USER_SESSION_COOKIE, verifyUserSessionToken } from "@/lib/server/userSession";
import { QrCredentialError, verifyQrCredential } from "@/lib/server/qr";
import { hasUserCheckedInToday } from "@/lib/server/check_ins";
import { getReadyPool } from "@/lib/server/users";
import { RateLimitError, assertRateLimit, rateLimitResponseHeaders } from "@/lib/server/rateLimit";

export const runtime = "nodejs";

function qrCredentialErrorResponse(error: QrCredentialError) {
  if (error.code === "token_not_found" || error.code === "token_already_used") {
    return NextResponse.json({ error: "token_not_found" }, { status: 404 });
  }
  if (error.code === "token_expired") {
    return NextResponse.json({ error: "token_expired" }, { status: 400 });
  }
  return NextResponse.json({ error: "invalid_format" }, { status: 400 });
}

export async function POST(request: Request) {
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

  const body = (await request.json().catch(() => ({}))) as { token?: string; restaurantId?: string };
  if (!body.token) {
    return NextResponse.json({ error: "missing_token" }, { status: 400 });
  }

  try {
    const pool = await getReadyPool();
    await assertRateLimit({
      namespace: "merchant_verify_qr",
      identifier: session.id,
      limit: 120,
      windowSeconds: 60,
      executor: pool
    });

    let credential;

    const merchantResult = await pool.query<{
      id: string;
      status: string;
      merchant_restaurant_id: string | null;
      restaurant_id: string | null;
      restaurant_status: string | null;
      restaurant_deleted_at: Date | null;
    }>(
      `SELECT
         merchant.id,
         merchant.status,
         merchant.restaurant_id as merchant_restaurant_id,
         restaurant.id as restaurant_id,
         restaurant.status as restaurant_status,
         restaurant.deleted_at as restaurant_deleted_at
       FROM merchant_accounts merchant
       LEFT JOIN restaurants restaurant
         ON restaurant.id = merchant.restaurant_id
         OR restaurant.owner_merchant_id = merchant.id
       WHERE merchant.id = $1
       LIMIT 1`,
      [session.id]
    );
    const merchant = merchantResult.rows[0];
    const linkedRestaurantId = merchant?.merchant_restaurant_id || merchant?.restaurant_id || null;

    if (!merchant || merchant.status !== "active") {
      return NextResponse.json({ error: "merchant_not_found" }, { status: 401 });
    }
    if (
      !linkedRestaurantId ||
      merchant.restaurant_status === "deleted" ||
      merchant.restaurant_status === "suspended" ||
      merchant.restaurant_deleted_at ||
      (body.restaurantId && body.restaurantId !== linkedRestaurantId)
    ) {
      return NextResponse.json({ error: "merchant_restaurant_mismatch" }, { status: 403 });
    }

    try {
      credential = await verifyQrCredential(body.token);
    } catch (error) {
      if (error instanceof QrCredentialError) return qrCredentialErrorResponse(error);
      throw error;
    }

    const userResult = await pool.query("SELECT * FROM users WHERE id = $1 LIMIT 1", [credential.userId]);
    const user = userResult.rows[0];

    if (!user) return NextResponse.json({ error: "user_not_found" }, { status: 404 });
    if (user.status !== "active") return NextResponse.json({ error: "user_suspended" }, { status: 403 });
    if (user.student_status !== "verified" || !user.student_menu_access) {
      return NextResponse.json({ error: "not_student_eligible" }, { status: 403 });
    }

    const usedToday = await hasUserCheckedInToday(user.id);
    if (usedToday) {
      return NextResponse.json({ error: "already_used_today" }, { status: 403 });
    }

    // Notice we do NOT consume the token here, we only verify it.
    // It gets consumed during confirm-check-in.

    return NextResponse.json({
      ok: true,
      user: {
        id: user.id,
        name: user.name,
        universityName: user.university_name,
        studentStatus: user.student_status,
        studentMenuAccess: user.student_menu_access
      },
      qrToken: { token: credential.token, id: credential.qrTokenId, kind: credential.kind },
      restaurant: { id: linkedRestaurantId }
    });
  } catch (error) {
    if (error instanceof RateLimitError) {
      return NextResponse.json({ error: "rate_limited" }, { status: 429, headers: rateLimitResponseHeaders(error) });
    }
    console.error("[merchant_verify_qr] internal_server_error", { reason: error instanceof Error ? error.name : "unknown" });
    return NextResponse.json({ error: "internal_server_error" }, { status: 500 });
  }
}
