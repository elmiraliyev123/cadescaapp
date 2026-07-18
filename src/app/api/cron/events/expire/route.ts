import { NextResponse } from "next/server";

import { expireEventReservations } from "@/lib/server/eventTickets";

export const runtime = "nodejs";

export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET;
  const authorization = request.headers.get("authorization");
  if (!secret || authorization !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  try {
    const expired = await expireEventReservations(null);
    return NextResponse.json({ ok: true, expired });
  } catch (error) {
    console.error("[events_cron] expiration_failed", {
      reason: error instanceof Error ? error.name : "unknown"
    });
    return NextResponse.json({ error: "expiration_failed" }, { status: 500 });
  }
}

