import "server-only";

import crypto from "node:crypto";
import { SignJWT, jwtVerify } from "jose";

import type { AdmissionPreview, AdmissionResultCode } from "@/lib/events/types";
import { getCurrentStudentContext } from "@/lib/server/social";
import {
  markStoredQrTokenAsUsed,
  markTotpCredentialAsUsed,
  QrCredentialError,
  type QrCredential,
  verifyQrCredential
} from "@/lib/server/qr";
import { getReadyPool } from "@/lib/server/users";

const PREVIEW_ISSUER = "cadesca-events";
const PREVIEW_AUDIENCE = "cadesca-event-scanner";
const PREVIEW_TTL_SECONDS = 120;

export type EventAdmissionErrorCode =
  | "authentication_required"
  | "unauthorized_scanner"
  | "event_not_found"
  | "invalid_preview_token"
  | "invalid_qr"
  | "admission_unavailable"
  | "internal_server_error";

export class EventAdmissionError extends Error {
  code: EventAdmissionErrorCode;
  status: number;

  constructor(code: EventAdmissionErrorCode, status = 400) {
    super(code);
    this.name = "EventAdmissionError";
    this.code = code;
    this.status = status;
  }
}

type AdmissionRow = {
  event_id: string;
  event_title: string;
  event_status: string;
  event_start_at: Date | string;
  event_end_at: Date | string;
  event_university_id: string;
  student_id: string | null;
  student_display_name: string | null;
  student_username: string | null;
  student_avatar_url: string | null;
  student_university_id: string | null;
  student_university_name: string | null;
  student_status: string | null;
  student_verification_status: string | null;
  ticket_id: string | null;
  reservation_status: string | null;
  reservation_expires_at: Date | string | null;
  request_status: string | null;
  payment_status: string | null;
  ticket_status: string | null;
  checked_in_at: Date | string | null;
  checked_in_by_name: string | null;
};

type ScannerContext = {
  id: string;
  eventId: string;
  eventTitle: string;
  eventStatus: string;
  clubId: string;
  universityId: string;
};

function toIso(value: Date | string | null | undefined) {
  if (!value) return null;
  return value instanceof Date ? value.toISOString() : new Date(value).toISOString();
}

function signingKey() {
  const secret = process.env.AUTH_SECRET;
  if (!secret) throw new EventAdmissionError("internal_server_error", 500);
  return new TextEncoder().encode(secret);
}

async function currentScannerRequired() {
  const user = await getCurrentStudentContext();
  if (!user || user.status !== "active") throw new EventAdmissionError("authentication_required", 401);
  return user;
}

async function scannerContext(
  eventId: string,
  scannerId: string,
  mode: "active" | "preview" = "active"
): Promise<ScannerContext> {
  const pool = await getReadyPool();
  const result = await pool.query<{
    id: string;
    title: string;
    status: string;
    club_id: string;
    university_id: string;
  }>(
    `select event.id, event.title, event.status, event.club_id, event.university_id
       from public.events event
       join public.student_clubs club on club.id = event.club_id
       join public.event_scanner_assignments assignment
         on assignment.event_id = event.id
        and assignment.user_id = $2
        and assignment.revoked_at is null
       join public.club_memberships membership
         on membership.club_id = event.club_id
        and membership.user_id = $2
        and membership.role = 'door_scanner'
        and membership.status = 'active'
       join public.users scanner
         on scanner.id = assignment.user_id
        and scanner.status = 'active'
      where event.id = $1::uuid
        and club.status = 'approved'
        and (
          (
            event.status in ('published', 'sold_out')
            and clock_timestamp() >= event.start_at - interval '6 hours'
            and clock_timestamp() <= event.end_at + interval '2 hours'
          )
          or (
            $3::text = 'preview'
            and event.status in ('cancelled', 'completed')
          )
        )
      limit 1`,
    [eventId, scannerId, mode]
  );
  const row = result.rows[0];
  if (!row) {
    await auditUnauthorizedScan(eventId, scannerId);
    throw new EventAdmissionError("unauthorized_scanner", 403);
  }
  return {
    id: scannerId,
    eventId: row.id,
    eventTitle: row.title,
    eventStatus: row.status,
    clubId: row.club_id,
    universityId: row.university_id
  };
}

