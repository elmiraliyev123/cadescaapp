import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { revalidatePath } from "next/cache";
import { USER_SESSION_COOKIE, verifyUserSessionToken } from "@/lib/server/userSession";
import { CheckInError, confirmStudentCheckIn } from "@/lib/server/check_ins";
import { RateLimitError, assertRateLimit, rateLimitResponseHeaders } from "@/lib/server/rateLimit";

export const runtime = "nodejs";

type ConfirmCheckInBody = {
  token?: string;
  userId?: string;
  restaurantId?: string;
  menuItemId?: string;
};

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

  const body = (await request.json().catch(() => ({}))) as ConfirmCheckInBody;

  if (!body.token || !body.userId || !body.restaurantId) {
    return NextResponse.json({ error: "missing_fields" }, { status: 400 });
  }

  try {
    await assertRateLimit({
      namespace: "merchant_confirm_check_in",
      identifier: session.id,
      limit: 60,
      windowSeconds: 60
    });

    const checkIn = await confirmStudentCheckIn({
      token: body.token,
      userId: body.userId,
      restaurantId: body.restaurantId,
      merchantUserId: session.id,
      menuItemId: body.menuItemId
    });

    revalidatePath("/app/merchant");
    revalidatePath("/app/merchant/qr");
    revalidatePath("/app/merchant/student-check-ins");
    revalidatePath("/app/user/activity");
    revalidatePath("/app/user/pass");

    return NextResponse.json({ ok: true, checkInId: checkIn.id });
  } catch (error) {
    if (error instanceof RateLimitError) {
      return NextResponse.json({ error: "rate_limited" }, { status: 429, headers: rateLimitResponseHeaders(error) });
    }
    if (error instanceof CheckInError) {
      return NextResponse.json({ error: error.code }, { status: error.status });
    }
    console.error("[merchant_confirm_check_in] internal_server_error", { reason: error instanceof Error ? error.name : "unknown" });
    return NextResponse.json({ error: "internal_server_error" }, { status: 500 });
  }
}
