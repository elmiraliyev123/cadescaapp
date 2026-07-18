import assert from "node:assert/strict";
import crypto from "node:crypto";

import { Pool, type PoolClient } from "pg";

const databaseUrl = process.env.EVENTS_TEST_DATABASE_URL || "postgresql://postgres:postgres@127.0.0.1:54322/postgres";
const parsedUrl = new URL(databaseUrl);

if (!(["127.0.0.1", "localhost"].includes(parsedUrl.hostname) && parsedUrl.port === "54322")) {
  throw new Error("Events database tests are destructive fixtures and may only run against the local Supabase database on port 54322.");
}

const pool = new Pool({ connectionString: databaseUrl, max: 12 });
const runId = crypto.randomBytes(5).toString("hex");
const universityId = crypto.randomUUID();
const otherUniversityId = crypto.randomUUID();
const universityDomain = `${runId}.events.test`;
const otherUniversityDomain = `${runId}.other-events.test`;
const clubId = crypto.randomUUID();
const pendingClubId = crypto.randomUUID();

const users = {
  owner: `events_owner_${runId}`,
  organizer: `events_organizer_${runId}`,
  finance: `events_finance_${runId}`,
  scanner: `events_scanner_${runId}`,
  unauthorizedScanner: `events_unauthorized_scanner_${runId}`,
  studentOne: `events_student_one_${runId}`,
  studentTwo: `events_student_two_${runId}`,
  suspended: `events_suspended_${runId}`,
  otherUniversity: `events_other_university_${runId}`
};

type TicketState = {
  ticket_id: string;
  reservation_status: string;
  request_status: string;
  payment_status: string;
  ticket_status: string;
};

function futureIso(days: number, hours = 0) {
  return new Date(Date.now() + (days * 24 + hours) * 60 * 60 * 1000).toISOString();
}

async function expectDatabaseError(operation: () => Promise<unknown>, pattern: RegExp, label: string) {
  await assert.rejects(operation, (error: unknown) => {
    const message = error instanceof Error ? error.message : String(error);
    assert.match(message, pattern, label);
    return true;
  });
}

async function withTimeout<T>(operation: Promise<T>, milliseconds: number, label: string) {
  let timeout: NodeJS.Timeout | undefined;
  try {
    return await Promise.race([
      operation,
      new Promise<never>((_, reject) => {
        timeout = setTimeout(() => reject(new Error(`${label} timed out after ${milliseconds}ms`)), milliseconds);
      })
    ]);
  } finally {
    if (timeout) clearTimeout(timeout);
  }
}

async function insertUser(client: PoolClient, input: {
  id: string;
  universityId: string;
  status?: "active" | "suspended";
  verified?: boolean;
}) {
  const username = input.id.replace(/[^a-z0-9_.]/gi, "_").toLowerCase().slice(0, 30);
  await client.query(
    `insert into public.users (
       id, name, email, password_hash, role, status, university_name,
       university_domain, student_status, student_menu_access, email_verified,
       accepted_terms_at, verified_via, university_id, verified_at, username,
       display_name, public_profile_enabled, suspended_at
     ) values (
       $1, $2, $3, 'local-test-only', 'user', $4, 'Events Test University',
       $10, $5, $6, true, now(), $7, $8::uuid,
       case when $6 then now() else null end, $9, $2, true,
       case when $4 = 'suspended' then now() else null end
     )`,
    [
      input.id,
      input.id,
      `${input.id}@events.test`,
      input.status || "active",
      input.verified === false ? "not_verified" : "verified",
      input.verified !== false,
      input.verified === false ? "email" : "ocr",
      input.universityId,
      username,
      input.universityId === universityId ? universityDomain : otherUniversityDomain
    ]
  );
}

async function insertEvent(client: PoolClient, input: {
  clubId?: string;
  universityId?: string;
  capacity?: number;
  isFree?: boolean;
  freeMode?: "automatic" | "organizer_approval";
  payment?: "bank_transfer" | "cash";
  status?: string;
  suffix: string;
}) {
  const id = crypto.randomUUID();
  const isFree = input.isFree ?? false;
  const payment = input.payment || "bank_transfer";
  await client.query(
    `insert into public.events (
       id, club_id, university_id, title, slug, description, location,
       start_at, end_at, timezone, ticket_price, currency, is_free, capacity,
       ticket_request_deadline, bank_transfer_enabled, cash_payment_enabled,
       free_ticket_mode, iban, iban_account_name, payment_instructions,
       refund_policy, status, published_at, created_by, updated_by
     ) values (
       $1::uuid, $2::uuid, $3::uuid, $4, $5, $6, 'Main Hall',
       $7::timestamptz, $8::timestamptz, 'Europe/Istanbul', $9, 'TRY', $10, $11,
       $12::timestamptz, $13, $14, $15, $16, $17, 'Use the event title as reference.',
       'Refunds are reviewed before the event.', $18, case when $18 in ('published', 'sold_out') then now() else null end,
       $19, $19
     )`,
    [
      id,
      input.clubId || clubId,
      input.universityId || universityId,
      `Events database test ${input.suffix}`,
      `events-db-${runId}-${input.suffix}`,
      "A production-grade database test event with enough detail for validation.",
      futureIso(7),
      futureIso(7, 2),
      isFree ? 0 : 250,
      isFree,
      input.capacity || 1,
      futureIso(6),
      !isFree && payment === "bank_transfer",
      !isFree && payment === "cash",
      input.freeMode || "automatic",
      !isFree && payment === "bank_transfer" ? "TR330006100519786457841326" : null,
      !isFree && payment === "bank_transfer" ? "Cadesca Events Test" : null,
      input.status || "published",
      users.owner
    ]
  );
  return id;
}