async function auditUnauthorizedScan(eventId: string, actorId: string) {
  const pool = await getReadyPool().catch(() => null);
  if (!pool) return;
  await pool.query(
    `insert into public.event_audit_logs (event_id, actor_user_id, action, metadata)
     select event.id, $2, 'unauthorized_scan_attempted', '{}'::jsonb
       from public.events event
      where event.id = $1::uuid`,
    [eventId, actorId]
  ).catch(() => undefined);
}

function admissionResult(row: AdmissionRow): AdmissionResultCode {
  const now = Date.now();
  const eventEnd = new Date(row.event_end_at).getTime();
  if (row.event_status === "cancelled") return "event_cancelled";
  if (row.event_status === "completed" || row.event_status === "archived" || eventEnd < now) return "event_completed";
  if (row.event_status !== "published" && row.event_status !== "sold_out") return "event_cancelled";
  if (!row.student_id) return "invalid_qr";
  if (row.student_status !== "active" || row.student_verification_status !== "verified") return "no_ticket";
  if (!row.student_university_id || row.student_university_id !== row.event_university_id) return "wrong_university";
  if (!row.ticket_id) return "no_ticket";
  if (row.checked_in_at || row.ticket_status === "checked_in") return "already_checked_in";
  if (row.ticket_status === "rejected" || row.request_status === "rejected") return "ticket_rejected";
  if (row.ticket_status === "cancelled" || row.request_status === "cancelled") return "ticket_cancelled";
  if (row.ticket_status === "refunded" || row.payment_status === "refunded") return "ticket_refunded";
  if (
    row.reservation_status === "expired" ||
    row.request_status === "expired" ||
    (row.reservation_status === "active" && row.reservation_expires_at && new Date(row.reservation_expires_at).getTime() <= now)
  ) {
    return "reservation_expired";
  }
  if (row.payment_status === "under_review" || row.payment_status === "clarification_requested") return "payment_under_review";
  if (row.payment_status === "pending" || row.ticket_status === "pending") return "payment_pending";
  if (row.ticket_status === "active" && (row.payment_status === "approved" || row.payment_status === "not_required")) {
    return "valid_ticket";
  }
  return "no_ticket";
}

function mapAdmission(row: AdmissionRow, result: AdmissionResultCode, confirmationToken: string | null): AdmissionPreview {
  const mayDiscloseStudent = Boolean(
    row.ticket_id &&
    row.student_id &&
    row.student_university_id &&
    row.student_university_id === row.event_university_id
  );
  return {
    result,
    eventId: row.event_id,
    eventTitle: row.event_title,
    student: mayDiscloseStudent && row.student_id
      ? {
          id: row.student_id,
          displayName: row.student_display_name || "Cadesca student",
          username: row.student_username,
          avatarUrl: row.student_username && row.student_avatar_url ? `/media/avatar/${encodeURIComponent(row.student_username)}` : null,
          universityName: row.student_university_name
        }
      : null,
    ticketId: row.ticket_id,
    checkedInAt: toIso(row.checked_in_at),
    checkedInByName: row.checked_in_by_name,
    confirmationToken
  };
}

async function loadAdmissionRow(eventId: string, studentId: string): Promise<AdmissionRow | null> {
  const pool = await getReadyPool();
  const result = await pool.query<AdmissionRow>(
    `select
       event.id as event_id,
       event.title as event_title,
       event.status as event_status,
       event.start_at as event_start_at,
       event.end_at as event_end_at,
       event.university_id as event_university_id,
       student.id as student_id,
       coalesce(student.display_name, student.name) as student_display_name,
       student.username as student_username,
       student.avatar_url as student_avatar_url,
       student.university_id as student_university_id,
       university.name as student_university_name,
       student.status as student_status,
       student.student_status as student_verification_status,
       ticket.id as ticket_id,
       ticket.reservation_status,
       ticket.reservation_expires_at,
       ticket.request_status,
       ticket.payment_status,
       ticket.ticket_status,
       ticket.checked_in_at,
       coalesce(scanner.display_name, scanner.name) as checked_in_by_name
     from public.events event
     left join public.users student on student.id = $2
     left join public.universities university on university.id = student.university_id
     left join public.event_tickets ticket on ticket.event_id = event.id and ticket.user_id = student.id
     left join public.users scanner on scanner.id = ticket.checked_in_by
     where event.id = $1::uuid
     limit 1`,
    [eventId, studentId]
  );
  return result.rows[0] || null;
}

