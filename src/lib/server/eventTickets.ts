import "server-only";

import crypto from "node:crypto";

import type { EventTicketView, PaymentMethod } from "@/lib/events/types";
import { getCurrentStudentContext, isVerifiedUniversityStudent } from "@/lib/server/social";
import { getCurrentUserTicket } from "@/lib/server/events";
import { getReadyPool } from "@/lib/server/users";
import { getSupabaseAdminClient } from "@/lib/supabase/admin";

const RECEIPT_BUCKET = "event-receipts";
const MAX_RECEIPT_BYTES = 8 * 1024 * 1024;
const RECEIPT_MIME_EXTENSIONS: Record<string, string> = {
  "application/pdf": "pdf",
  "image/jpeg": "jpg",
  "image/jpg": "jpg",
  "image/png": "png",
  "image/webp": "webp"
};

export type EventTicketErrorCode =
  | "authentication_required"
  | "verified_student_required"
  | "event_not_found"
  | "event_unavailable"
  | "ticket_not_found"
  | "duplicate_ticket_request"
  | "no_places_available"
  | "reservation_expired"
  | "invalid_payment_method"
  | "payment_not_available"
  | "payment_evidence_required"
  | "payment_evidence_invalid"
  | "payment_evidence_too_large"
  | "payment_evidence_upload_failed"
  | "refund_required"
  | "ticket_transition_invalid"
  | "finance_access_denied"
  | "rate_limited"
  | "internal_server_error";

export class EventTicketError extends Error {
  code: EventTicketErrorCode;
  status: number;

  constructor(code: EventTicketErrorCode, status = 400) {
    super(code);
    this.name = "EventTicketError";
    this.code = code;
    this.status = status;
  }
}

type TicketFunctionRow = {
  ticket_id?: string;
  id?: string;
  reservation_status?: string;
  request_status?: string;
  payment_status?: string;
  ticket_status?: string;
  reservation_expires_at?: Date | string | null;
};

function normalizePaymentMethod(value: string | null | undefined): PaymentMethod | null {
  if (!value) return null;
  if (value === "bank_transfer" || value === "cash" || value === "free") return value;
  throw new EventTicketError("invalid_payment_method", 422);
}

function normalizeFunctionError(error: unknown): EventTicketError {
  if (error instanceof EventTicketError) return error;
  const message = error instanceof Error ? error.message.toLowerCase() : "";
  const mappings: Array<[RegExp, EventTicketErrorCode, number]> = [
    [/duplicate|already.*ticket|ticket.*exists/, "duplicate_ticket_request", 409],
    [/no[_ ]places|sold[_ ]out|capacity/, "no_places_available", 409],
    [/reservation.*expired|expired.*reservation/, "reservation_expired", 410],
    [/payment.*method|invalid.*payment/, "invalid_payment_method", 422],
    [/payment.*unavailable|bank.*disabled|cash.*disabled/, "payment_not_available", 422],
    [/finance.*denied|finance.*required|club.*access/, "finance_access_denied", 403],
    [/ticket.*not.*found/, "ticket_not_found", 404],
    [/event.*not.*found/, "event_not_found", 404],
    [/event.*unavailable|event.*cancelled|event.*completed/, "event_unavailable", 409],
    [/refund.*required/, "refund_required", 409],
    [/transition|invalid.*status|not.*pending/, "ticket_transition_invalid", 409]
  ];
  const match = mappings.find(([pattern]) => pattern.test(message));
  if (match) return new EventTicketError(match[1], match[2]);
  console.error("[event_tickets] operation_failed", {
    reason: error instanceof Error ? error.name : "unknown"
  });
  return new EventTicketError("internal_server_error", 500);
}

async function requireVerifiedStudent() {
  const user = await getCurrentStudentContext();
  if (!user) throw new EventTicketError("authentication_required", 401);
  if (!isVerifiedUniversityStudent(user)) throw new EventTicketError("verified_student_required", 403);
  return user;
}

