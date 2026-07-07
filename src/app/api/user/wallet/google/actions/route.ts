import { NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { cookies } from "next/headers";

import { GoogleWalletError, refreshGoogleWalletPass, reissueGoogleWalletPass } from "@/lib/server/googleWallet";
import { RateLimitError, assertRateLimit, rateLimitResponseHeaders } from "@/lib/server/rateLimit";
import { USER_SESSION_COOKIE, verifyUserSessionToken } from "@/lib/server/userSession";

export const runtime = "nodejs";

type GoogleWalletActionBody = {
  action?: "refresh" | "update" | "regenerate";
};

async function requireUserSession() {
  const cookieStore = await cookies();
  const token = cookieStore.get(USER_SESSION_COOKIE)?.value;
  const secret = process.env.AUTH_SECRET;

  if (!token || !secret) return null;

  const session = await verifyUserSessionToken(token, secret);
  return session?.role === "user" ? session : null;
}

export async function POST(request: Request) {
  const session = await requireUserSession();
  if (!session) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const body = (await request.json().catch(() => ({}))) as GoogleWalletActionBody;
  const action = body.action || "refresh";
  if (action !== "refresh" && action !== "update" && action !== "regenerate") {
    return NextResponse.json({ error: "invalid_action" }, { status: 400 });
  }

  try {
    await assertRateLimit({
      namespace: "google_wallet_action",
      identifier: `${session.id}:${action}`,
      limit: 12,
      windowSeconds: 10 * 60
    });

    const pass = action === "regenerate"
      ? await reissueGoogleWalletPass(session.id)
      : await refreshGoogleWalletPass(session.id);

    revalidatePath("/app/user/pass");

    return NextResponse.json({
      ok: true,
      pass: {
        id: pass.id,
        status: pass.status,
        uniqueWalletPassId: pass.unique_wallet_pass_id,
        lastSync: pass.last_sync
      }
    });
  } catch (error) {
    if (error instanceof RateLimitError) {
      return NextResponse.json({ error: "rate_limited" }, { status: 429, headers: rateLimitResponseHeaders(error) });
    }
    if (error instanceof GoogleWalletError) {
      return NextResponse.json({ error: error.code }, { status: error.status });
    }

    console.error("[google_wallet_action] failed", { action, reason: error instanceof Error ? error.name : "unknown" });
    return NextResponse.json({ error: "internal_server_error" }, { status: 500 });
  }
}