async function reserve(eventId: string, userId: string, method: string | null) {
  const result = await pool.query<TicketState>(
    `select * from private.reserve_event_ticket($1::uuid, $2::text, $3::text)`,
    [eventId, userId, method]
  );
  return result.rows[0];
}

async function seed() {
  const client = await pool.connect();
  try {
    await client.query("begin");
    await client.query(
      `insert into public.universities (
         id, slug, name, university_email_domain, email_domains, status
       ) values
         ($1::uuid, $2, 'Events Test University', $5, array[$5]::text[], 'active'),
         ($3::uuid, $4, 'Other Events Test University', $6, array[$6]::text[], 'active')`,
      [
        universityId,
        `events-test-${runId}`,
        otherUniversityId,
        `other-events-test-${runId}`,
        universityDomain,
        otherUniversityDomain
      ]
    );

    await insertUser(client, { id: users.owner, universityId });
    await insertUser(client, { id: users.organizer, universityId });
    await insertUser(client, { id: users.finance, universityId });
    await insertUser(client, { id: users.scanner, universityId });
    await insertUser(client, { id: users.unauthorizedScanner, universityId });
    await insertUser(client, { id: users.studentOne, universityId });
    await insertUser(client, { id: users.studentTwo, universityId });
    await insertUser(client, { id: users.suspended, universityId, status: "suspended" });
    await insertUser(client, { id: users.otherUniversity, universityId: otherUniversityId });

    await client.query(
      `insert into public.student_clubs (
         id, university_id, name, slug, description, official_email, contact_email,
         website_url, instagram_url, verification_document_url, status,
         approved_at, approved_by
       ) values
         ($1::uuid, $2::uuid, 'Events Test Club', $3,
          'An approved student organization used only for local Events database tests.',
          'club@events.test', 'owner@events.test', 'https://events.test',
          'https://instagram.com/events_test', 'tests/recognition.pdf', 'approved', now(), 'local-test'),
         ($4::uuid, $2::uuid, 'Pending Events Test Club', $5,
          'A pending student organization used only for local authorization tests.',
          'pending@events.test', 'owner@events.test', 'https://events.test',
          'https://instagram.com/events_test', 'tests/pending-recognition.pdf', 'pending_review', null, null)`,
      [clubId, universityId, `events-test-club-${runId}`, pendingClubId, `pending-events-test-club-${runId}`]
    );

    await client.query(
      `insert into public.club_memberships (
         club_id, user_id, role, status, accepted_at, invited_at, invited_by
       ) values
         ($1::uuid, $2, 'club_owner', 'active', now(), now(), $2),
         ($1::uuid, $3, 'event_organizer', 'active', now(), now(), $2),
         ($1::uuid, $4, 'finance_manager', 'active', now(), now(), $2),
         ($1::uuid, $5, 'door_scanner', 'active', now(), now(), $2),
         ($1::uuid, $6, 'door_scanner', 'active', now(), now(), $2)`,
      [clubId, users.owner, users.organizer, users.finance, users.scanner, users.unauthorizedScanner]
    );
    await client.query("commit");
  } catch (error) {
    await client.query("rollback");
    throw error;
  } finally {
    client.release();
  }
}