async function createConfirmationToken(input: {
  eventId: string;
  ticketId: string;
  studentId: string;
  scannerId: string;
  qrKind: string;
  credential?: QrCredential | null;
}) {
  return new SignJWT({
    type: "event_admission_preview",
    event_id: input.eventId,
    ticket_id: input.ticketId,
    scanner_id: input.scannerId,
    qr_kind: input.qrKind,
    qr_token_id: input.credential?.kind === "stored" ? input.credential.qrTokenId : null,
    wallet_pass_id: input.credential?.kind === "totp" ? input.credential.uniqueWalletPassId : null,
    totp_counter: input.credential?.kind === "totp" ? input.credential.totpCounter : null
  })
    .setProtectedHeader({ alg: "HS256", typ: "JWT" })
    .setIssuer(PREVIEW_ISSUER)
    .setAudience(PREVIEW_AUDIENCE)
    .setSubject(input.studentId)
    .setIssuedAt()
    .setExpirationTime(`${PREVIEW_TTL_SECONDS}s`)
    .setJti(crypto.randomUUID())
    .sign(signingKey());
}

async function auditScan(input: {
  scanner: ScannerContext;
  ticketId: string | null;
  result: AdmissionResultCode;
  qrKind: string;
}) {
  const pool = await getReadyPool();
  await pool.query(
    `insert into public.event_audit_logs (
       university_id, club_id, event_id, ticket_id, actor_user_id, action, metadata
     ) values ($1, $2, $3, $4, $5, 'qr_scanned', jsonb_build_object('result', $6::text, 'qr_kind', $7::text))`,
    [
      input.scanner.universityId,
      input.scanner.clubId,
      input.scanner.eventId,
      input.ticketId,
      input.scanner.id,
      input.result,
      input.qrKind
    ]
  ).catch(() => undefined);
}

function emptyAdmissionRow(scanner: ScannerContext): AdmissionRow {
  return {
    event_id: scanner.eventId,
    event_title: scanner.eventTitle,
    event_status: scanner.eventStatus,
    event_start_at: new Date(),
    event_end_at: new Date(),
    event_university_id: scanner.universityId,
    student_id: null,
    student_display_name: null,
    student_username: null,
    student_avatar_url: null,
    student_university_id: null,
    student_university_name: null,
    student_status: null,
    student_verification_status: null,
    ticket_id: null,
    reservation_status: null,
    reservation_expires_at: null,
    request_status: null,
    payment_status: null,
    ticket_status: null,
    checked_in_at: null,
    checked_in_by_name: null
  };
}

export async function previewEventAdmission(eventId: string, scannedPayload: string): Promise<AdmissionPreview> {
  const scannerUser = await currentScannerRequired();
  const scanner = await scannerContext(eventId, scannerUser.id, "preview");
  if (scanner.eventStatus === "cancelled" || scanner.eventStatus === "completed") {
    const result: AdmissionResultCode = scanner.eventStatus === "cancelled" ? "event_cancelled" : "event_completed";
    await auditScan({ scanner, ticketId: null, result, qrKind: "not_read" });
    return mapAdmission(emptyAdmissionRow(scanner), result, null);
  }
  let credential;
  try {
    credential = await verifyQrCredential(scannedPayload);
  } catch (error) {
    if (error instanceof QrCredentialError) {
      await auditScan({ scanner, ticketId: null, result: "invalid_qr", qrKind: "invalid" });
      return mapAdmission(emptyAdmissionRow(scanner), "invalid_qr", null);
    }
    throw error;
  }

  const row = await loadAdmissionRow(eventId, credential.userId);
  if (!row) throw new EventAdmissionError("event_not_found", 404);
  const result = admissionResult(row);
  const confirmationToken = result === "valid_ticket" && row.ticket_id
    ? await createConfirmationToken({
        eventId,
        ticketId: row.ticket_id,
        studentId: credential.userId,
        scannerId: scannerUser.id,
        qrKind: credential.kind,
        credential
      })
    : null;
  await auditScan({ scanner, ticketId: row.ticket_id, result, qrKind: credential.kind });
  return mapAdmission(row, result, confirmationToken);
}

