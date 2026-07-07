import { NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import {
  createMerchantWithRestaurantInDb,
  MerchantDbError,
  updateMerchantWithRestaurantInDb,
  type MerchantMutationInput
} from "@/lib/server/merchants";

export const runtime = "nodejs";

function jsonError(error: unknown) {
  if (error instanceof MerchantDbError) {
    console.error("[admin_merchants] request_failed", { code: error.code });
    return NextResponse.json({ error: error.code }, { status: error.status });
  }

  console.error("[admin_merchants] merchant_insert_failed", { reason: error instanceof Error ? error.name : "unknown" });
  return NextResponse.json({ error: "merchant_insert_failed" }, { status: 500 });
}

export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => null);
    if (!body || typeof body !== "object") {
      return NextResponse.json({ error: "invalid_payload" }, { status: 400 });
    }

    const input = body as MerchantMutationInput & { isUpdate?: boolean };
    const result = input.isUpdate
      ? await updateMerchantWithRestaurantInDb(input)
      : await createMerchantWithRestaurantInDb(input);

    revalidatePath("/app/admin/merchants");
    revalidatePath("/app/admin/restaurants");
    revalidatePath("/app/merchant");
    revalidatePath("/app/merchant/menu");
    revalidatePath("/app/user/restaurants");
    revalidatePath("/app/user/student-menus");

    return NextResponse.json({
      ok: true,
      merchant: {
        id: result.merchant.id,
        name: result.merchant.name,
        email: result.merchant.email,
        status: result.merchant.status,
        restaurantId: result.merchant.restaurant_id,
        createdAt: result.merchant.created_at,
        updatedAt: result.merchant.updated_at
      },
      restaurant: {
        id: result.restaurant.id,
        ownerMerchantId: result.restaurant.owner_merchant_id,
        name: result.restaurant.name,
        bio: result.restaurant.bio,
        address: result.restaurant.address,
        city: result.restaurant.city,
        country: result.restaurant.country,
        lat: result.restaurant.latitude,
        lng: result.restaurant.longitude,
        phone: result.restaurant.phone,
        openingHours: result.restaurant.opening_hours,
        status: result.restaurant.status,
        studentMenuEligible: result.restaurant.student_menu_enabled,
        cadescaPartner: result.restaurant.cadesca_partner,
        createdAt: result.restaurant.created_at,
        updatedAt: result.restaurant.updated_at
      }
    });
  } catch (error) {
    return jsonError(error);
  }
}
