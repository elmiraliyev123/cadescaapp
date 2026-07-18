import { NextResponse } from "next/server";

import { eventApiErrorResponse, eventMutationForbiddenResponse, eventMutationOriginAllowed } from "@/lib/server/eventRoute";
import { submitBankTransferEvidence } from "@/lib/server/eventTickets";
import { assertRateLimit } from "@/lib/server/rateLimit";
import { getRequestIp } from "@/lib/server/turnstile";

export const runtime = "nodejs";

export async function POST(request: Request, { params }: { params: Promise<{ ticketId: string }> }) {
  if (!eventMutationOriginAllowed(request)) return eventMutationForbiddenResponse();
  const { ticketId } = await params;
  try {
    await assertRateLimit({
      namespace: "event_payment_evidence_ip",
      identifier: getRequestIp(request) || "unknown",
      limit: 10,
      windowSeconds: 60 * 60
    });
    const formData = await request.formData();
    const receiptValue = formData.get("receipt");
    if (!(receiptValue instanceof File)) {
      return NextResponse.json({ error: "payment_evidence_required" }, { status: 422 });
    }
    const ticket = await submitBankTransferEvidence({
      ticketId,
      paymentReference: typeof formData.get("paymentReference") === "string" ? String(formData.get("paymentReference")) : null,
      receipt: receiptValue
    });
    return NextResponse.json({ ok: true, ticket });
  } catch (error) {
    return eventApiErrorResponse(error);
  }
}

