import { NextResponse } from "next/server";

import { EventAdmissionError, searchEventAttendees } from "@/lib/server/eventAdmission";

export const runtime = "nodejs";

export async function GET(request: Request, { params }: { params: Promise<{ eventId: string }> }) {
  const { eventId } = await params;
  const query = new URL(request.url).searchParams.get("q") || "";
  try {
    const attendees = await searchEventAttendees(eventId, query);
    return NextResponse.json({ ok: true, attendees });
  } catch (error) {
    if (error instanceof EventAdmissionError) return NextResponse.json({ error: error.code }, { status: error.status });
    return NextResponse.json({ error: "search_unavailable" }, { status: 500 });
  }
}