type PreviewClaims = {
  type?: unknown;
  event_id?: unknown;
  ticket_id?: unknown;
  scanner_id?: unknown;
  qr_kind?: unknown;
  qr_token_id?: unknown;
  wallet_pass_id?: unknown;
  totp_counter?: unknown;
  sub?: string;
};

async function verifyConfirmationToken(token: string): Promise<{
  eventId: string;
  ticketId: string;
  scannerId: string;
  studentId: string;
  qrKind: "stored" | "totp" | "manual";
  qrTokenId: string | null;
  walletPassId: string | null;
  totpCounter: number | null;
}> {
  try {
    const { payload } = await jwtVerify(token, signingKey(), {
      issuer: PREVIEW_ISSUER,
      audience: PREVIEW_AUDIENCE
    });
    const claims = payload as PreviewClaims;
    if (
      claims.type !== "event_admission_preview" ||
      typeof claims.event_id !== "string" ||
      typeof claims.ticket_id !== "string" ||
      typeof claims.scanner_id !== "string" ||
      typeof claims.sub !== "string" ||
      (claims.qr_kind !== "stored" && claims.qr_kind !== "totp" && claims.qr_kind !== "manual") ||
      (claims.qr_kind === "stored" && typeof claims.qr_token_id !== "string") ||
      (claims.qr_kind === "totp" && (
        typeof claims.totp_counter !== "number" ||
        !Number.isSafeInteger(claims.totp_counter) ||
        (claims.wallet_pass_id !== null && typeof claims.wallet_pass_id !== "string")
      ))
    ) {
      throw new Error("invalid_claims");
    }
    return {
      eventId: claims.event_id,
      ticketId: claims.ticket_id,
      scannerId: claims.scanner_id,
      studentId: claims.sub,
      qrKind: claims.qr_kind,
      qrTokenId: claims.qr_kind === "stored" ? claims.qr_token_id as string : null,
      walletPassId: claims.qr_kind === "totp" && typeof claims.wallet_pass_id === "string" ? claims.wallet_pass_id : null,
      totpCounter: claims.qr_kind === "totp" ? claims.totp_counter as number : null
    };
  } catch {
    throw new EventAdmissionError("invalid_preview_token", 400);
  }
}