async function requireActiveUser() {
  const user = await getCurrentStudentContext();
  if (!user || user.status !== "active") throw new EventTicketError("authentication_required", 401);
  return user;
}

function functionTicketId(row: TicketFunctionRow | undefined) {
  return row?.ticket_id || row?.id || null;
}

export async function reserveEventTicket(eventId: string, requestedMethod?: string | null): Promise<EventTicketView> {
  const user = await requireVerifiedStudent();
  const method = normalizePaymentMethod(requestedMethod);
  const pool = await getReadyPool();

  try {
    const result = await pool.query<TicketFunctionRow>(
      `select * from private.reserve_event_ticket($1::uuid, $2::text, $3::text)`,
      [eventId, user.id, method]
    );
    const ticketId = functionTicketId(result.rows[0]);
    if (!ticketId) throw new EventTicketError("internal_server_error", 500);
    const ticket = await getCurrentUserTicket(ticketId);
    if (!ticket) throw new EventTicketError("ticket_not_found", 404);
    return ticket;
  } catch (error) {
    throw normalizeFunctionError(error);
  }
}

function receiptExtension(file: File) {
  if (!file.size) throw new EventTicketError("payment_evidence_required", 422);
  if (file.size > MAX_RECEIPT_BYTES) throw new EventTicketError("payment_evidence_too_large", 413);
  const extension = RECEIPT_MIME_EXTENSIONS[file.type.toLowerCase()];
  if (!extension) throw new EventTicketError("payment_evidence_invalid", 415);
  return extension;
}

async function receiptLooksValid(file: File, extension: string) {
  const bytes = new Uint8Array(await file.slice(0, 16).arrayBuffer());
  if (extension === "pdf") {
    return Buffer.from(bytes.subarray(0, 5)).toString("ascii") === "%PDF-";
  }
  if (extension === "jpg") return bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff;
  if (extension === "png") return bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4e && bytes[3] === 0x47;
  if (extension === "webp") {
    return Buffer.from(bytes.subarray(0, 4)).toString("ascii") === "RIFF" && Buffer.from(bytes.subarray(8, 12)).toString("ascii") === "WEBP";
  }
  return false;
}

export async function submitBankTransferEvidence(input: {
  ticketId: string;
  paymentReference?: string | null;
  receipt: File;
}): Promise<EventTicketView> {
  const user = await requireVerifiedStudent();
  const extension = receiptExtension(input.receipt);
  if (!(await receiptLooksValid(input.receipt, extension))) throw new EventTicketError("payment_evidence_invalid", 415);
  const paymentReference = (input.paymentReference || "").trim().slice(0, 140) || null;
  const pool = await getReadyPool();

  const ownership = await pool.query<{ id: string; event_id: string }>(
    `select id, event_id
       from public.event_tickets
      where id = $1::uuid and user_id = $2
      limit 1`,
    [input.ticketId, user.id]
  );
  const ownedTicket = ownership.rows[0];
  if (!ownedTicket) throw new EventTicketError("ticket_not_found", 404);

  const objectPath = `${ownedTicket.event_id}/${input.ticketId}/${crypto.randomUUID()}.${extension}`;
  const { error: uploadError } = await getSupabaseAdminClient().storage.from(RECEIPT_BUCKET).upload(objectPath, input.receipt, {
    cacheControl: "0",
    contentType: input.receipt.type,
    upsert: false
  });
  if (uploadError) throw new EventTicketError("payment_evidence_upload_failed", 502);

  try {
    await pool.query(
      `select * from private.submit_event_payment($1::uuid, $2::text, $3::text, $4::text)`,
      [input.ticketId, user.id, paymentReference, objectPath]
    );
  } catch (error) {
    await getSupabaseAdminClient().storage.from(RECEIPT_BUCKET).remove([objectPath]).catch(() => undefined);
    throw normalizeFunctionError(error);
  }

  const ticket = await getCurrentUserTicket(input.ticketId);
  if (!ticket) throw new EventTicketError("ticket_not_found", 404);
  return ticket;
}

