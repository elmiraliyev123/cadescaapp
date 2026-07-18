import { NextResponse } from "next/server";

import { eventApiErrorResponse, eventMutationForbiddenResponse, eventMutationOriginAllowed } from "@/lib/server/eventRoute";
import { reserveEventTicket } from "@/lib/server/eventTickets";
import { assertRateLimit } from "@/lib/server/rateLimit";
import { getRequestIp } from "@/lib/server/turnstile";

export const runtime = "nodejs";

export async function POST(request: Request, { params }: { params: Promise<{ eventId: string }> }) {
  if (!eventMutationOriginAllowed(request)) return eventMutationForbiddenResponse();
  const { eventId } = await params;
  const body = (await request.json().catch(() => ({}))) as { paymentMethod?: string | null };

  try {
    await assertRateLimit({
      namespace: "event_ticket_reserve_ip",
      identifier: getRequestIp(request) || "unknown",
      limit: 20,
      windowSeconds: 60
    });
    const ticket = await reserveEventTicket(eventId, body.paymentMethod);
    return NextResponse.json({ ok: true, ticket });
  } catch (error) {
    return eventApiErrorResponse(error);
  }
}

