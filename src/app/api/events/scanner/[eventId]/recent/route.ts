import { NextResponse } from "next/server";

import { EventAdmissionError, listRecentEventCheckIns } from "@/lib/server/eventAdmission";

export const runtime = "nodejs";

export async function GET(_request: Request, { params }: { params: Promise<{ eventId: string }> }) {
  const { eventId } = await params;
  try {
    const scans = await listRecentEventCheckIns(eventId);
    return NextResponse.json({ ok: true, scans });
  } catch (error) {
    if (error instanceof EventAdmissionError) return NextResponse.json({ error: error.code }, { status: error.status });
    return NextResponse.json({ error: "history_unavailable" }, { status: 500 });
  }
}

