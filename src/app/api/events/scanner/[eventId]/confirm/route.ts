import { NextResponse } from "next/server";

import { confirmEventAdmission, EventAdmissionError } from "@/lib/server/eventAdmission";
import { eventMutationForbiddenResponse, eventMutationOriginAllowed } from "@/lib/server/eventRoute";

export const runtime = "nodejs";

export async function POST(request: Request, { params }: { params: Promise<{ eventId: string }> }) {
  if (!eventMutationOriginAllowed(request)) return eventMutationForbiddenResponse();
  const { eventId } = await params;
  const body = (await request.json().catch(() => ({}))) as { previewToken?: string };
  if (!body.previewToken) return NextResponse.json({ error: "invalid_preview_token" }, { status: 400 });
  try {
    const result = await confirmEventAdmission(body.previewToken, eventId);
    return NextResponse.json({ ok: true, eventId, ...result });
  } catch (error) {
    if (error instanceof EventAdmissionError) return NextResponse.json({ error: error.code }, { status: error.status });
    return NextResponse.json({ error: "admission_unavailable" }, { status: 500 });
  }
}
