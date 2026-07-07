import { NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { MerchantDbError, resetMerchantPasswordInDb } from "@/lib/server/merchants";

export const runtime = "nodejs";

type ResetPasswordBody = {
  id?: string;
  email?: string;
  password?: string;
  newPassword?: string;
};

export async function POST(request: Request) {
  try {
    const body = (await request.json().catch(() => ({}))) as ResetPasswordBody;
    const { id, email, password, newPassword } = body;

    await resetMerchantPasswordInDb({ id, email, password: newPassword || password });
    revalidatePath("/app/admin/merchants");
    return NextResponse.json({ ok: true });
  } catch (error) {
    if (error instanceof MerchantDbError) {
      console.error("[admin_merchant_reset_password] request_failed", { code: error.code });
      return NextResponse.json({ error: error.code }, { status: error.status });
    }

    console.error("[admin_merchant_reset_password] password_update_failed", { reason: error instanceof Error ? error.name : "unknown" });
    return NextResponse.json({ error: "password_update_failed" }, { status: 500 });
  }
}