export async function confirmEventAdmission(previewToken: string, expectedEventId?: string) {
  const scannerUser = await currentScannerRequired();
  const claims = await verifyConfirmationToken(previewToken);
  if (claims.scannerId !== scannerUser.id || (expectedEventId && claims.eventId !== expectedEventId)) {
    throw new EventAdmissionError("invalid_preview_token", 403);
  }
  const pool = await getReadyPool();
  const client = await pool.connect();
  try {
    await client.query("begin");
    const result = await client.query<{ checked_in_at?: Date | string; result?: AdmissionResultCode | "entry_confirmed" }>(
      `select * from private.confirm_event_check_in($1::uuid, $2::text, $3::text, $4::text)`,
      [claims.eventId, claims.studentId, scannerUser.id, claims.qrKind]
    );
    const outcome = result.rows[0]?.result || "entry_confirmed";
    if (outcome === "entry_confirmed") {
      let consumed = true;
      if (claims.qrKind === "stored" && claims.qrTokenId) {
        consumed = await markStoredQrTokenAsUsed(claims.qrTokenId, client);
      } else if (claims.qrKind === "totp" && claims.totpCounter !== null) {
        consumed = await markTotpCredentialAsUsed({
          kind: "totp",
          userId: claims.studentId,
          qrTokenId: null,
          token: "",
          uniqueWalletPassId: claims.walletPassId,
          totpCounter: claims.totpCounter
        }, client);
      }
      if (!consumed) throw new EventAdmissionError("invalid_preview_token", 409);
    }
    await client.query("commit");
    return {
      result: outcome,
      checkedInAt: toIso(result.rows[0]?.checked_in_at)
    };
  } catch (error) {
    await client.query("rollback").catch(() => undefined);
    if (error instanceof EventAdmissionError) throw error;
    const message = error instanceof Error ? error.message.toLowerCase() : "";
    if (/already.*check|checked.*in/.test(message)) {
      const current = await loadAdmissionRow(claims.eventId, claims.studentId);
      return {
        result: "already_checked_in",
        checkedInAt: toIso(current?.checked_in_at)
      };
    }
    if (/unauthorized.*scanner|scanner.*denied/.test(message)) {
      throw new EventAdmissionError("unauthorized_scanner", 403);
    }
    const current = await loadAdmissionRow(claims.eventId, claims.studentId).catch(() => null);
    if (current) {
      const currentResult = admissionResult(current);
      if (currentResult !== "valid_ticket") {
        return { result: currentResult, checkedInAt: toIso(current.checked_in_at) };
      }
    }
    console.error("[event_admission] confirm_failed", {
      reason: error instanceof Error ? error.name : "unknown"
    });
    throw new EventAdmissionError("admission_unavailable", 409);
  } finally {
    client.release();
  }
}

export async function searchEventAttendees(eventId: string, search: string): Promise<AdmissionPreview[]> {
  const scannerUser = await currentScannerRequired();
  await scannerContext(eventId, scannerUser.id);
  const query = search.trim().replace(/^@/, "").slice(0, 80);
  if (query.length < 2) return [];
  const pool = await getReadyPool();
  const users = await pool.query<{ id: string }>(
    `select distinct app_user.id
       from public.event_tickets ticket
       join public.users app_user on app_user.id = ticket.user_id
      where ticket.event_id = $1::uuid
        and (
          app_user.username ilike '%' || $2 || '%'
          or app_user.name ilike '%' || $2 || '%'
          or app_user.display_name ilike '%' || $2 || '%'
        )
      order by app_user.id
      limit 10`,
    [eventId, query]
  );
  const previews: AdmissionPreview[] = [];
  for (const user of users.rows) {
    const row = await loadAdmissionRow(eventId, user.id);
    if (!row) continue;
    const result = admissionResult(row);
    const confirmationToken = result === "valid_ticket" && row.ticket_id
      ? await createConfirmationToken({
          eventId,
          ticketId: row.ticket_id,
          studentId: user.id,
          scannerId: scannerUser.id,
          qrKind: "manual"
        })
      : null;
    previews.push(mapAdmission(row, result, confirmationToken));
  }
  return previews;
}

export async function listRecentEventCheckIns(eventId: string) {
  const scannerUser = await currentScannerRequired();
  await scannerContext(eventId, scannerUser.id);
  const pool = await getReadyPool();
  const result = await pool.query<{
    id: string;
    checked_in_at: Date | string;
    student_display_name: string;
    student_username: string | null;
    scanner_display_name: string;
  }>(
    `select check_in.id,
            check_in.checked_in_at,
            coalesce(student.display_name, student.name) as student_display_name,
            student.username as student_username,
            coalesce(scanner.display_name, scanner.name) as scanner_display_name
       from public.event_check_ins check_in
       join public.users student on student.id = check_in.user_id
       join public.users scanner on scanner.id = check_in.scanner_user_id
      where check_in.event_id = $1::uuid
      order by check_in.checked_in_at desc
      limit 30`,
    [eventId]
  );
  return result.rows.map((row) => ({
    id: row.id,
    checkedInAt: toIso(row.checked_in_at) || "",
    studentDisplayName: row.student_display_name,
    studentUsername: row.student_username,
    scannerDisplayName: row.scanner_display_name
  }));
}
