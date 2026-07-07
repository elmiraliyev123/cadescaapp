import { NextResponse } from "next/server";

import { resetUserPasswordByEmail } from "@/lib/server/users";
import { verifyVerificationCode } from "@/lib/server/verificationCodes";
import { getSupabaseAdminClient } from "@/lib/supabase/admin";

export const runtime = "nodejs";

function strongPassword(value: string) {
  return value.length >= 8 && /[A-Za-z]/.test(value) && /\d/.test(value) && /[^A-Za-z0-9]/.test(value);
}

export async function POST(request: Request) {
  const body = (await request.json().catch(() => ({}))) as {
    email?: string;
    code?: string;
    password?: string;
  };
  const email = body.email?.trim().toLowerCase() || "";
  const code = body.code?.trim() || "";
  const password = body.password || "";

  if (!email || !/^\d{6}$/.test(code) || !strongPassword(password)) {
    return NextResponse.json({ error: "invalid_request" }, { status: 400 });
  }

  const verification = await verifyVerificationCode({
    email,
    code,
    purpose: "password_reset",
    consume: true
  });

  if (verification.status === "expired") {
    return NextResponse.json({ error: "verification_code_expired" }, { status: 410 });
  }
  if (verification.status === "too_many_attempts") {
    return NextResponse.json({ error: "verification_too_many_attempts" }, { status: 429 });
  }
  if (verification.status !== "verified") {
    return NextResponse.json({ error: "verification_code_invalid" }, { status: 400 });
  }

  try {
    const user = await resetUserPasswordByEmail(email, password);

    if (user.auth_user_id) {
      try {
        const { error } = await getSupabaseAdminClient().auth.admin.updateUserById(user.auth_user_id, {
          password
        });
        if (error) throw error;
      } catch (error) {
        console.error("[password_reset] supabase_update_failed", {
          email,
          reason: error instanceof Error ? error.message : "unknown"
        });
      }
    }

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("[password_reset] failed", {
      email,
      reason: error instanceof Error ? error.message : "unknown"
    });
    return NextResponse.json({ error: "reset_failed" }, { status: 500 });
  }
}
