import { NextResponse } from "next/server";

import { eventApiErrorResponse, eventMutationForbiddenResponse, eventMutationOriginAllowed } from "@/lib/server/eventRoute";
import { arrangeCashPayment } from "@/lib/server/eventTickets";
import { assertRateLimit } from "@/lib/server/rateLimit";
import { getRequestIp } from "@/lib/server/turnstile";

export const runtime = "nodejs";

export async function POST(request: Request, { params }: { params: Promise<{ ticketId: string }> }) {
  if (!eventMutationOriginAllowed(request)) return eventMutationForbiddenResponse();
  const { ticketId } = await params;
  try {
    await assertRateLimit({
      namespace: "event_cash_arrange_ip",
      identifier: getRequestIp(request) || "unknown",
      limit: 20,
      windowSeconds: 60 * 60
    });
    const body = (await request.json().catch(() => ({}))) as { deadline?: string | null };
    const arrangement = await arrangeCashPayment(ticketId, body.deadline);
    return NextResponse.json({ ok: true, ...arrangement });
  } catch (error) {
    return eventApiErrorResponse(error);
  }
}
