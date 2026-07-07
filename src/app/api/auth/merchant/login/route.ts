import { NextResponse } from "next/server";
import { authenticateMerchantInDb, MerchantDbError } from "@/lib/server/merchants";
import { getRequestIp, turnstileStatus, verifyTurnstileToken } from "@/lib/server/turnstile";
import { cookies } from "next/headers";
import { USER_SESSION_COOKIE, createUserSessionToken } from "@/lib/server/userSession";

export const runtime = "nodejs";

function serializeRestaurant(restaurant: Awaited<ReturnType<typeof authenticateMerchantInDb>>["restaurant"]) {
  return {
    id: restaurant.id,
    ownerMerchantId: restaurant.owner_merchant_id,
    name: restaurant.name,
    bio: restaurant.bio || "",
    address: restaurant.address || "",
    city: restaurant.city || "",
    country: restaurant.country || "",
    lat: restaurant.latitude,
    lng: restaurant.longitude,
    phone: restaurant.phone || "",
    openingHours: restaurant.opening_hours || "",
    status: restaurant.status,
    studentMenuEligible: restaurant.student_menu_enabled,
    cadescaPartner: restaurant.cadesca_partner,
    createdAt: restaurant.created_at,
    updatedAt: restaurant.updated_at
  };
}

export async function POST(request: Request) {
  try {
    const body = (await request.json().catch(() => ({}))) as {
      email?: string;
      password?: string;
      turnstileToken?: string;
    };
    const { email, password, turnstileToken } = body;

    const turnstile = await verifyTurnstileToken(turnstileToken, getRequestIp(request));
    if (!turnstile.success) {
      return NextResponse.json({ error: turnstile.errorCode }, { status: turnstileStatus(turnstile.errorCode) });
    }

    if (!email || !password) {
      return NextResponse.json({ error: "invalid_payload" }, { status: 400 });
    }

    const result = await authenticateMerchantInDb(email, password);

    const secret = process.env.AUTH_SECRET;
    if (!secret) throw new Error("AUTH_SECRET is not configured");

    const session = await createUserSessionToken(result.merchant.id, result.merchant.email, "merchant", secret);
    const cookieStore = await cookies();
    cookieStore.set(USER_SESSION_COOKIE, session.token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: Math.floor((session.payload.expiresAt - Date.now()) / 1000)
    });

    return NextResponse.json({
      ok: true,
      merchantId: result.merchant.id,
      restaurantId: result.restaurant.id,
      restaurant: serializeRestaurant(result.restaurant)
    });
  } catch (error) {
    if (error instanceof MerchantDbError) {
      return NextResponse.json({ error: error.code }, { status: error.status });
    }

    console.error("[merchant_auth] database_connection_failed", { reason: error instanceof Error ? error.name : "unknown" });
    return NextResponse.json({ error: "database_connection_failed" }, { status: 503 });
  }
}