async function run() {
  await seed();
  const client = await pool.connect();
  try {
    await client.query(
      `update public.club_memberships
          set status = 'invited', accepted_at = null
        where club_id = $1::uuid and user_id = $2 and role = 'event_organizer'`,
      [clubId, users.organizer]
    );
    await client.query(
      `update public.club_memberships
          set status = 'active', accepted_at = now()
        where club_id = $1::uuid and user_id = $2 and role = 'event_organizer'`,
      [clubId, users.organizer]
    );
    const roleAssignedAudit = await client.query<{ count: number }>(
      `select count(*)::int as count
         from public.event_audit_logs
        where club_id = $1::uuid
          and actor_user_id = $2
          and action = 'role_assigned'
          and metadata ->> 'role' = 'event_organizer'`,
      [clubId, users.organizer]
    );
    assert.equal(roleAssignedAudit.rows[0]?.count, 1, "activating an invitation emits the exact role_assigned action");

    const finalSlotEvent = await insertEvent(client, { suffix: "final-slot", capacity: 1 });
    const finalSlotAttempts = await Promise.allSettled([
      reserve(finalSlotEvent, users.studentOne, "bank_transfer"),
      reserve(finalSlotEvent, users.studentTwo, "bank_transfer")
    ]);
    assert.equal(finalSlotAttempts.filter((item) => item.status === "fulfilled").length, 1, "exactly one final-slot request succeeds");
    assert.equal(finalSlotAttempts.filter((item) => item.status === "rejected").length, 1, "the competing final-slot request is rejected");
    const rejectedRace = finalSlotAttempts.find((item): item is PromiseRejectedResult => item.status === "rejected");
    assert.match(String(rejectedRace?.reason?.message || rejectedRace?.reason), /no_places_available/);
    const raceCount = await client.query<{ count: number }>(
      `select count(*)::int as count from public.event_tickets where event_id = $1::uuid`,
      [finalSlotEvent]
    );
    assert.equal(raceCount.rows[0]?.count, 1);
    const requestAuditActions = await client.query<{ action: string; count: number }>(
      `select action, count(*)::int as count
         from public.event_audit_logs
        where event_id = $1::uuid
          and action in ('ticket_requested', 'reservation_created')
        group by action
        order by action`,
      [finalSlotEvent]
    );
    assert.deepEqual(requestAuditActions.rows, [
      { action: "reservation_created", count: 1 },
      { action: "ticket_requested", count: 1 }
    ], "ticket request and reservation creation are distinct audited transitions");

    const heldEvent = await insertEvent(client, { suffix: "held-review", capacity: 1 });
    const heldTicket = await reserve(heldEvent, users.studentOne, "bank_transfer");
    await pool.query(
      `select * from private.submit_event_payment($1::uuid, $2, 'bank-reference', 'tests/receipt.pdf')`,
      [heldTicket.ticket_id, users.studentOne]
    );
    const heldState = await client.query<TicketState & { reservation_expires_at: Date | null }>(
      `select id as ticket_id, reservation_status, request_status, payment_status, ticket_status, reservation_expires_at
         from public.event_tickets where id = $1::uuid`,
      [heldTicket.ticket_id]
    );
    assert.equal(heldState.rows[0]?.reservation_status, "held_for_review");
    assert.equal(heldState.rows[0]?.payment_status, "under_review");
    assert.equal(heldState.rows[0]?.reservation_expires_at, null, "organizer review is not limited to 30 minutes");
    await expectDatabaseError(
      () => reserve(heldEvent, users.studentTwo, "bank_transfer"),
      /no_places_available/,
      "held-for-review requests consume capacity"
    );
    await pool.query(
      `select * from private.review_event_ticket($1::uuid, $2, 'reject', 'Receipt could not be verified.')`,
      [heldTicket.ticket_id, users.finance]
    );
    const rejectedReleaseAudit = await client.query<{ count: number }>(
      `select count(*)::int as count
         from public.event_audit_logs
        where ticket_id = $1::uuid and action = 'reservation_released'`,
      [heldTicket.ticket_id]
    );
    assert.equal(rejectedReleaseAudit.rows[0]?.count, 1, "rejecting a held request emits reservation_released");
    const reopened = await reserve(heldEvent, users.studentTwo, "bank_transfer");
    await pool.query(
      `select * from private.submit_event_payment($1::uuid, $2, 'second-reference', 'tests/receipt-two.pdf')`,
      [reopened.ticket_id, users.studentTwo]
    );
    await pool.query(
      `select * from private.review_event_ticket($1::uuid, $2, 'approve', null)`,
      [reopened.ticket_id, users.finance]
    );
    const approved = await client.query<TicketState>(
      `select id as ticket_id, reservation_status, request_status, payment_status, ticket_status
         from public.event_tickets where id = $1::uuid`,
      [reopened.ticket_id]
    );
    assert.equal(approved.rows[0]?.ticket_status, "active");
    assert.equal(approved.rows[0]?.payment_status, "approved");
    await pool.query(
      `select * from private.review_event_ticket($1::uuid, $2, 'refund', 'approved refund')`,
      [reopened.ticket_id, users.finance]
    );
    const refunded = await client.query<{ ticket_status: string; payment_status: string; reservation_status: string }>(
      `select ticket_status, payment_status, reservation_status from public.event_tickets where id = $1::uuid`,
      [reopened.ticket_id]
    );
    assert.deepEqual(refunded.rows[0], {
      ticket_status: "refunded",
      payment_status: "refunded",
      reservation_status: "released"
    });

    const expiredEvent = await insertEvent(client, { suffix: "expiration" });
    const expiredTicket = await reserve(expiredEvent, users.studentOne, "bank_transfer");
    await client.query(
      `update public.event_tickets set reservation_expires_at = now() - interval '1 second' where id = $1::uuid`,
      [expiredTicket.ticket_id]
    );
    await pool.query(`select * from private.expire_event_reservations($1::uuid)`, [expiredEvent]);
    const expiredState = await client.query<{ reservation_status: string; request_status: string; ticket_status: string }>(
      `select reservation_status, request_status, ticket_status from public.event_tickets where id = $1::uuid`,
      [expiredTicket.ticket_id]
    );
    assert.deepEqual(expiredState.rows[0], {
      reservation_status: "expired",
      request_status: "expired",
      ticket_status: "expired"
    });
    const expiredReleaseAudit = await client.query<{ count: number }>(
      `select count(*)::int as count
         from public.event_audit_logs
        where ticket_id = $1::uuid and action = 'reservation_released'`,
      [expiredTicket.ticket_id]
    );
    assert.equal(expiredReleaseAudit.rows[0]?.count, 1, "expiry emits reservation_released alongside reservation_expired");
    await expectDatabaseError(
      () => pool.query(
        `select * from private.submit_event_payment($1::uuid, $2, 'late-reference', 'tests/late.pdf')`,
        [expiredTicket.ticket_id, users.studentOne]
      ),
      /reservation_expired|payment_method_unavailable/,
      "expired reservations cannot upload evidence"
    );

    const cashEvent = await insertEvent(client, { suffix: "cash", payment: "cash" });
    const cashTicket = await reserve(cashEvent, users.studentOne, "cash");
    await expectDatabaseError(
      () => pool.query(
        `select * from private.arrange_cash_payment($1::uuid, $2, now() + interval '2 hours')`,
        [cashTicket.ticket_id, users.studentOne]
      ),
      /finance_access_denied/,
      "students cannot accept their own cash arrangement"
    );
    await pool.query(
      `select * from private.arrange_cash_payment($1::uuid, $2, null)`,
      [cashTicket.ticket_id, users.organizer]
    );
    await pool.query(
      `select * from private.review_event_ticket($1::uuid, $2, 'confirm_cash', null)`,
      [cashTicket.ticket_id, users.finance]
    );
    const cashState = await client.query<{ ticket_status: string; payment_status: string }>(
      `select ticket_status, payment_status from public.event_tickets where id = $1::uuid`,
      [cashTicket.ticket_id]
    );
    assert.deepEqual(cashState.rows[0], { ticket_status: "active", payment_status: "approved" });

    const cashExpiryEvent = await insertEvent(client, { suffix: "cash-expiry", payment: "cash" });
    const cashExpiryTicket = await reserve(cashExpiryEvent, users.studentOne, "cash");
    await pool.query(
      `select * from private.arrange_cash_payment($1::uuid, $2, now() + interval '2 hours')`,
      [cashExpiryTicket.ticket_id, users.finance]
    );
    await client.query(
      `update public.event_tickets set cash_payment_deadline = now() - interval '1 second' where id = $1::uuid`,
      [cashExpiryTicket.ticket_id]
    );
    await pool.query(`select * from private.expire_event_reservations($1::uuid)`, [cashExpiryEvent]);
    const cashExpired = await client.query<{ ticket_status: string; reservation_status: string }>(
      `select ticket_status, reservation_status from public.event_tickets where id = $1::uuid`,
      [cashExpiryTicket.ticket_id]
    );
    assert.deepEqual(cashExpired.rows[0], { ticket_status: "expired", reservation_status: "expired" });

    const suspendedSubmitEvent = await insertEvent(client, { suffix: "suspended-submit" });
    const suspendedSubmitTicket = await reserve(suspendedSubmitEvent, users.studentOne, "bank_transfer");
    const suspendedCashEvent = await insertEvent(client, { suffix: "suspended-cash", payment: "cash" });
    const suspendedCashTicket = await reserve(suspendedCashEvent, users.studentTwo, "cash");
    await client.query(
      `update public.student_clubs
          set status = 'suspended', suspended_at = now(), suspension_reason = 'local regression test'
        where id = $1::uuid`,
      [clubId]
    );
    await expectDatabaseError(
      () => pool.query(
        `select * from private.submit_event_payment($1::uuid, $2, 'blocked', 'tests/suspended.pdf')`,
        [suspendedSubmitTicket.ticket_id, users.studentOne]
      ),
      /event_unavailable/,
      "suspended clubs cannot accept bank evidence"
    );
    await expectDatabaseError(
      () => pool.query(
        `select * from private.arrange_cash_payment($1::uuid, $2, now() + interval '2 hours')`,
        [suspendedCashTicket.ticket_id, users.finance]
      ),
      /event_unavailable/,
      "suspended clubs cannot arrange cash payment"
    );
    await client.query(
      `update public.student_clubs
          set status = 'approved', suspended_at = null, suspended_by = null, suspension_reason = null
        where id = $1::uuid`,
      [clubId]
    );

    const suspendedClubReviewEvent = await insertEvent(client, { suffix: "suspended-club-review" });
    const suspendedClubReviewTicket = await reserve(suspendedClubReviewEvent, users.studentOne, "bank_transfer");
    await pool.query(
      `select * from private.submit_event_payment($1::uuid, $2, 'club-suspend', 'tests/club-suspend.pdf')`,
      [suspendedClubReviewTicket.ticket_id, users.studentOne]
    );
    await client.query(
      `update public.student_clubs
          set status = 'suspended', suspended_at = now(), suspension_reason = 'local regression test'
        where id = $1::uuid`,
      [clubId]
    );
    await expectDatabaseError(
      () => pool.query(
        `select * from private.review_event_ticket($1::uuid, $2, 'approve', null)`,
        [suspendedClubReviewTicket.ticket_id, users.finance]
      ),
      /event_unavailable/,
      "suspended clubs cannot approve payment"
    );
    await client.query(
      `update public.student_clubs
          set status = 'approved', suspended_at = null, suspended_by = null, suspension_reason = null
        where id = $1::uuid`,
      [clubId]
    );

    const suspendedMemberReviewEvent = await insertEvent(client, { suffix: "suspended-member-review" });
    const suspendedMemberReviewTicket = await reserve(suspendedMemberReviewEvent, users.studentTwo, "bank_transfer");
    await pool.query(
      `select * from private.submit_event_payment($1::uuid, $2, 'member-suspend', 'tests/member-suspend.pdf')`,
      [suspendedMemberReviewTicket.ticket_id, users.studentTwo]
    );
    await client.query(
      `update public.club_memberships set status = 'suspended' where club_id = $1::uuid and user_id = $2`,
      [clubId, users.finance]
    );
    await expectDatabaseError(
      () => pool.query(
        `select * from private.review_event_ticket($1::uuid, $2, 'approve', null)`,
        [suspendedMemberReviewTicket.ticket_id, users.finance]
      ),
      /finance_access_denied/,
      "suspended finance memberships cannot approve payment"
    );
    await client.query(
      `update public.club_memberships set status = 'active' where club_id = $1::uuid and user_id = $2`,
      [clubId, users.finance]
    );

    const cancelledApprovalEvent = await insertEvent(client, { suffix: "cancelled-approval" });
    const cancelledApprovalTicket = await reserve(cancelledApprovalEvent, users.studentOne, "bank_transfer");
    await pool.query(
      `select * from private.submit_event_payment($1::uuid, $2, 'cancelled', 'tests/cancelled.pdf')`,
      [cancelledApprovalTicket.ticket_id, users.studentOne]
    );
    await client.query(`update public.events set status = 'cancelled' where id = $1::uuid`, [cancelledApprovalEvent]);
    await expectDatabaseError(
      () => pool.query(
        `select * from private.review_event_ticket($1::uuid, $2, 'approve', null)`,
        [cancelledApprovalTicket.ticket_id, users.finance]
      ),
      /event_unavailable/,
      "cancelled events cannot approve payment"
    );
    await client.query(
      `update public.event_tickets
          set ticket_status = 'revoked', refund_required_at = now()
        where id = $1::uuid`,
      [cancelledApprovalTicket.ticket_id]
    );
    await pool.query(
      `select * from private.review_event_ticket($1::uuid, $2, 'refund', 'event cancelled')`,
      [cancelledApprovalTicket.ticket_id, users.finance]
    );
    const cancellationRefund = await client.query<{
      ticket_status: string;
      payment_status: string;
      refund_required_at: Date | null;
    }>(
      `select ticket_status, payment_status, refund_required_at
         from public.event_tickets where id = $1::uuid`,
      [cancelledApprovalTicket.ticket_id]
    );
    assert.deepEqual(cancellationRefund.rows[0], {
      ticket_status: "refunded",
      payment_status: "refunded",
      refund_required_at: null
    });

    const completedApprovalEvent = await insertEvent(client, { suffix: "completed-approval" });
    const completedApprovalTicket = await reserve(completedApprovalEvent, users.studentTwo, "bank_transfer");
    await pool.query(
      `select * from private.submit_event_payment($1::uuid, $2, 'completed', 'tests/completed.pdf')`,
      [completedApprovalTicket.ticket_id, users.studentTwo]
    );
    await client.query(`update public.events set status = 'completed' where id = $1::uuid`, [completedApprovalEvent]);
    await expectDatabaseError(
      () => pool.query(
        `select * from private.review_event_ticket($1::uuid, $2, 'approve', null)`,
        [completedApprovalTicket.ticket_id, users.finance]
      ),
      /event_unavailable/,
      "completed events cannot approve payment"
    );
    await client.query(
      `update public.event_tickets
          set ticket_status = 'revoked', refund_required_at = now()
        where id = $1::uuid`,
      [completedApprovalTicket.ticket_id]
    );
    await pool.query(
      `select * from private.review_event_ticket($1::uuid, $2, 'reject', 'No settled payment was found.')`,
      [completedApprovalTicket.ticket_id, users.finance]
    );
    const cancellationRejection = await client.query<{ ticket_status: string; refund_required_at: Date | null }>(
      `select ticket_status, refund_required_at from public.event_tickets where id = $1::uuid`,
      [completedApprovalTicket.ticket_id]
    );
    assert.deepEqual(cancellationRejection.rows[0], { ticket_status: "rejected", refund_required_at: null });

    const closedDeadlineEvent = await insertEvent(client, { suffix: "closed-request-deadline" });
    const closedDeadlineTicket = await reserve(closedDeadlineEvent, users.studentOne, "bank_transfer");
    await client.query(
      `update public.events set ticket_request_deadline = now() - interval '1 minute' where id = $1::uuid`,
      [closedDeadlineEvent]
    );
    await expectDatabaseError(
      () => pool.query(
        `select * from private.submit_event_payment($1::uuid, $2, 'late', 'tests/late-deadline.pdf')`,
        [closedDeadlineTicket.ticket_id, users.studentOne]
      ),
      /event_unavailable/,
      "initial payment evidence cannot be submitted after the event request deadline"
    );

    const lockOrderEventOne = await insertEvent(client, { suffix: "lock-order-one" });
    const lockOrderEventTwo = await insertEvent(client, { suffix: "lock-order-two" });
    const lockOrderTicketOne = await reserve(lockOrderEventOne, users.studentOne, "bank_transfer");
    const lockOrderTicketTwo = await reserve(lockOrderEventTwo, users.studentTwo, "bank_transfer");
    await Promise.all([
      pool.query(
        `select * from private.submit_event_payment($1::uuid, $2, 'lock-one', 'tests/lock-one.pdf')`,
        [lockOrderTicketOne.ticket_id, users.studentOne]
      ),
      pool.query(
        `select * from private.submit_event_payment($1::uuid, $2, 'lock-two', 'tests/lock-two.pdf')`,
        [lockOrderTicketTwo.ticket_id, users.studentTwo]
      )
    ]);
    await withTimeout(
      Promise.all([
        pool.query(`select * from private.expire_event_reservations(null::uuid)`),
        pool.query(
          `select * from private.review_event_ticket($1::uuid, $2, 'reject', 'lock order regression')`,
          [lockOrderTicketOne.ticket_id, users.finance]
        ),
        pool.query(
          `select * from private.review_event_ticket($1::uuid, $2, 'reject', 'lock order regression')`,
          [lockOrderTicketTwo.ticket_id, users.finance]
        )
      ]),
      8_000,
      "concurrent cron and per-event review"
    );

    const freeAutomaticEvent = await insertEvent(client, { suffix: "free-auto", isFree: true });
    const freeAutomatic = await reserve(freeAutomaticEvent, users.studentOne, "free");
    assert.equal(freeAutomatic.ticket_status, "active");
    assert.equal(freeAutomatic.payment_status, "not_required");

    const freeApprovalEvent = await insertEvent(client, {
      suffix: "free-approval",
      isFree: true,
      freeMode: "organizer_approval"
    });
    const freeApproval = await reserve(freeApprovalEvent, users.studentOne, "free");
    assert.equal(freeApproval.reservation_status, "held_for_review");
    await expectDatabaseError(
      () => pool.query(
        `select * from private.review_event_ticket($1::uuid, $2, 'approve_free', null)`,
        [freeApproval.ticket_id, users.finance]
      ),
      /finance_access_denied/,
      "finance-only roles cannot approve organizer-managed free requests"
    );
    await pool.query(
      `select * from private.review_event_ticket($1::uuid, $2, 'approve_free', null)`,
      [freeApproval.ticket_id, users.owner]
    );
    const freeApproved = await client.query<{ ticket_status: string; request_status: string }>(
      `select ticket_status, request_status from public.event_tickets where id = $1::uuid`,
      [freeApproval.ticket_id]
    );
    assert.deepEqual(freeApproved.rows[0], { ticket_status: "active", request_status: "approved" });

    const freeOrganizerRejectEvent = await insertEvent(client, {
      suffix: "free-organizer-reject",
      isFree: true,
      freeMode: "organizer_approval"
    });
    const freeOrganizerReject = await reserve(freeOrganizerRejectEvent, users.studentTwo, "free");
    await pool.query(
      `select * from private.review_event_ticket($1::uuid, $2, 'reject', 'Organizer declined the request.')`,
      [freeOrganizerReject.ticket_id, users.organizer]
    );
    const freeRejected = await client.query<{ ticket_status: string }>(
      `select ticket_status from public.event_tickets where id = $1::uuid`,
      [freeOrganizerReject.ticket_id]
    );
    assert.equal(freeRejected.rows[0]?.ticket_status, "rejected", "organizers can reject approval-mode free tickets");

    await client.query(
      `update public.events
          set ticket_request_deadline = now() - interval '2 hours',
              start_at = now() - interval '1 hour',
              end_at = now() + interval '2 hours'
        where id = $1::uuid`,
      [freeAutomaticEvent]
    );
    await client.query(
      `insert into public.event_scanner_assignments (club_id, event_id, user_id, assigned_by)
       values ($1::uuid, $2::uuid, $3, $4)`,
      [clubId, freeAutomaticEvent, users.scanner, users.owner]
    );
    const simultaneousCheckIns = await Promise.allSettled([
      pool.query(
        `select * from private.confirm_event_check_in($1::uuid, $2, $3, 'stored')`,
        [freeAutomaticEvent, users.studentOne, users.scanner]
      ),
      pool.query(
        `select * from private.confirm_event_check_in($1::uuid, $2, $3, 'stored')`,
        [freeAutomaticEvent, users.studentOne, users.scanner]
      )
    ]);
    assert.equal(simultaneousCheckIns.filter((item) => item.status === "fulfilled").length, 2);
    const simultaneousResults = simultaneousCheckIns.flatMap((item) => (
      item.status === "fulfilled" ? [String(item.value.rows[0]?.result)] : []
    )).sort();
    assert.deepEqual(simultaneousResults, ["already_checked_in", "entry_confirmed"]);
    const checkInCount = await client.query<{ count: number }>(
      `select count(*)::int as count from public.event_check_ins where event_id = $1::uuid and user_id = $2`,
      [freeAutomaticEvent, users.studentOne]
    );
    assert.equal(checkInCount.rows[0]?.count, 1, "the database records one entry only");
    const duplicateAuditCount = await client.query<{ count: number }>(
      `select count(*)::int as count
         from public.event_audit_logs
        where event_id = $1::uuid and action = 'duplicate_entry_attempted'`,
      [freeAutomaticEvent]
    );
    assert.equal(duplicateAuditCount.rows[0]?.count, 1, "the duplicate attempt audit commits");

    const unauthorizedCheckIn = await pool.query<{ result: string }>(
      `select * from private.confirm_event_check_in($1::uuid, $2, $3, 'manual')`,
      [freeAutomaticEvent, users.studentOne, users.unauthorizedScanner]
    );
    assert.equal(unauthorizedCheckIn.rows[0]?.result, "unauthorized_scanner", "a scanner assignment is event-specific");
    const unauthorizedAuditCount = await client.query<{ count: number }>(
      `select count(*)::int as count
         from public.event_audit_logs
        where event_id = $1::uuid
          and actor_user_id = $2
          and action = 'unauthorized_scan_attempted'`,
      [freeAutomaticEvent, users.unauthorizedScanner]
    );
    assert.equal(unauthorizedAuditCount.rows[0]?.count, 1, "the unauthorized attempt audit commits");

    await client.query(
      `update public.club_memberships
          set status = 'suspended'
        where club_id = $1::uuid and user_id = $2 and role = 'door_scanner'`,
      [clubId, users.scanner]
    );
    const suspendedScannerMembership = await pool.query<{ result: string }>(
      `select * from private.confirm_event_check_in($1::uuid, $2, $3, 'manual')`,
      [freeAutomaticEvent, users.studentOne, users.scanner]
    );
    assert.equal(suspendedScannerMembership.rows[0]?.result, "unauthorized_scanner");
    await client.query(
      `update public.club_memberships
          set status = 'active'
        where club_id = $1::uuid and user_id = $2 and role = 'door_scanner'`,
      [clubId, users.scanner]
    );

    await client.query(
      `update public.users set status = 'suspended', suspended_at = now() where id = $1`,
      [users.scanner]
    );
    const suspendedScannerUser = await pool.query<{ result: string }>(
      `select * from private.confirm_event_check_in($1::uuid, $2, $3, 'manual')`,
      [freeAutomaticEvent, users.studentOne, users.scanner]
    );
    assert.equal(suspendedScannerUser.rows[0]?.result, "unauthorized_scanner");
    await client.query(
      `update public.users set status = 'active', suspended_at = null where id = $1`,
      [users.scanner]
    );
    await expectDatabaseError(
      () => reserve(freeApprovalEvent, users.otherUniversity, "free"),
      /verified_student_required/,
      "cross-university reservations are rejected"
    );
    await expectDatabaseError(
      () => reserve(freeApprovalEvent, users.suspended, "free"),
      /verified_student_required/,
      "suspended users cannot request tickets"
    );

    const pendingClubEvent = await insertEvent(client, {
      suffix: "pending-club",
      clubId: pendingClubId
    });
    await expectDatabaseError(
      () => reserve(pendingClubEvent, users.studentTwo, "bank_transfer"),
      /event_unavailable/,
      "pending clubs cannot create live ticket flows"
    );

    await expectDatabaseError(
      () => insertEvent(client, {
        suffix: "mismatched-university",
        clubId,
        universityId: otherUniversityId
      }),
      /events_club_university_fk/,
      "an event university must match its club"
    );
    await expectDatabaseError(
      () => client.query(
        `insert into public.event_scanner_assignments (club_id, event_id, user_id, assigned_by)
         values ($1::uuid, $2::uuid, $3, $4)`,
        [pendingClubId, freeApprovalEvent, users.scanner, users.owner]
      ),
      /event_scanner_assignments_event_club_fk/,
      "a scanner assignment club must match its event"
    );

    await client.query(
      `insert into public.qr_credential_uses (user_id, kind, counter) values ($1, 'legacy_totp', 42)`,
      [users.studentOne]
    );
    await expectDatabaseError(
      () => client.query(
        `insert into public.qr_credential_uses (user_id, kind, counter) values ($1, 'legacy_totp', 42)`,
        [users.studentOne]
      ),
      /qr_credential_uses_user_id_kind_counter_key/,
      "a legacy TOTP counter can only be consumed once"
    );

    const rlsTables = [
      "student_clubs",
      "club_memberships",
      "club_application_messages",
      "events",
      "event_tickets",
      "qr_credential_uses",
      "event_ticket_clarifications",
      "event_scanner_assignments",
      "event_check_ins",
      "event_audit_logs"
    ];
    const rls = await client.query<{ relname: string; relrowsecurity: boolean }>(
      `select relname, relrowsecurity
         from pg_class
        where relnamespace = 'public'::regnamespace
          and relname = any($1::text[])`,
      [rlsTables]
    );
    assert.equal(rls.rows.length, rlsTables.length);
    assert.ok(rls.rows.every((row) => row.relrowsecurity), "RLS is enabled on every Events table");

    const privileges = await client.query<{
      can_insert_event: boolean;
      can_update_ticket: boolean;
      can_read_receipts: boolean;
      can_reserve_rpc: boolean;
      authenticated_private_usage: boolean;
      service_private_usage: boolean;
      can_read_qr_uses: boolean;
      can_insert_qr_uses: boolean;
      service_can_insert_qr_uses: boolean;
      receipts_public: boolean;
    }>(
      `select
         has_table_privilege('authenticated', 'public.events', 'insert') as can_insert_event,
         has_table_privilege('authenticated', 'public.event_tickets', 'update') as can_update_ticket,
         has_table_privilege('authenticated', 'public.event_tickets', 'select') as can_read_receipts,
         has_function_privilege('authenticated', 'private.reserve_event_ticket(uuid,text,text)', 'execute') as can_reserve_rpc,
         has_schema_privilege('authenticated', 'private', 'usage') as authenticated_private_usage,
         has_schema_privilege('service_role', 'private', 'usage') as service_private_usage,
         has_table_privilege('authenticated', 'public.qr_credential_uses', 'select') as can_read_qr_uses,
         has_table_privilege('authenticated', 'public.qr_credential_uses', 'insert') as can_insert_qr_uses,
         has_table_privilege('service_role', 'public.qr_credential_uses', 'insert') as service_can_insert_qr_uses,
         (select public from storage.buckets where id = 'event-receipts') as receipts_public`
    );
    assert.deepEqual(privileges.rows[0], {
      can_insert_event: false,
      can_update_ticket: false,
      can_read_receipts: false,
      can_reserve_rpc: false,
      authenticated_private_usage: false,
      service_private_usage: true,
      can_read_qr_uses: false,
      can_insert_qr_uses: false,
      service_can_insert_qr_uses: true,
      receipts_public: false
    });

    await expectDatabaseError(
      () => client.query(
        `insert into public.event_audit_logs (action, metadata)
         values ('secret_test', '{"password":"must-not-be-logged"}'::jsonb)`
      ),
      /event_audit_logs_no_secret_keys/,
      "audit metadata rejects secret-bearing keys"
    );
    await expectDatabaseError(
      () => client.query(
        `insert into public.event_audit_logs (action, metadata)
         values ('nested_secret_test', '{"context":{"items":[{"password":"must-not-be-logged"}]}}'::jsonb)`
      ),
      /event_audit_logs_no_secret_keys/,
      "audit metadata rejects recursively nested secret-bearing keys"
    );
    const audit = await client.query<{ id: string }>(
      `select id from public.event_audit_logs order by created_at desc limit 1`
    );
    await expectDatabaseError(
      () => client.query(`update public.event_audit_logs set action = action where id = $1::uuid`, [audit.rows[0]?.id]),
      /event_audit_logs_are_append_only/,
      "audit logs are append-only"
    );

    console.log("Events database, RLS, lifecycle, and concurrency tests passed");
  } finally {
    client.release();
  }
}

run()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await pool.end();
  });
