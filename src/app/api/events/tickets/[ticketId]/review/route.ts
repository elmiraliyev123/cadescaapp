import { NextResponse } from "next/server";

import { eventApiErrorResponse, eventMutationForbiddenResponse, eventMutationOriginAllowed } from "@/lib/server/eventRoute";
import { reviewEventTicket, type FinanceReviewAction } from "@/lib/server/eventTickets";

export const runtime = "nodejs";

const ACTIONS = new Set<FinanceReviewAction>(["approve", "reject", "clarify", "confirm_cash", "approve_free", "refund"]);

export async function POST(request: Request, { params }: { params: Promise<{ ticketId: string }> }) {
  if (!eventMutationOriginAllowed(request)) return eventMutationForbiddenResponse();
  const { ticketId } = await params;
  const body = (await request.json().catch(() => ({}))) as { action?: FinanceReviewAction; message?: string | null };
  if (!body.action || !ACTIONS.has(body.action)) {
    return NextResponse.json({ error: "ticket_transition_invalid" }, { status: 422 });
  }
  try {
    await reviewEventTicket({ ticketId, action: body.action, message: body.message });
    return NextResponse.json({ ok: true });
  } catch (error) {
    return eventApiErrorResponse(error);
  }
}
