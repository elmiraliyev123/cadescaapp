import { NextResponse } from "next/server";

import { withSharedCookieDomain } from "@/lib/cookieDomain";
import { USER_SESSION_COOKIE } from "@/lib/server/userSession";
import { createSupabaseRouteHandlerClient } from "@/lib/supabase/route";

export const runtime = "nodejs";

export async function POST() {
  const response = NextResponse.json({ ok: true });

  try {
    const supabase = await createSupabaseRouteHandlerClient(response);
    await supabase.auth.signOut({ scope: "local" });
  } catch (error) {
    console.warn("[auth_logout] supabase_sign_out_unavailable", {
      reason: error instanceof Error ? error.name : "unknown"
    });
  }

  response.cookies.set(USER_SESSION_COOKIE, "", withSharedCookieDomain({
    httpOnly: true,
    maxAge: 0,
    path: "/",
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production"
  }));

  return response;
}
