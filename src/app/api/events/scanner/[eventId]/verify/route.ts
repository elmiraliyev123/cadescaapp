import { NextResponse } from "next/server";

import { EventAdmissionError, previewEventAdmission } from "@/lib/server/eventAdmission";
import { eventMutationForbiddenResponse, eventMutationOriginAllowed } from "@/lib/server/eventRoute";
import { RateLimitError, assertRateLimit, rateLimitResponseHeaders } from "@/lib/server/rateLimit";
import { getRequestIp } from "@/lib/server/turnstile";

export const runtime = "nodejs";

export async function POST(request: Request, { params }: { params: Promise<{ eventId: string }> }) {
  if (!eventMutationOriginAllowed(request)) return eventMutationForbiddenResponse();
  const { eventId } = await params;
  const body = (await request.json().catch(() => ({}))) as { qr?: string };
  if (!body.qr || body.qr.length > 1024) return NextResponse.json({ error: "invalid_qr" }, { status: 400 });
  try {
    await assertRateLimit({
      namespace: "event_scanner_verify_ip",
      identifier: getRequestIp(request) || "unknown",
      limit: 180,
      windowSeconds: 60
    });
    const preview = await previewEventAdmission(eventId, body.qr);
    return NextResponse.json({ ok: true, preview });
  } catch (error) {
    if (error instanceof RateLimitError) {
      return NextResponse.json({ error: "rate_limited" }, { status: 429, headers: rateLimitResponseHeaders(error) });
    }
    if (error instanceof EventAdmissionError) return NextResponse.json({ error: error.code }, { status: error.status });
    return NextResponse.json({ error: "scan_failed" }, { status: 500 });
  }
}

