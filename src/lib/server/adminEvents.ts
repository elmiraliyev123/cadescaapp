import "server-only";

import { requireAdminSession } from "@/lib/server/adminAuth";
import { getReadyPool } from "@/lib/server/users";

type AdminPaymentStatus = "under_review" | "clarification_requested" | "rejected";
type AdminPaymentMethod = "bank_transfer" | "cash" | "free" | null;
type AdminClubStatus =
  | "pending_review"
  | "clarification_requested"
  | "approved"
  | "rejected"
  | "suspended"
  | "archived";

export type AdminEventsOperationsData = {
  statistics: {
    totalEvents: number;
    pendingReviewEvents: number;
    liveUpcomingEvents: number;
    totalTicketRequests: number;
    approvedTickets: number;
    paymentsNeedingAttention: number;
    checkedInTickets: number;
    refundedTickets: number;
    checkInRate: number;
  };
  paymentQueue: Array<{
    id: string;
    eventTitle: string;
    clubName: string;
    studentName: string;
    studentUsername: string | null;
    amount: number;
    currency: string;
    paymentMethod: AdminPaymentMethod;
    paymentStatus: AdminPaymentStatus;
    submittedAt: string | null;
    clarificationRequestedAt: string | null;
    updatedAt: string;
  }>;
  refundQueue: Array<{
    id: string;
    eventTitle: string;
    clubName: string;
    studentName: string;
    studentUsername: string | null;
    amount: number;
    currency: string;
    paymentMethod: AdminPaymentMethod;
    refundRequiredAt: string | null;
    refundedAt: string | null;
  }>;
  clubMembers: Array<{
    id: string;
    clubName: string;
    status: AdminClubStatus;
    activePeople: number;
    invitedPeople: number;
    suspendedPeople: number;
    ownerAssignments: number;
    organizerAssignments: number;
    financeAssignments: number;
    scannerAssignments: number;
  }>;
  auditLogs: Array<{
    id: string;
    action: string;
    clubName: string | null;
    eventTitle: string | null;
    actorName: string | null;
    createdAt: string;
  }>;
};

function numberValue(value: number | string | null | undefined) {
  const parsed = Number(value || 0);
  return Number.isFinite(parsed) ? parsed : 0;
}

function isoValue(value: Date | string | null | undefined) {
  if (!value) return null;
  return value instanceof Date ? value.toISOString() : new Date(value).toISOString();
}

/**
 * Returns a deliberately narrow admin projection. Sensitive event and payment
 * columns (bank details, receipt paths, payment references, audit metadata,
 * request metadata, and QR material) are never selected from the database.
 */
