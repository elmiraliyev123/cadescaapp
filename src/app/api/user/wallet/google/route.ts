import { NextResponse } from "next/server";
import { cookies } from "next/headers";

import { GoogleWalletError, generateGoogleWalletSaveUrl, getGoogleWalletExpectedIds } from "@/lib/server/googleWallet";
import { RateLimitError, assertRateLimit, rateLimitResponseHeaders } from "@/lib/server/rateLimit";
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
    await assertRateLimit({
      namespace: "google_wallet_save",
      identifier: session.id,
      limit: 10,
      windowSeconds: 10 * 60
    });

    const { saveUrl, pass } = await generateGoogleWalletSaveUrl(session.id);
    console.info("[google_wallet] save_link_generated", {
      expectedIds: getGoogleWalletExpectedIds(),
      classId: pass.google_class_id,
      objectId: pass.google_object_id,
      status: pass.status
    });
    return NextResponse.redirect(saveUrl);
  } catch (error) {
    if (error instanceof RateLimitError) {
      return NextResponse.json({ error: "rate_limited" }, { status: 429, headers: rateLimitResponseHeaders(error) });
    }
    if (error instanceof GoogleWalletError) {
      console.error("[google_wallet] save_link_failed", {
        reason: error.code,
        status: error.status,
        expectedIds: getGoogleWalletExpectedIds(),
        googleApiError: error.googleApiError || null
      });
      return NextResponse.json({ error: error.code }, { status: error.status });
    }

    console.error("[google_wallet] save_link_failed", { reason: error instanceof Error ? error.name : "unknown" });
    return NextResponse.json({ error: "internal_server_error" }, { status: 500 });
  }
}