export async function arrangeCashPayment(ticketId: string, requestedDeadline?: string | null) {
  const actor = await requireActiveUser();
  const pool = await getReadyPool();
  let deadline: string | null = null;
  if (requestedDeadline) {
    const deadlineMs = new Date(requestedDeadline).getTime();
    if (!Number.isFinite(deadlineMs) || deadlineMs <= Date.now()) {
      throw new EventTicketError("payment_not_available", 422);
    }
    deadline = new Date(deadlineMs).toISOString();
  }
  try {
    const result = await pool.query<{ cash_payment_deadline?: Date | string | null }>(
      `select * from private.arrange_cash_payment($1::uuid, $2::text, $3::timestamptz)`,
      [ticketId, actor.id, deadline]
    );
    const safeDeadline = result.rows[0]?.cash_payment_deadline;
    return { cashPaymentDeadline: safeDeadline ? new Date(safeDeadline).toISOString() : null };
  } catch (error) {
    throw normalizeFunctionError(error);
  }
}

export type FinanceReviewAction = "approve" | "reject" | "clarify" | "confirm_cash" | "approve_free" | "refund";

export async function reviewEventTicket(input: {
  ticketId: string;
  action: FinanceReviewAction;
  message?: string | null;
}) {
  const actor = await requireActiveUser();
  const message = (input.message || "").trim().slice(0, 1000) || null;
  if ((input.action === "reject" || input.action === "clarify") && !message) {
    throw new EventTicketError("ticket_transition_invalid", 422);
  }
  const pool = await getReadyPool();
  try {
    await pool.query(
      `select * from private.review_event_ticket($1::uuid, $2::text, $3::text, $4::text)`,
      [input.ticketId, actor.id, input.action, message]
    );
  } catch (error) {
    throw normalizeFunctionError(error);
  }
}

export async function cancelEventTicket(ticketId: string) {
  const actor = await requireActiveUser();
  const pool = await getReadyPool();
  try {
    await pool.query(
      `select * from private.cancel_event_ticket($1::uuid, $2::text)`,
      [ticketId, actor.id]
    );
  } catch (error) {
    throw normalizeFunctionError(error);
  }
}

export async function expireEventReservations(eventId?: string | null) {
  const pool = await getReadyPool();
  try {
    const result = await pool.query<{ expired_count?: number }>(
      `select * from private.expire_event_reservations($1::uuid)`,
      [eventId || null]
    );
    return Number(result.rows[0]?.expired_count || 0);
  } catch (error) {
    throw normalizeFunctionError(error);
  }
}

export async function loadReceiptForAuthorizedViewer(ticketId: string) {
  const viewer = await requireActiveUser();
  const pool = await getReadyPool();
  const result = await pool.query<{ receipt_url: string | null }>(
    `select ticket.receipt_url
       from public.event_tickets ticket
       join public.events event on event.id = ticket.event_id
      where ticket.id = $1::uuid
        and ticket.receipt_url is not null
        and (
          ticket.user_id = $2
          or exists (
            select 1
              from public.club_memberships membership
             where membership.club_id = event.club_id
               and membership.user_id = $2
               and membership.status = 'active'
               and membership.role in ('club_owner', 'finance_manager')
          )
        )
      limit 1`,
    [ticketId, viewer.id]
  );
  const objectPath = result.rows[0]?.receipt_url;
  if (!objectPath || objectPath.includes("..") || objectPath.startsWith("/")) return null;

  const { data, error } = await getSupabaseAdminClient().storage.from(RECEIPT_BUCKET).download(objectPath);
  if (error || !data) return null;
  const allowedType = data.type === "application/pdf" || data.type.startsWith("image/");
  if (!allowedType) return null;
  return {
    body: await data.arrayBuffer(),
    contentType: data.type,
    size: data.size
  };
}
