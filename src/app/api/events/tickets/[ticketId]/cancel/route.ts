import { NextResponse } from "next/server";

import { eventApiErrorResponse, eventMutationForbiddenResponse, eventMutationOriginAllowed } from "@/lib/server/eventRoute";
import { cancelEventTicket } from "@/lib/server/eventTickets";

export const runtime = "nodejs";

export async function POST(request: Request, { params }: { params: Promise<{ ticketId: string }> }) {
  if (!eventMutationOriginAllowed(request)) return eventMutationForbiddenResponse();
  const { ticketId } = await params;
  try {
    await cancelEventTicket(ticketId);
    return NextResponse.json({ ok: true });
  } catch (error) {
    return eventApiErrorResponse(error);
  }
}

