import { NextResponse } from "next/server";

import { getCurrentClubApplication } from "@/lib/server/studentClubs";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const application = await getCurrentClubApplication();
    if (!application) {
      return NextResponse.json({ error: "application_not_found" }, {
        status: 404,
        headers: { "cache-control": "no-store" }
      });
    }
    return NextResponse.json({ ok: true, application }, {
      headers: { "cache-control": "no-store" }
    });
  } catch {
    return NextResponse.json({ error: "internal_server_error" }, {
      status: 500,
      headers: { "cache-control": "no-store" }
    });
  }
}