export async function getAdminEventsOperations(): Promise<AdminEventsOperationsData> {
  await requireAdminSession();
  const pool = await getReadyPool();

  const [statisticsResult, paymentResult, refundResult, memberResult, auditResult] = await Promise.all([
    pool.query<{
      total_events: number | string;
      pending_review_events: number | string;
      live_upcoming_events: number | string;
      total_ticket_requests: number | string;
      approved_tickets: number | string;
      payments_needing_attention: number | string;
      checked_in_tickets: number | string;
      refunded_tickets: number | string;
    }>(
      `select
         (select count(*) from public.events)::int as total_events,
         (select count(*) from public.events where status = 'pending_review')::int as pending_review_events,
         (select count(*)
            from public.events
           where status in ('published', 'sold_out')
             and end_at >= now())::int as live_upcoming_events,
         (select count(*) from public.event_tickets)::int as total_ticket_requests,
         (select count(*)
            from public.event_tickets
           where request_status = 'approved'
             and ticket_status in ('active', 'checked_in'))::int as approved_tickets,
         (select count(*)
           from public.event_tickets
           where payment_status in ('under_review', 'clarification_requested')
              or (refund_required_at is not null and refunded_at is null))::int as payments_needing_attention,
         (select count(*)
            from public.event_tickets
           where ticket_status = 'checked_in')::int as checked_in_tickets,
         (select count(*)
            from public.event_tickets
           where payment_status = 'refunded' or ticket_status = 'refunded')::int as refunded_tickets`
    ),
    pool.query<{
      id: string;
      event_title: string;
      club_name: string;
      student_name: string;
      student_username: string | null;
      amount: number | string;
      currency: string;
      payment_method: AdminPaymentMethod;
      payment_status: AdminPaymentStatus;
      submitted_payment_at: Date | string | null;
      clarification_requested_at: Date | string | null;
      updated_at: Date | string;
    }>(
      `select ticket.id,
              event.title as event_title,
              club.name as club_name,
              coalesce(nullif(btrim(app_user.display_name), ''), nullif(btrim(app_user.name), ''), 'Student') as student_name,
              app_user.username as student_username,
              ticket.amount,
              ticket.currency,
              ticket.payment_method,
              ticket.payment_status,
              ticket.submitted_payment_at,
              ticket.clarification_requested_at,
              ticket.updated_at
         from public.event_tickets ticket
         join public.events event on event.id = ticket.event_id
         join public.student_clubs club on club.id = event.club_id
         join public.users app_user on app_user.id = ticket.user_id
        where ticket.payment_status in ('under_review', 'clarification_requested', 'rejected')
        order by case ticket.payment_status
                   when 'clarification_requested' then 0
                   when 'under_review' then 1
                   else 2
                 end,
                 ticket.updated_at desc
        limit 30`
    ),
    pool.query<{
      id: string;
      event_title: string;
      club_name: string;
      student_name: string;
      student_username: string | null;
      amount: number | string;
      currency: string;
      payment_method: AdminPaymentMethod;
      refund_required_at: Date | string | null;
      refunded_at: Date | string | null;
    }>(
      `select ticket.id,
              event.title as event_title,
              club.name as club_name,
              coalesce(nullif(btrim(app_user.display_name), ''), nullif(btrim(app_user.name), ''), 'Student') as student_name,
              app_user.username as student_username,
              ticket.amount,
              ticket.currency,
              ticket.payment_method,
              ticket.refund_required_at,
              ticket.refunded_at
         from public.event_tickets ticket
         join public.events event on event.id = ticket.event_id
         join public.student_clubs club on club.id = event.club_id
         join public.users app_user on app_user.id = ticket.user_id
        where ticket.refund_required_at is not null
           or ticket.payment_status = 'refunded'
           or ticket.ticket_status = 'refunded'
        order by (ticket.refund_required_at is not null and ticket.refunded_at is null) desc,
                 coalesce(ticket.refund_required_at, ticket.refunded_at, ticket.updated_at) desc
        limit 30`
    ),
    pool.query<{
      id: string;
      club_name: string;
      status: AdminClubStatus;
      active_people: number | string;
      invited_people: number | string;
      suspended_people: number | string;
      owner_assignments: number | string;
      organizer_assignments: number | string;
      finance_assignments: number | string;
      scanner_assignments: number | string;
    }>(
      `select club.id,
              club.name as club_name,
              club.status,
              count(distinct membership.user_id) filter (where membership.status = 'active')::int as active_people,
              count(distinct membership.user_id) filter (where membership.status = 'invited')::int as invited_people,
              count(distinct membership.user_id) filter (where membership.status = 'suspended')::int as suspended_people,
              count(*) filter (where membership.status = 'active' and membership.role = 'club_owner')::int as owner_assignments,
              count(*) filter (where membership.status = 'active' and membership.role = 'event_organizer')::int as organizer_assignments,
              count(*) filter (where membership.status = 'active' and membership.role = 'finance_manager')::int as finance_assignments,
              count(*) filter (where membership.status = 'active' and membership.role = 'door_scanner')::int as scanner_assignments
         from public.student_clubs club
         left join public.club_memberships membership on membership.club_id = club.id
        group by club.id
        order by active_people desc, club.created_at desc
        limit 40`
    ),
    pool.query<{
      id: string;
      action: string;
      club_name: string | null;
      event_title: string | null;
      actor_name: string | null;
      created_at: Date | string;
    }>(
      `select audit.id,
              audit.action,
              club.name as club_name,
              event.title as event_title,
              coalesce(nullif(btrim(app_user.display_name), ''), nullif(btrim(app_user.name), '')) as actor_name,
              audit.created_at
         from public.event_audit_logs audit
         left join public.student_clubs club on club.id = audit.club_id
         left join public.events event on event.id = audit.event_id
         left join public.users app_user on app_user.id = audit.actor_user_id
        order by audit.created_at desc
        limit 40`
    )
  ]);

  const stats = statisticsResult.rows[0];
  const approvedTickets = numberValue(stats?.approved_tickets);
  const checkedInTickets = numberValue(stats?.checked_in_tickets);

  return {
    statistics: {
      totalEvents: numberValue(stats?.total_events),
      pendingReviewEvents: numberValue(stats?.pending_review_events),
      liveUpcomingEvents: numberValue(stats?.live_upcoming_events),
      totalTicketRequests: numberValue(stats?.total_ticket_requests),
      approvedTickets,
      paymentsNeedingAttention: numberValue(stats?.payments_needing_attention),
      checkedInTickets,
      refundedTickets: numberValue(stats?.refunded_tickets),
      checkInRate: approvedTickets ? checkedInTickets / approvedTickets : 0
    },
    paymentQueue: paymentResult.rows.map((row) => ({
      id: row.id,
      eventTitle: row.event_title,
      clubName: row.club_name,
      studentName: row.student_name,
      studentUsername: row.student_username,
      amount: numberValue(row.amount),
      currency: row.currency,
      paymentMethod: row.payment_method,
      paymentStatus: row.payment_status,
      submittedAt: isoValue(row.submitted_payment_at),
      clarificationRequestedAt: isoValue(row.clarification_requested_at),
      updatedAt: isoValue(row.updated_at) || new Date(0).toISOString()
    })),
    refundQueue: refundResult.rows.map((row) => ({
      id: row.id,
      eventTitle: row.event_title,
      clubName: row.club_name,
      studentName: row.student_name,
      studentUsername: row.student_username,
      amount: numberValue(row.amount),
      currency: row.currency,
      paymentMethod: row.payment_method,
      refundRequiredAt: isoValue(row.refund_required_at),
      refundedAt: isoValue(row.refunded_at)
    })),
    clubMembers: memberResult.rows.map((row) => ({
      id: row.id,
      clubName: row.club_name,
      status: row.status,
      activePeople: numberValue(row.active_people),
      invitedPeople: numberValue(row.invited_people),
      suspendedPeople: numberValue(row.suspended_people),
      ownerAssignments: numberValue(row.owner_assignments),
      organizerAssignments: numberValue(row.organizer_assignments),
      financeAssignments: numberValue(row.finance_assignments),
      scannerAssignments: numberValue(row.scanner_assignments)
    })),
    auditLogs: auditResult.rows.map((row) => ({
      id: row.id,
      action: row.action,
      clubName: row.club_name,
      eventTitle: row.event_title,
      actorName: row.actor_name,
      createdAt: isoValue(row.created_at) || new Date(0).toISOString()
    }))
  };
}
