import "server-only";

import crypto from "node:crypto";

import type {
  ClubAuditEntry,
  ClubDashboard,
  ClubEventAttendee,
  ClubEventOperations,
  ClubEventSummary,
  ClubFinanceTicket,
  ClubMembershipView,
  ClubRole,
  EventDetail,
  EventDiscoveryItem,
  EventStatus,
  EventTicketView,
  FreeTicketMode,
  EventScannerCandidate,
  ScannerAssignedEvent
} from "@/lib/events/types";
import { assertImageAllowed } from "@/lib/server/imageModeration";
import { getCurrentStudentContext, isVerifiedUniversityStudent, type CurrentStudentContext } from "@/lib/server/social";
import { getReadyPool } from "@/lib/server/users";
import { getSupabaseAdminClient } from "@/lib/supabase/admin";
import {
  CLUB_ROLES,
  hasClubCapability,
  rolesWithClubCapability,
  type ClubCapability
} from "@/lib/clubs/permissions";

const EVENT_ASSET_BUCKET = "event-assets";
const MAX_EVENT_COVER_BYTES = 10 * 1024 * 1024;
const EVENT_IMAGE_EXTENSIONS = new Set(["jpg", "jpeg", "png", "webp", "avif"]);
const EVENT_IMAGE_MIME_EXTENSIONS: Record<string, string> = {
  "image/avif": "avif",
  "image/jpeg": "jpg",
  "image/jpg": "jpg",
  "image/png": "png",
  "image/webp": "webp"
};
const EVENT_ROLES: ClubRole[] = [...CLUB_ROLES];

export type EventsErrorCode =
  | "authentication_required"
  | "verified_student_required"
  | "club_not_found"
  | "club_not_approved"
  | "club_access_denied"
  | "club_member_invalid"
  | "club_member_not_found"
  | "club_membership_not_editable"
  | "finance_access_denied"
  | "scanner_access_denied"
  | "scanner_candidate_invalid"
  | "scanner_assignment_not_editable"
  | "event_not_found"
  | "event_not_editable"
  | "event_invalid"
  | "event_cover_required"
  | "event_image_invalid"
  | "event_image_too_large"
  | "event_image_upload_failed"
  | "capacity_below_confirmed"
  | "database_unavailable";

export class EventsError extends Error {
  code: EventsErrorCode;
  status: number;

  constructor(code: EventsErrorCode, status = 400) {
    super(code);
    this.name = "EventsError";
    this.code = code;
    this.status = status;
  }
}

type EventRow = {
  id: string;
  slug: string;
  club_id: string;
  club_name: string;
  club_slug: string;
  club_logo_url: string | null;
  university_id: string;
  university_name: string;
  title: string;
  short_description: string | null;
  description: string;
  cover_image_url: string | null;
  location: string;
  venue_details: string | null;
  venue_name: string | null;
  venue_address: string | null;
  start_at: Date | string;
  end_at: Date | string;
  timezone: string;
  ticket_price: number | string;
  currency: string;
  is_free: boolean;
  capacity: number;
  available_slots: number;
  ticket_request_deadline: Date | string;
  registration_starts_at: Date | string | null;
  registration_ends_at: Date | string | null;
  bank_transfer_enabled: boolean;
  cash_payment_enabled: boolean;
  free_ticket_mode: FreeTicketMode;
  refund_policy: string;
  age_requirement: number | null;
  status: EventStatus;
  featured_status: EventDiscoveryItem["featuredStatus"];
  featured_until: Date | string | null;
  published_at: Date | string | null;
  moderation_status: "active" | "platform_suspended";
  visibility: "public" | "university" | "private";
  organizer_contact: string | null;
  external_link: string | null;
  tags: string[];
};

type TicketRow = {
  id: string;
  event_id: string;
  event_slug: string;
  event_title: string;
  event_cover_image_url: string | null;
  club_name: string;
  location: string;
  start_at: Date | string;
  end_at: Date | string;
  reservation_status: EventTicketView["reservationStatus"];
  reservation_expires_at: Date | string | null;
  request_status: EventTicketView["requestStatus"];
  payment_method: EventTicketView["paymentMethod"];
  payment_status: EventTicketView["paymentStatus"];
  ticket_status: EventTicketView["ticketStatus"];
  amount: number | string;
  currency: string;
  payment_reference: string | null;
  receipt_url: string | null;
  submitted_payment_at: Date | string | null;
  cash_payment_deadline: Date | string | null;
  clarification_message: string | null;
  refund_required_at: Date | string | null;
  checked_in_at: Date | string | null;
  created_at: Date | string;
  iban_account_name: string | null;
  iban: string | null;
  payment_instructions: string | null;
};

type ClubRow = {
  id: string;
  university_id: string;
  name: string;
  slug: string;
  university_name: string;
  acronym: string | null;
  category: string | null;
  description: string;
  logo_url: string | null;
  cover_image_url: string | null;
  official_email: string;
  contact_email: string;
  website_url: string | null;
  instagram_url: string | null;
  social_links: Record<string, unknown>;
  university_page_url: string | null;
  updated_at: Date | string;
  status: ClubDashboard["club"]["status"];
  rejection_reason: string | null;
  suspension_reason: string | null;
};

export type EventDraftInput = {
  title: string;
  shortDescription?: string | null;
  description: string;
  location: string;
  venueDetails?: string | null;
  venueName?: string | null;
  venueAddress?: string | null;
  startAt: string;
  endAt: string;
  timezone: string;
  ticketPrice: number;
  currency: string;
  isFree: boolean;
  capacity: number;
  ticketRequestDeadline: string;
  registrationStartsAt?: string | null;
  bankTransferEnabled: boolean;
  cashPaymentEnabled: boolean;
  freeTicketMode: FreeTicketMode;
  iban?: string | null;
  ibanAccountName?: string | null;
  paymentInstructions?: string | null;
  refundPolicy: string;
  ageRequirement?: number | null;
  visibility?: "public" | "university" | "private";
  organizerContact?: string | null;
  externalLink?: string | null;
  tags?: string[];
};

function toIso(value: Date | string | null | undefined) {
  if (!value) return null;
  return value instanceof Date ? value.toISOString() : new Date(value).toISOString();
}

function toNumber(value: number | string | null | undefined) {
  const parsed = Number(value || 0);
  return Number.isFinite(parsed) ? parsed : 0;
}

function eventCoverUrl(eventId: string, storedValue: string | null) {
  if (!storedValue) return null;
  if (/^https?:\/\//i.test(storedValue)) return storedValue;
  return `/media/event/${encodeURIComponent(eventId)}`;
}

function clubLogoUrl(clubId: string, storedValue: string | null) {
  if (!storedValue) return null;
  if (/^https?:\/\//i.test(storedValue)) return storedValue;
  return `/media/club/${encodeURIComponent(clubId)}`;
}

function clubCoverUrl(clubId: string, storedValue: string | null) {
  if (!storedValue) return null;
  if (/^https?:\/\//i.test(storedValue)) return storedValue;
  return `/media/club-cover/${encodeURIComponent(clubId)}`;
}

function mapEvent(row: EventRow): EventDiscoveryItem {
  const availableSlots = Math.max(0, Number(row.available_slots));
  return {
    id: row.id,
    slug: row.slug,
    clubId: row.club_id,
    clubName: row.club_name,
    clubSlug: row.club_slug,
    clubLogoUrl: clubLogoUrl(row.club_id, row.club_logo_url),
    title: row.title,
    shortDescription: row.short_description,
    description: row.description,
    coverImageUrl: eventCoverUrl(row.id, row.cover_image_url),
    location: row.location,
    venueDetails: row.venue_details,
    venueName: row.venue_name,
    venueAddress: row.venue_address,
    startAt: toIso(row.start_at) || "",
    endAt: toIso(row.end_at) || "",
    timezone: row.timezone,
    ticketPrice: toNumber(row.ticket_price),
    currency: row.currency,
    isFree: row.is_free,
    capacity: Number(row.capacity),
    availableSlots,
    ticketRequestDeadline: toIso(row.ticket_request_deadline) || "",
    registrationStartsAt: toIso(row.registration_starts_at),
    registrationEndsAt: toIso(row.registration_ends_at),
    bankTransferEnabled: row.bank_transfer_enabled,
    cashPaymentEnabled: row.cash_payment_enabled,
    freeTicketMode: row.free_ticket_mode,
    refundPolicy: row.refund_policy,
    ageRequirement: row.age_requirement,
    status: row.status === "sold_out" && availableSlots > 0 ? "published" : row.status,
    featuredStatus: row.featured_status,
    featuredUntil: toIso(row.featured_until),
    publishedAt: toIso(row.published_at),
    moderationStatus: row.moderation_status,
    visibility: row.visibility,
    organizerContact: row.organizer_contact,
    externalLink: row.external_link,
    tags: row.tags || []
  };
}

function mapTicket(row: TicketRow): EventTicketView {
  const maySeePaymentInstructions = row.payment_method === "bank_transfer"
    && !row.refund_required_at
    && !["rejected", "cancelled", "expired", "revoked", "refunded"].includes(row.ticket_status);
  return {
    id: row.id,
    eventId: row.event_id,
    eventSlug: row.event_slug,
    eventTitle: row.event_title,
    eventCoverImageUrl: eventCoverUrl(row.event_id, row.event_cover_image_url),
    clubName: row.club_name,
    location: row.location,
    startAt: toIso(row.start_at) || "",
    endAt: toIso(row.end_at) || "",
    reservationStatus: row.reservation_status,
    reservationExpiresAt: toIso(row.reservation_expires_at),
    requestStatus: row.request_status,
    paymentMethod: row.payment_method,
    paymentStatus: row.payment_status,
    ticketStatus: row.ticket_status,
    amount: toNumber(row.amount),
    currency: row.currency,
    paymentReference: row.payment_reference,
    receiptAvailable: Boolean(row.receipt_url),
    submittedPaymentAt: toIso(row.submitted_payment_at),
    cashPaymentDeadline: toIso(row.cash_payment_deadline),
    clarificationMessage: row.clarification_message,
    refundRequiredAt: toIso(row.refund_required_at),
    checkedInAt: toIso(row.checked_in_at),
    createdAt: toIso(row.created_at) || "",
    bankAccountName: maySeePaymentInstructions ? row.iban_account_name : null,
    iban: maySeePaymentInstructions ? row.iban : null,
    paymentInstructions: maySeePaymentInstructions ? row.payment_instructions : null
  };
}

function normalizeSearch(value: string | null | undefined) {
  return (value || "").trim().slice(0, 80);
}

function normalizeSlug(value: string) {
  return value
    .trim()
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 72) || "event";
}

async function expireReservationsForUser(userId: string) {
  const pool = await getReadyPool();
  await pool.query(
    `select expiration.expired_count
       from (
         select distinct ticket.event_id
           from public.event_tickets ticket
          where ticket.user_id = $1
            and ticket.ticket_status = 'pending'
            and (
              (ticket.reservation_status = 'active' and ticket.reservation_expires_at <= clock_timestamp())
              or (
                ticket.reservation_status = 'held_for_review'
                and ticket.payment_method = 'cash'
                and ticket.payment_status = 'pending'
                and ticket.cash_payment_deadline is not null
                and ticket.cash_payment_deadline <= clock_timestamp()
              )
            )
          order by ticket.event_id
       ) target
       cross join lateral private.expire_event_reservations(target.event_id) expiration`,
    [userId]
  );
}

async function currentStudentRequired() {
  const user = await getCurrentStudentContext();
  if (!user || user.status !== "active") throw new EventsError("authentication_required", 401);
  return user;
}

async function verifiedStudentRequired() {
  const user = await getCurrentStudentContext();
  if (!isVerifiedUniversityStudent(user)) throw new EventsError("verified_student_required", 403);
  return user;
}

async function activeClubRoles(userId: string, clubId: string) {
  const pool = await getReadyPool();
  const result = await pool.query<{ role: ClubRole }>(
    `select membership.role
       from public.club_memberships membership
       join public.student_clubs club on club.id = membership.club_id
      where membership.club_id = $1
        and membership.user_id = $2
        and membership.status = 'active'
        and club.status = 'approved'
        and membership.role = any($3::text[])`,
    [clubId, userId, EVENT_ROLES]
  );
  return result.rows.map((row) => row.role);
}

async function requireClubCapability(userId: string, clubId: string, capability: ClubCapability) {
  const roles = await activeClubRoles(userId, clubId);
  if (!hasClubCapability(roles, capability)) throw new EventsError("club_access_denied", 403);
  return roles;
}

const EVENT_SELECT = `
  select
    event.id,
    event.slug,
    event.club_id,
    club.name as club_name,
    club.slug as club_slug,
    club.logo_url as club_logo_url,
    event.university_id,
    university.name as university_name,
    event.title,
    event.short_description,
    event.description,
    event.cover_image_url,
    event.location,
    event.venue_details,
    event.venue_name,
    event.venue_address,
    event.start_at,
    event.end_at,
    event.timezone,
    event.ticket_price,
    event.currency,
    event.is_free,
    event.capacity,
    greatest(event.capacity - coalesce(capacity_state.reserved_count, 0), 0)::int as available_slots,
    event.ticket_request_deadline,
    event.registration_starts_at,
    event.registration_ends_at,
    event.bank_transfer_enabled,
    event.cash_payment_enabled,
    event.free_ticket_mode,
    event.refund_policy,
    event.age_requirement,
    event.status,
    event.featured_status,
    event.featured_until,
    event.published_at,
    event.moderation_status,
    event.visibility,
    event.organizer_contact,
    event.external_link,
    event.tags
  from public.events event
  join public.student_clubs club on club.id = event.club_id
  join public.universities university on university.id = event.university_id
  left join lateral (
    select count(*)::int as reserved_count
      from public.event_tickets ticket
     where ticket.event_id = event.id
       and (
         ticket.ticket_status in ('active', 'checked_in')
         or ticket.reservation_status = 'held_for_review'
         or (
           ticket.reservation_status = 'active'
           and ticket.reservation_expires_at is not null
           and ticket.reservation_expires_at > now()
         )
       )
  ) capacity_state on true`;

export async function listDiscoverableEvents(options: {
  query?: string;
  featured?: boolean;
  limit?: number;
  includeSoldOut?: boolean;
} = {}): Promise<EventDiscoveryItem[]> {
  const user = await getCurrentStudentContext();
  if (!isVerifiedUniversityStudent(user)) throw new EventsError("verified_student_required", 403);
  const universityId = user.universityId;
  const query = normalizeSearch(options.query);
  const limit = Math.max(1, Math.min(100, options.limit || 40));
  const pool = await getReadyPool();

  const result = await pool.query<EventRow>(
    `${EVENT_SELECT}
      where club.status = 'approved'
        and event.status = any($1::text[])
        and event.moderation_status = 'active'
        and event.start_at > now()
        and (event.visibility = 'public' or (event.visibility = 'university' and event.university_id = $2::uuid))
        and ($3::text = ''
          or event.title ilike '%' || $3 || '%'
          or event.description ilike '%' || $3 || '%'
          or club.name ilike '%' || $3 || '%'
          or university.name ilike '%' || $3 || '%'
          or event.location ilike '%' || $3 || '%'
          or coalesce(event.venue_name, '') ilike '%' || $3 || '%'
          or coalesce(event.venue_address, '') ilike '%' || $3 || '%'
          or exists (select 1 from unnest(event.tags) tag where tag ilike '%' || $3 || '%'))
        and ($4::boolean = false or (
          event.featured_status = 'approved'
          and event.featured_at is not null
          and (event.featured_until is null or event.featured_until > now())
        ))
      order by
        (event.featured_status = 'approved' and (event.featured_until is null or event.featured_until > now())) desc,
        event.start_at asc
      limit $5`,
    [options.includeSoldOut === false ? ["published"] : ["published", "sold_out"], universityId, query, Boolean(options.featured), limit]
  );

  return result.rows.map(mapEvent);
}

export async function listPublicDiscoverableEvents(options: {
  query?: string;
  featured?: boolean;
  limit?: number;
  includeSoldOut?: boolean;
} = {}): Promise<EventDiscoveryItem[]> {
  const query = normalizeSearch(options.query);
  const limit = Math.max(1, Math.min(100, options.limit || 40));
  const pool = await getReadyPool();
  const result = await pool.query<EventRow>(
    `${EVENT_SELECT}
      where club.status = 'approved'
        and event.status = any($1::text[])
        and event.moderation_status = 'active'
        and event.visibility = 'public'
        and event.start_at > now()
        and ($2::text = ''
          or event.title ilike '%' || $2 || '%'
          or event.description ilike '%' || $2 || '%'
          or club.name ilike '%' || $2 || '%'
          or university.name ilike '%' || $2 || '%'
          or event.location ilike '%' || $2 || '%'
          or coalesce(event.venue_name, '') ilike '%' || $2 || '%'
          or coalesce(event.venue_address, '') ilike '%' || $2 || '%'
          or exists (select 1 from unnest(event.tags) tag where tag ilike '%' || $2 || '%'))
        and ($3::boolean = false or (
          event.featured_status = 'approved'
          and event.featured_at is not null
          and (event.featured_until is null or event.featured_until > now())
        ))
      order by
        (event.featured_status = 'approved' and (event.featured_until is null or event.featured_until > now())) desc,
        event.start_at asc
      limit $4`,
    [options.includeSoldOut === false ? ["published"] : ["published", "sold_out"], query, Boolean(options.featured), limit]
  );
  return result.rows.map(mapEvent);
}

export async function countPublicEventSitemapEntries() {
  const pool = await getReadyPool();
  const result = await pool.query<{ count: number }>(
    `select count(*)::int as count
       from public.events event
       join public.student_clubs club on club.id = event.club_id
      where event.status in ('published', 'sold_out')
        and event.moderation_status = 'active'
        and event.visibility = 'public'
        and club.status = 'approved'
        and event.start_at > now()`
  );
  return Number(result.rows[0]?.count || 0);
}

export async function listPublicEventSitemapEntries(input: { limit: number; offset: number }) {
  const pool = await getReadyPool();
  const result = await pool.query<{ slug: string; updated_at: Date | string }>(
    `select event.slug, event.updated_at
       from public.events event
       join public.student_clubs club on club.id = event.club_id
      where event.status in ('published', 'sold_out')
        and event.moderation_status = 'active'
        and event.visibility = 'public'
        and club.status = 'approved'
        and event.start_at > now()
      order by event.updated_at desc, event.id desc
      limit $1 offset $2`,
    [Math.max(1, Math.min(45_000, input.limit)), Math.max(0, input.offset)]
  );
  return result.rows.map((row) => ({ slug: row.slug, updatedAt: toIso(row.updated_at) }));
}

export async function getDiscoverableEventBySlug(slug: string, publicOnly = false): Promise<EventDetail | null> {
  const user = await getCurrentStudentContext();
  const userId = user?.status === "active" ? user.id : null;
  const universityId = isVerifiedUniversityStudent(user) ? user.universityId : null;
  const pool = await getReadyPool();
  const result = await pool.query<EventRow & {
    already_requested: boolean;
    current_ticket_id: string | null;
    current_ticket_status: EventDetail["currentTicketStatus"];
  }>(
    `${EVENT_SELECT}
      left join lateral (
        select ticket.id, ticket.ticket_status
          from public.event_tickets ticket
         where ticket.event_id = event.id
           and ticket.user_id = $2::text
         limit 1
      ) current_ticket on $2::text is not null
      where event.slug = $1
        and club.status = 'approved'
        and event.status = any($3::text[])
        and event.moderation_status = 'active'
        and (
          (event.visibility = 'public')
          or ($4::boolean = false and $5::uuid is not null and event.visibility = 'university' and event.university_id = $5::uuid)
        )
      limit 1`,
    [slug.trim().toLowerCase(), userId, ["published", "sold_out", "cancelled", "completed"], publicOnly, universityId]
  );

  const row = result.rows[0];
  if (!row) return null;
  if (userId) await expireReservationsForUser(userId);
  const event = mapEvent(row);
  const currentTicket = await pool.query<{ id: string; ticket_status: EventDetail["currentTicketStatus"] }>(
    `select id, ticket_status
       from public.event_tickets
      where event_id = $1 and user_id = $2::text
      limit 1`,
    [row.id, userId]
  ).catch(() => ({ rows: [] as Array<{ id: string; ticket_status: EventDetail["currentTicketStatus"] }> }));

  return {
    ...event,
    universityId: row.university_id,
    universityName: row.university_name,
    alreadyRequested: Boolean(currentTicket.rows[0]),
    currentTicketId: currentTicket.rows[0]?.id || null,
    currentTicketStatus: currentTicket.rows[0]?.ticket_status || null
  };
}

const TICKET_SELECT = `
  select
    ticket.id,
    ticket.event_id,
    event.slug as event_slug,
    event.title as event_title,
    event.cover_image_url as event_cover_image_url,
    club.name as club_name,
    event.location,
    event.start_at,
    event.end_at,
    ticket.reservation_status,
    ticket.reservation_expires_at,
    ticket.request_status,
    ticket.payment_method,
    ticket.payment_status,
    ticket.ticket_status,
    ticket.amount,
    ticket.currency,
    ticket.payment_reference,
    ticket.receipt_url,
    ticket.submitted_payment_at,
    ticket.cash_payment_deadline,
    ticket.clarification_message,
    ticket.refund_required_at,
    ticket.checked_in_at,
    ticket.created_at,
    event.iban_account_name,
    event.iban,
    event.payment_instructions
  from public.event_tickets ticket
  join public.events event on event.id = ticket.event_id
  join public.student_clubs club on club.id = event.club_id`;

export async function listCurrentUserTickets(): Promise<EventTicketView[]> {
  const user = await currentStudentRequired();
  await expireReservationsForUser(user.id);
  const pool = await getReadyPool();
  const result = await pool.query<TicketRow>(
    `${TICKET_SELECT}
      where ticket.user_id = $1
      order by event.start_at asc, ticket.created_at desc`,
    [user.id]
  );
  return result.rows.map(mapTicket);
}

export async function getCurrentUserTicket(ticketId: string): Promise<EventTicketView | null> {
  const user = await currentStudentRequired();
  await expireReservationsForUser(user.id);
  const pool = await getReadyPool();
  const result = await pool.query<TicketRow>(
    `${TICKET_SELECT}
      where ticket.id = $1::uuid and ticket.user_id = $2
      limit 1`,
    [ticketId, user.id]
  );
  return result.rows[0] ? mapTicket(result.rows[0]) : null;
}

async function resolveClubForUser(user: CurrentStudentContext, clubId?: string) {
  const pool = await getReadyPool();
  const result = await pool.query<ClubRow>(
    `select distinct
       club.id,
       club.university_id,
       club.name,
       club.slug,
       university.name as university_name,
       club.acronym,
       club.category,
       club.description,
       club.logo_url,
       club.cover_image_url,
       club.official_email,
       club.contact_email,
       club.website_url,
       club.instagram_url,
       club.social_links,
       club.university_page_url,
       club.updated_at,
       club.status,
       club.rejection_reason,
       club.suspension_reason
     from public.student_clubs club
     join public.club_memberships membership on membership.club_id = club.id
     join public.universities university on university.id = club.university_id
     where membership.user_id = $1
       and membership.status = 'active'
       and club.status = 'approved'
       and ($2::uuid is null or club.id = $2::uuid)
     order by club.created_at asc
     limit 1`,
    [user.id, clubId || null]
  );
  if (!result.rows[0]) throw new EventsError("club_not_found", 404);
  return result.rows[0];
}

export async function getCurrentClubDashboard(
  clubId?: string,
  includePrivateEventConfiguration = false
): Promise<ClubDashboard | null> {
  const user = await currentStudentRequired();
  const club = await resolveClubForUser(user, clubId);
  const roles = await activeClubRoles(user.id, club.id);
  const pool = await getReadyPool();
  const canViewMembers = hasClubCapability(roles, "club.members.view");
  const canManageEvents = hasClubCapability(roles, "club.events.update");

  type MemberRow = {
      id: string;
      user_id: string;
      display_name: string;
      username: string | null;
      role: ClubRole;
      status: ClubMembershipView["status"];
      created_at: Date | string;
  };
  type PrivateEventConfigurationRow = {
    id: string;
    iban: string | null;
    iban_account_name: string | null;
    payment_instructions: string | null;
  };

  const [membersResult, eventsResult, analyticsResult, privateConfigurationResult] = await Promise.all([
    canViewMembers ? pool.query<MemberRow>(
      `select membership.id,
              membership.user_id,
              coalesce(app_user.display_name, app_user.name) as display_name,
              app_user.username,
              membership.role,
              case
                when membership.status = 'invited' and membership.invitation_expires_at <= now() then 'expired'
                else membership.status
              end as status,
              membership.created_at
         from public.club_memberships membership
         join public.users app_user on app_user.id = membership.user_id
        where membership.club_id = $1
          and membership.status <> 'revoked'
        order by app_user.name asc, membership.role asc`,
      [club.id]
    ) : Promise.resolve({ rows: [] as MemberRow[] }),
    pool.query<EventRow & { request_count: number; approved_count: number; checked_in_count: number }>(
      `${EVENT_SELECT}
        where event.club_id = $1
        order by event.created_at desc`,
      [club.id]
    ),
    pool.query<{
      total_requests: number;
      active_reservations: number;
      payment_under_review: number;
      approved_tickets: number;
      rejected_requests: number;
      expired_requests: number;
      checked_in_attendees: number;
      total_capacity: number;
      consumed_capacity: number;
    }>(
      `select
         count(ticket.id)::int as total_requests,
         count(ticket.id) filter (where ticket.reservation_status = 'active' and ticket.reservation_expires_at > now())::int as active_reservations,
         count(ticket.id) filter (where ticket.payment_status = 'under_review')::int as payment_under_review,
         count(ticket.id) filter (where ticket.ticket_status in ('active', 'checked_in'))::int as approved_tickets,
         count(ticket.id) filter (where ticket.request_status = 'rejected')::int as rejected_requests,
         count(ticket.id) filter (where ticket.request_status = 'expired')::int as expired_requests,
         count(ticket.id) filter (where ticket.checked_in_at is not null)::int as checked_in_attendees,
         coalesce((select sum(event.capacity)::int from public.events event where event.club_id = $1 and event.status not in ('cancelled', 'archived')), 0)::int as total_capacity,
         count(ticket.id) filter (
           where ticket.ticket_status in ('active', 'checked_in')
              or ticket.reservation_status = 'held_for_review'
              or (ticket.reservation_status = 'active' and ticket.reservation_expires_at > now())
         )::int as consumed_capacity
       from public.events event
       left join public.event_tickets ticket on ticket.event_id = event.id
       where event.club_id = $1`,
      [club.id]
    ),
    canManageEvents && includePrivateEventConfiguration ? pool.query<PrivateEventConfigurationRow>(
      `select id, iban, iban_account_name, payment_instructions
         from public.events
        where club_id = $1::uuid`,
      [club.id]
    ) : Promise.resolve({ rows: [] as PrivateEventConfigurationRow[] })
  ]);

  const eventIds = eventsResult.rows.map((event) => event.id);
  const perEventCounts = eventIds.length
    ? await pool.query<{ event_id: string; request_count: number; approved_count: number; checked_in_count: number }>(
        `select event_id,
                count(*)::int as request_count,
                count(*) filter (where ticket_status in ('active', 'checked_in'))::int as approved_count,
                count(*) filter (where checked_in_at is not null)::int as checked_in_count
           from public.event_tickets
          where event_id = any($1::uuid[])
          group by event_id`,
        [eventIds]
      )
    : { rows: [] as Array<{ event_id: string; request_count: number; approved_count: number; checked_in_count: number }> };
  const countMap = new Map(perEventCounts.rows.map((row) => [row.event_id, row]));
  const privateConfigurationMap = new Map(privateConfigurationResult.rows.map((row) => [row.id, row]));
  const summary = analyticsResult.rows[0] || {
    total_requests: 0,
    active_reservations: 0,
    payment_under_review: 0,
    approved_tickets: 0,
    rejected_requests: 0,
    expired_requests: 0,
    checked_in_attendees: 0,
    total_capacity: 0,
    consumed_capacity: 0
  };
  const approved = Number(summary.approved_tickets || 0);
  const checkedIn = Number(summary.checked_in_attendees || 0);
  const totalRequests = Number(summary.total_requests || 0);

  return {
    club: {
      id: club.id,
      universityId: club.university_id,
      name: club.name,
      slug: club.slug,
      universityName: club.university_name,
      acronym: club.acronym,
      category: club.category,
      description: club.description,
      logoUrl: clubLogoUrl(club.id, club.logo_url),
      coverImageUrl: clubCoverUrl(club.id, club.cover_image_url),
      officialEmail: club.official_email,
      contactEmail: club.contact_email,
      websiteUrl: club.website_url,
      instagramUrl: club.instagram_url,
      linkedinUrl: typeof club.social_links?.linkedin === "string" ? club.social_links.linkedin : null,
      universityPageUrl: club.university_page_url,
      updatedAt: toIso(club.updated_at) || "",
      status: club.status,
      rejectionReason: club.rejection_reason,
      suspensionReason: club.suspension_reason,
      clarificationMessage: null
    },
    roles,
    members: membersResult.rows.map((row) => ({
      id: row.id,
      userId: row.user_id,
      displayName: row.display_name,
      username: row.username,
      role: row.role,
      status: row.status,
      createdAt: toIso(row.created_at) || ""
    })),
    events: eventsResult.rows.map((row): ClubEventSummary => {
      const counts = countMap.get(row.id);
      const privateConfiguration = privateConfigurationMap.get(row.id);
      return {
        ...mapEvent(row),
        requestCount: Number(counts?.request_count || 0),
        approvedCount: Number(counts?.approved_count || 0),
        checkedInCount: Number(counts?.checked_in_count || 0),
        iban: privateConfiguration?.iban || null,
        ibanAccountName: privateConfiguration?.iban_account_name || null,
        paymentInstructions: privateConfiguration?.payment_instructions || null
      };
    }),
    analytics: {
      totalRequests,
      activeReservations: Number(summary.active_reservations || 0),
      paymentUnderReview: Number(summary.payment_under_review || 0),
      approvedTickets: approved,
      rejectedRequests: Number(summary.rejected_requests || 0),
      expiredRequests: Number(summary.expired_requests || 0),
      checkedInAttendees: checkedIn,
      remainingCapacity: Math.max(0, Number(summary.total_capacity || 0) - Number(summary.consumed_capacity || 0)),
      checkInRate: approved ? checkedIn / approved : 0,
      conversionRate: totalRequests ? approved / totalRequests : 0
    }
  };
}

export async function getCurrentClubDashboardBySlug(
  slugInput: string,
  includePrivateEventConfiguration = false
) {
  const slug = slugInput.trim().toLowerCase();
  if (!/^[a-z0-9](?:[a-z0-9-]{1,90}[a-z0-9])?$/.test(slug)) {
    throw new EventsError("club_not_found", 404);
  }
  const user = await currentStudentRequired();
  const pool = await getReadyPool();
  const result = await pool.query<{ id: string }>(
    `select club.id
       from public.student_clubs club
      where club.slug = $1
        and club.status = 'approved'
        and exists (
          select 1
            from public.club_memberships membership
           where membership.club_id = club.id
             and membership.user_id = $2
             and membership.status = 'active'
        )
      limit 1`,
    [slug, user.id]
  );
  if (!result.rows[0]) throw new EventsError("club_not_found", 404);
  return getCurrentClubDashboard(result.rows[0].id, includePrivateEventConfiguration);
}

export async function getClubEventOperations(eventId: string): Promise<ClubEventOperations> {
  const user = await currentStudentRequired();
  const pool = await getReadyPool();
  const eventResult = await pool.query<{ club_id: string }>(
    `select club_id from public.events where id = $1::uuid limit 1`,
    [eventId]
  );
  const event = eventResult.rows[0];
  if (!event) throw new EventsError("event_not_found", 404);
  const roles = await activeClubRoles(user.id, event.club_id);
  if (!hasClubCapability(roles, "club.events.manage_attendees")) {
    throw new EventsError("club_access_denied", 403);
  }
  const mayViewAudit = hasClubCapability(roles, "club.audit.view");

  const [attendeesResult, scannersResult, auditResult, galleryResult] = await Promise.all([
    pool.query<{
      ticket_id: string;
      display_name: string;
      username: string | null;
      reservation_status: ClubEventAttendee["reservationStatus"];
      request_status: ClubEventAttendee["requestStatus"];
      payment_method: ClubEventAttendee["paymentMethod"];
      payment_status: ClubEventAttendee["paymentStatus"];
      ticket_status: ClubEventAttendee["ticketStatus"];
      cash_payment_deadline: Date | string | null;
      checked_in_at: Date | string | null;
      created_at: Date | string;
    }>(
      `select ticket.id as ticket_id,
              coalesce(app_user.display_name, app_user.name) as display_name,
              app_user.username,
              ticket.reservation_status,
              ticket.request_status,
              ticket.payment_method,
              ticket.payment_status,
              ticket.ticket_status,
              ticket.cash_payment_deadline,
              ticket.checked_in_at,
              ticket.created_at
         from public.event_tickets ticket
         join public.users app_user on app_user.id = ticket.user_id
        where ticket.event_id = $1::uuid
        order by ticket.checked_in_at desc nulls last, ticket.created_at desc
        limit 500`,
      [eventId]
    ),
    pool.query<{
      membership_id: string;
      user_id: string;
      display_name: string;
      username: string | null;
      assigned: boolean;
    }>(
      `select membership.id as membership_id,
              membership.user_id,
              coalesce(app_user.display_name, app_user.name) as display_name,
              app_user.username,
              (assignment.id is not null and assignment.revoked_at is null) as assigned
         from public.club_memberships membership
         join public.users app_user on app_user.id = membership.user_id
         left join public.event_scanner_assignments assignment
           on assignment.event_id = $2::uuid
          and assignment.user_id = membership.user_id
        where membership.club_id = $1::uuid
          and membership.role = 'door_scanner'
          and membership.status = 'active'
        order by app_user.name asc, membership.created_at asc`,
      [event.club_id, eventId]
    ),
    mayViewAudit ? pool.query<{
      id: string;
      action: string;
      actor_display_name: string | null;
      created_at: Date | string;
    }>(
      `select audit.id,
              audit.action,
              coalesce(actor.display_name, actor.name) as actor_display_name,
              audit.created_at
         from public.event_audit_logs audit
         left join public.users actor on actor.id = audit.actor_user_id
        where audit.club_id = $1::uuid
        order by audit.created_at desc
        limit 75`,
      [event.club_id]
    ) : Promise.resolve({ rows: [] as Array<{
      id: string;
      action: string;
      actor_display_name: string | null;
      created_at: Date | string;
    }> }),
    pool.query<{ id: string; object_path: string; alt_text: string | null; sort_order: number }>(
      `select id, object_path, alt_text, sort_order
         from public.event_images
        where event_id = $1::uuid
        order by sort_order asc, created_at asc`,
      [eventId]
    )
  ]);

  const galleryPaths = galleryResult.rows.map((image) => image.object_path);
  const signedGallery = galleryPaths.length
    ? await getSupabaseAdminClient().storage.from(EVENT_ASSET_BUCKET).createSignedUrls(galleryPaths, 60 * 60)
    : { data: [] as Array<{ path: string; signedUrl: string; error: string | null }> };
  const galleryUrls = new Map((signedGallery.data || []).map((entry) => [entry.path, entry.signedUrl]));

  return {
    attendees: attendeesResult.rows.map((row): ClubEventAttendee => ({
      ticketId: row.ticket_id,
      displayName: row.display_name,
      username: row.username,
      reservationStatus: row.reservation_status,
      requestStatus: row.request_status,
      paymentMethod: row.payment_method,
      paymentStatus: row.payment_status,
      ticketStatus: row.ticket_status,
      cashPaymentDeadline: toIso(row.cash_payment_deadline),
      checkedInAt: toIso(row.checked_in_at),
      requestedAt: toIso(row.created_at) || ""
    })),
    scanners: scannersResult.rows.map((row): EventScannerCandidate => ({
      membershipId: row.membership_id,
      userId: row.user_id,
      displayName: row.display_name,
      username: row.username,
      assigned: row.assigned
    })),
    audit: auditResult.rows.map((row): ClubAuditEntry => ({
      id: row.id,
      action: row.action,
      actorDisplayName: row.actor_display_name,
      createdAt: toIso(row.created_at) || ""
    })),
    gallery: galleryResult.rows.flatMap((image) => {
      const url = galleryUrls.get(image.object_path);
      return url ? [{ id: image.id, url, altText: image.alt_text, sortOrder: image.sort_order }] : [];
    })
  };
}

export async function listClubFinanceTickets(clubId?: string): Promise<ClubFinanceTicket[]> {
  const user = await currentStudentRequired();
  const club = await resolveClubForUser(user, clubId);
  const roles = await activeClubRoles(user.id, club.id);
  if (!hasClubCapability(roles, "club.events.manage_finance")) {
    throw new EventsError("finance_access_denied", 403);
  }

  const pool = await getReadyPool();
  const result = await pool.query<{
    id: string;
    event_id: string;
    event_title: string;
    student_display_name: string;
    student_username: string | null;
    amount: number | string;
    currency: string;
    payment_method: ClubFinanceTicket["paymentMethod"];
    payment_status: ClubFinanceTicket["paymentStatus"];
    reservation_status: ClubFinanceTicket["reservationStatus"];
    request_status: ClubFinanceTicket["requestStatus"];
    ticket_status: ClubFinanceTicket["ticketStatus"];
    payment_reference: string | null;
    receipt_url: string | null;
    submitted_payment_at: Date | string | null;
    iban_account_name: string | null;
    iban: string | null;
    payment_instructions: string | null;
    cash_payment_deadline: Date | string | null;
    clarification_message: string | null;
    refund_required_at: Date | string | null;
  }>(
    `select ticket.id,
            event.id as event_id,
            event.title as event_title,
            coalesce(app_user.display_name, app_user.name) as student_display_name,
            app_user.username as student_username,
            ticket.amount,
            ticket.currency,
            ticket.payment_method,
            ticket.payment_status,
            ticket.reservation_status,
            ticket.request_status,
            ticket.ticket_status,
            ticket.payment_reference,
            ticket.receipt_url,
            ticket.submitted_payment_at,
            event.iban_account_name,
            event.iban,
            event.payment_instructions,
            ticket.cash_payment_deadline,
            ticket.clarification_message,
            ticket.refund_required_at
       from public.event_tickets ticket
       join public.events event on event.id = ticket.event_id
       join public.users app_user on app_user.id = ticket.user_id
      where event.club_id = $1
        and ticket.request_status in ('pending', 'submitted', 'approved', 'rejected')
        and ($2::boolean or ticket.payment_method <> 'free')
      order by
        (ticket.payment_status in ('under_review', 'clarification_requested', 'pending')) desc,
        ticket.created_at desc`,
    [club.id, hasClubCapability(roles, "club.events.manage_attendees")]
  );

  return result.rows.map((row) => ({
    id: row.id,
    eventId: row.event_id,
    eventTitle: row.event_title,
    studentDisplayName: row.student_display_name,
    studentUsername: row.student_username,
    amount: toNumber(row.amount),
    currency: row.currency,
    paymentMethod: row.payment_method,
    paymentStatus: row.payment_status,
    reservationStatus: row.reservation_status,
    requestStatus: row.request_status,
    ticketStatus: row.ticket_status,
    paymentReference: row.payment_reference,
    receiptAvailable: Boolean(row.receipt_url),
    submittedPaymentAt: toIso(row.submitted_payment_at),
    bankAccountName: row.iban_account_name,
    iban: row.iban,
    paymentInstructions: row.payment_instructions,
    cashPaymentDeadline: toIso(row.cash_payment_deadline),
    clarificationMessage: row.clarification_message,
    refundRequiredAt: toIso(row.refund_required_at)
  }));
}

export async function listAssignedScannerEvents(clubId?: string): Promise<ScannerAssignedEvent[]> {
  const user = await currentStudentRequired();
  const pool = await getReadyPool();
  const result = await pool.query<{
    id: string;
    title: string;
    club_name: string;
    location: string;
    start_at: Date | string;
    end_at: Date | string;
    status: EventStatus;
    checked_in_count: number;
    approved_count: number;
  }>(
    `select event.id,
            event.title,
            club.name as club_name,
            event.location,
            event.start_at,
            event.end_at,
            event.status,
            count(ticket.id) filter (where ticket.checked_in_at is not null)::int as checked_in_count,
            count(ticket.id) filter (where ticket.ticket_status in ('active', 'checked_in'))::int as approved_count
       from public.events event
       join public.student_clubs club on club.id = event.club_id
       left join public.event_tickets ticket on ticket.event_id = event.id
      where club.status = 'approved'
        and event.status in ('published', 'sold_out')
        and ($2::uuid is null or event.club_id = $2::uuid)
        and event.start_at <= now() + interval '6 hours'
        and event.end_at >= now() - interval '2 hours'
        and (
          exists (
            select 1
              from public.club_memberships owner_membership
             where owner_membership.club_id = event.club_id
               and owner_membership.user_id = $1
               and owner_membership.role = 'club_owner'
               and owner_membership.status = 'active'
          )
          or (
            exists (
              select 1
                from public.club_memberships scanner_membership
               where scanner_membership.club_id = event.club_id
                 and scanner_membership.user_id = $1
                 and scanner_membership.role = 'door_scanner'
                 and scanner_membership.status = 'active'
            )
            and exists (
              select 1
                from public.event_scanner_assignments assignment
               where assignment.event_id = event.id
                 and assignment.user_id = $1
                 and assignment.revoked_at is null
            )
          )
        )
      group by event.id, club.name
      order by event.start_at asc`,
    [user.id, clubId || null]
  );

  return result.rows.map((row) => ({
    id: row.id,
    title: row.title,
    clubName: row.club_name,
    location: row.location,
    startAt: toIso(row.start_at) || "",
    endAt: toIso(row.end_at) || "",
    status: row.status,
    checkedInCount: Number(row.checked_in_count || 0),
    approvedCount: Number(row.approved_count || 0)
  }));
}

function validateEventDraft(input: EventDraftInput) {
  const title = input.title.trim();
  const shortDescription = input.shortDescription?.trim() || null;
  const description = input.description.trim();
  const location = input.location.trim();
  const venueName = input.venueName?.trim() || location;
  const venueAddress = input.venueAddress?.trim() || null;
  const timezone = input.timezone.trim();
  const currency = input.currency.trim().toUpperCase();
  const refundPolicy = input.refundPolicy.trim();
  const startAt = new Date(input.startAt);
  const endAt = new Date(input.endAt);
  const deadline = new Date(input.ticketRequestDeadline);
  const registrationStartsAt = input.registrationStartsAt ? new Date(input.registrationStartsAt) : null;
  const ticketPrice = Number(input.ticketPrice);
  const capacity = Number(input.capacity);
  const ageRequirement = input.ageRequirement === null || input.ageRequirement === undefined ? null : Number(input.ageRequirement);
  const visibility = input.visibility || "university";
  const organizerContact = input.organizerContact?.trim() || null;
  const tags = Array.from(new Set((input.tags || []).map((tag) => tag.trim().toLowerCase()).filter(Boolean))).slice(0, 12);
  let externalLink: string | null = null;
  if (input.externalLink?.trim()) {
    try {
      const parsed = new URL(input.externalLink.trim());
      if (!['http:', 'https:'].includes(parsed.protocol)) throw new Error("invalid_protocol");
      externalLink = parsed.toString();
    } catch {
      throw new EventsError("event_invalid", 422);
    }
  }

  if (
    title.length < 3 || title.length > 140 ||
    (shortDescription !== null && (shortDescription.length < 3 || shortDescription.length > 240)) ||
    description.length < 20 || description.length > 10_000 ||
    location.length < 2 || location.length > 240 ||
    venueName.length > 240 ||
    (venueAddress !== null && venueAddress.length > 500) ||
    !timezone || timezone.length > 80 ||
    !currency || currency.length !== 3 ||
    refundPolicy.length < 5 || refundPolicy.length > 2_000 ||
    !Number.isFinite(startAt.getTime()) || !Number.isFinite(endAt.getTime()) || !Number.isFinite(deadline.getTime()) ||
    (registrationStartsAt !== null && !Number.isFinite(registrationStartsAt.getTime())) ||
    endAt <= startAt || deadline >= startAt ||
    (registrationStartsAt !== null && registrationStartsAt >= deadline) ||
    !Number.isInteger(capacity) || capacity <= 0 || capacity > 100_000 ||
    !Number.isFinite(ticketPrice) || ticketPrice < 0 || ticketPrice > 10_000_000 ||
    (ageRequirement !== null && (!Number.isInteger(ageRequirement) || ageRequirement < 0 || ageRequirement > 99)) ||
    (input.isFree && ticketPrice !== 0) ||
    (!input.isFree && ticketPrice <= 0) ||
    (!input.isFree && !input.bankTransferEnabled && !input.cashPaymentEnabled) ||
    (input.bankTransferEnabled && (!input.iban?.trim() || !input.ibanAccountName?.trim()))
    || !["public", "university", "private"].includes(visibility)
    || (organizerContact !== null && organizerContact.length > 254)
    || tags.some((tag) => tag.length > 40)
  ) {
    throw new EventsError("event_invalid", 422);
  }

  return {
    title,
    shortDescription,
    description,
    location,
    venueDetails: input.venueDetails?.trim() || null,
    venueName,
    venueAddress,
    startAt: startAt.toISOString(),
    endAt: endAt.toISOString(),
    timezone,
    ticketPrice,
    currency,
    isFree: input.isFree,
    capacity,
    ticketRequestDeadline: deadline.toISOString(),
    registrationStartsAt: registrationStartsAt?.toISOString() || null,
    bankTransferEnabled: !input.isFree && input.bankTransferEnabled,
    cashPaymentEnabled: !input.isFree && input.cashPaymentEnabled,
    freeTicketMode: input.freeTicketMode,
    iban: !input.isFree && input.bankTransferEnabled ? input.iban!.replace(/\s+/g, "").toUpperCase() : null,
    ibanAccountName: !input.isFree && input.bankTransferEnabled ? input.ibanAccountName!.trim() : null,
    paymentInstructions: input.paymentInstructions?.trim() || null,
    refundPolicy,
    ageRequirement,
    visibility,
    organizerContact,
    externalLink,
    tags
  };
}

function validateEventCover(file: File) {
  if (!file.size || file.size > MAX_EVENT_COVER_BYTES) throw new EventsError("event_image_too_large", 413);
  const mimeExtension = EVENT_IMAGE_MIME_EXTENSIONS[file.type.toLowerCase()];
  const nameExtension = file.name.split(".").pop()?.toLowerCase() || "";
  const extension = mimeExtension || (EVENT_IMAGE_EXTENSIONS.has(nameExtension) ? nameExtension : "");
  if (!extension) throw new EventsError("event_image_invalid", 415);
  return extension === "jpeg" ? "jpg" : extension;
}

async function uploadEventCover(eventId: string, file: File) {
  const extension = validateEventCover(file);
  await assertImageAllowed(file, "event_cover");
  const objectPath = `events/${eventId}/cover-${crypto.randomUUID()}.${extension}`;
  const { error } = await getSupabaseAdminClient().storage.from(EVENT_ASSET_BUCKET).upload(objectPath, file, {
    cacheControl: "3600",
    contentType: file.type || `image/${extension === "jpg" ? "jpeg" : extension}`,
    upsert: false
  });
  if (error) throw new EventsError("event_image_upload_failed", 502);
  return objectPath;
}

async function uploadEventGalleryObject(eventId: string, file: File) {
  const extension = validateEventCover(file);
  await assertImageAllowed(file, "event_cover");
  const objectPath = `events/${eventId}/gallery-${crypto.randomUUID()}.${extension}`;
  const { error } = await getSupabaseAdminClient().storage.from(EVENT_ASSET_BUCKET).upload(objectPath, file, {
    cacheControl: "3600",
    contentType: file.type || `image/${extension === "jpg" ? "jpeg" : extension}`,
    upsert: false
  });
  if (error) throw new EventsError("event_image_upload_failed", 502);
  return objectPath;
}

export async function addEventGalleryImage(eventId: string, file: File, altTextInput?: string | null) {
  const user = await currentStudentRequired();
  if (!file?.size) throw new EventsError("event_image_invalid", 422);
  const pool = await getReadyPool();
  const eventResult = await pool.query<{ club_id: string; university_id: string; moderation_status: string }>(
    `select club_id, university_id, moderation_status from public.events where id = $1::uuid limit 1`,
    [eventId]
  );
  const event = eventResult.rows[0];
  if (!event) throw new EventsError("event_not_found", 404);
  await requireClubCapability(user.id, event.club_id, "club.events.update");
  if (event.moderation_status !== "active") throw new EventsError("event_not_editable", 409);
  const objectPath = await uploadEventGalleryObject(eventId, file);
  const client = await pool.connect();
  try {
    await client.query("begin");
    const result = await client.query<{ id: string }>(
      `insert into public.event_images (event_id, object_path, alt_text, sort_order, created_by)
       select $1::uuid, $2, $3, coalesce(max(sort_order) + 1, 0), $4
         from public.event_images
        where event_id = $1::uuid
       returning id`,
      [eventId, objectPath, altTextInput?.trim().slice(0, 240) || null, user.id]
    );
    await client.query(
      `insert into public.event_audit_logs (university_id, club_id, event_id, actor_user_id, action, metadata)
       values ($1, $2, $3, $4, 'event_image_added', jsonb_build_object('image_id', $5::text))`,
      [event.university_id, event.club_id, eventId, user.id, result.rows[0]?.id]
    );
    await client.query("commit");
    return result.rows[0]?.id;
  } catch (error) {
    await client.query("rollback").catch(() => undefined);
    await getSupabaseAdminClient().storage.from(EVENT_ASSET_BUCKET).remove([objectPath]).catch(() => undefined);
    throw error;
  } finally {
    client.release();
  }
}

export async function deleteEventGalleryImage(eventId: string, imageId: string) {
  const user = await currentStudentRequired();
  const pool = await getReadyPool();
  const client = await pool.connect();
  let objectPath: string | null = null;
  try {
    await client.query("begin");
    const imageResult = await client.query<{ object_path: string; club_id: string; university_id: string; moderation_status: string }>(
      `select image.object_path, event.club_id, event.university_id, event.moderation_status
         from public.event_images image
         join public.events event on event.id = image.event_id
        where image.id = $1::uuid and image.event_id = $2::uuid
        for update of image`,
      [imageId, eventId]
    );
    const image = imageResult.rows[0];
    if (!image) throw new EventsError("event_not_found", 404);
    const membership = await client.query(
      `select id from public.club_memberships
        where club_id = $1::uuid and user_id = $2 and status = 'active' and role = any($3::text[])
        limit 1 for share`,
      [image.club_id, user.id, rolesWithClubCapability("club.events.update")]
    );
    if (!membership.rows[0]) throw new EventsError("club_access_denied", 403);
    if (image.moderation_status !== "active") throw new EventsError("event_not_editable", 409);
    await client.query(`delete from public.event_images where id = $1::uuid`, [imageId]);
    await client.query(
      `insert into public.event_audit_logs (university_id, club_id, event_id, actor_user_id, action, metadata)
       values ($1, $2, $3, $4, 'event_image_deleted', jsonb_build_object('image_id', $5::text))`,
      [image.university_id, image.club_id, eventId, user.id, imageId]
    );
    await client.query("commit");
    objectPath = image.object_path;
  } catch (error) {
    await client.query("rollback").catch(() => undefined);
    throw error;
  } finally {
    client.release();
  }
  if (objectPath && !objectPath.includes("..") && !objectPath.startsWith("/")) {
    await getSupabaseAdminClient().storage.from(EVENT_ASSET_BUCKET).remove([objectPath]).catch(() => undefined);
  }
}

export async function createEventDraft(clubId: string, input: EventDraftInput, cover?: File | null) {
  const user = await currentStudentRequired();
  const normalized = validateEventDraft(input);
  const pool = await getReadyPool();
  const slug = `${normalizeSlug(normalized.title)}-${crypto.randomUUID().slice(0, 7)}`;
  const client = await pool.connect();
  let eventId: string | null = null;
  let universityId: string | null = null;
  try {
    await client.query("begin");
    const clubResult = await client.query<{ id: string; university_id: string; status: string }>(
      `select id, university_id, status
         from public.student_clubs
        where id = $1::uuid
        for share`,
      [clubId]
    );
    const club = clubResult.rows[0];
    if (!club) throw new EventsError("club_not_found", 404);
    if (club.status !== "approved") throw new EventsError("club_not_approved", 403);
    const membership = await client.query<{ id: string }>(
      `select id
         from public.club_memberships
        where club_id = $1::uuid
          and user_id = $2
          and status = 'active'
          and role = any($3::text[])
        limit 1
        for share`,
      [clubId, user.id, rolesWithClubCapability("club.events.create")]
    );
    if (!membership.rows[0]) throw new EventsError("club_access_denied", 403);

    const result = await client.query<{ id: string }>(
      `insert into public.events (
         club_id, university_id, title, slug, short_description, description, location, venue_details,
         venue_name, venue_address,
         start_at, end_at, timezone, ticket_price, currency, is_free, capacity,
         ticket_request_deadline, bank_transfer_enabled, cash_payment_enabled,
         free_ticket_mode, iban, iban_account_name, payment_instructions, refund_policy,
         age_requirement, registration_starts_at, registration_ends_at, visibility,
         organizer_contact, external_link, tags, status, created_by, updated_by
       ) values (
         $1, $2, $3, $4, $5, $6, $7, $8,
         $9, $10,
         $11, $12, $13, $14, $15, $16, $17,
         $18, $19, $20, $21, $22, $23, $24, $25,
         $26, $27, $18, $28, $29, $30, $31::text[], 'draft', $32, $32
       )
       returning id`,
      [
        clubId,
        club.university_id,
        normalized.title,
        slug,
        normalized.shortDescription,
        normalized.description,
        normalized.location,
        normalized.venueDetails,
        normalized.venueName,
        normalized.venueAddress,
        normalized.startAt,
        normalized.endAt,
        normalized.timezone,
        normalized.ticketPrice,
        normalized.currency,
        normalized.isFree,
        normalized.capacity,
        normalized.ticketRequestDeadline,
        normalized.bankTransferEnabled,
        normalized.cashPaymentEnabled,
        normalized.freeTicketMode,
        normalized.iban,
        normalized.ibanAccountName,
        normalized.paymentInstructions,
        normalized.refundPolicy,
        normalized.ageRequirement,
        normalized.registrationStartsAt,
        normalized.visibility,
        normalized.organizerContact,
        normalized.externalLink,
        normalized.tags,
        user.id
      ]
    );
    eventId = result.rows[0]?.id || null;
    universityId = club.university_id;
    if (!eventId) throw new EventsError("database_unavailable", 503);
    await client.query(
      `insert into public.event_audit_logs (
         university_id, club_id, event_id, actor_user_id, action, metadata
       ) values ($1, $2, $3, $4, 'event_created', '{}'::jsonb)`,
      [universityId, clubId, eventId, user.id]
    );
    await client.query("commit");
  } catch (error) {
    await client.query("rollback").catch(() => undefined);
    throw error;
  } finally {
    client.release();
  }
  if (!eventId || !universityId) throw new EventsError("database_unavailable", 503);

  if (cover?.size) {
    const objectPath = await uploadEventCover(eventId, cover);
    await pool.query(
      `update public.events set cover_image_url = $2, updated_by = $3, updated_at = now() where id = $1`,
      [eventId, objectPath, user.id]
    );
  }

  return { id: eventId, slug };
}

export async function updateEventDraft(eventId: string, input: EventDraftInput, cover?: File | null) {
  const user = await currentStudentRequired();
  const pool = await getReadyPool();
  const eventResult = await pool.query<{ id: string; club_id: string; university_id: string; status: EventStatus; cover_image_url: string | null }>(
    `select id, club_id, university_id, status, cover_image_url from public.events where id = $1 limit 1`,
    [eventId]
  );
  const event = eventResult.rows[0];
  if (!event) throw new EventsError("event_not_found", 404);
  await requireClubCapability(user.id, event.club_id, "club.events.update");
  if (!(["draft", "rejected"] as EventStatus[]).includes(event.status)) throw new EventsError("event_not_editable", 409);
  const normalized = validateEventDraft(input);
  const uploadedObjectPath = cover?.size ? await uploadEventCover(eventId, cover) : null;
  const objectPath = uploadedObjectPath || event.cover_image_url;
  const client = await pool.connect();
  try {
    await client.query("begin");
    const club = await client.query<{ status: string }>(
      `select status from public.student_clubs where id = $1::uuid for share`,
      [event.club_id]
    );
    if (club.rows[0]?.status !== "approved") throw new EventsError("club_not_approved", 403);
    const membership = await client.query<{ id: string }>(
      `select id
         from public.club_memberships
        where club_id = $1::uuid
          and user_id = $2
          and status = 'active'
          and role = any($3::text[])
        limit 1
        for share`,
      [event.club_id, user.id, rolesWithClubCapability("club.events.update")]
    );
    if (!membership.rows[0]) throw new EventsError("club_access_denied", 403);
    const currentEvent = await client.query<{ status: EventStatus; club_id: string }>(
      `select status, club_id from public.events where id = $1::uuid for update`,
      [eventId]
    );
    if (!currentEvent.rows[0] || currentEvent.rows[0].club_id !== event.club_id) {
      throw new EventsError("event_not_found", 404);
    }
    if (!(["draft", "rejected"] as EventStatus[]).includes(currentEvent.rows[0].status)) {
      throw new EventsError("event_not_editable", 409);
    }
    const updated = await client.query(
      `update public.events
          set title = $2,
              short_description = $3,
              description = $4,
              cover_image_url = $5,
              location = $6,
              venue_details = $7,
              venue_name = $8,
              venue_address = $9,
              start_at = $10,
              end_at = $11,
              timezone = $12,
              ticket_price = $13,
              currency = $14,
              is_free = $15,
              capacity = $16,
              ticket_request_deadline = $17,
              registration_starts_at = $18,
              registration_ends_at = $17,
              bank_transfer_enabled = $19,
              cash_payment_enabled = $20,
              free_ticket_mode = $21,
              iban = $22,
              iban_account_name = $23,
              payment_instructions = $24,
              refund_policy = $25,
              age_requirement = $26,
              visibility = $27,
              organizer_contact = $28,
              external_link = $29,
              tags = $30::text[],
              status = 'draft',
              rejection_reason = null,
              updated_by = $31,
              updated_at = now()
        where id = $1::uuid`,
      [
        eventId,
        normalized.title,
        normalized.shortDescription,
        normalized.description,
        objectPath,
        normalized.location,
        normalized.venueDetails,
        normalized.venueName,
        normalized.venueAddress,
        normalized.startAt,
        normalized.endAt,
        normalized.timezone,
        normalized.ticketPrice,
        normalized.currency,
        normalized.isFree,
        normalized.capacity,
        normalized.ticketRequestDeadline,
        normalized.registrationStartsAt,
        normalized.bankTransferEnabled,
        normalized.cashPaymentEnabled,
        normalized.freeTicketMode,
        normalized.iban,
        normalized.ibanAccountName,
        normalized.paymentInstructions,
        normalized.refundPolicy,
        normalized.ageRequirement,
        normalized.visibility,
        normalized.organizerContact,
        normalized.externalLink,
        normalized.tags,
        user.id
      ]
    );
    if (updated.rowCount !== 1) throw new EventsError("event_not_found", 404);
    await client.query(
      `insert into public.event_audit_logs (
         university_id, club_id, event_id, actor_user_id, action, metadata
       ) values ($1, $2, $3, $4, 'event_edited', '{}'::jsonb)`,
      [event.university_id, event.club_id, eventId, user.id]
    );
    await client.query("commit");
  } catch (error) {
    await client.query("rollback").catch(() => undefined);
    if (uploadedObjectPath) {
      await getSupabaseAdminClient().storage.from(EVENT_ASSET_BUCKET).remove([uploadedObjectPath]).catch(() => undefined);
    }
    throw error;
  } finally {
    client.release();
  }

  if (uploadedObjectPath && event.cover_image_url && !event.cover_image_url.includes("..") && !event.cover_image_url.startsWith("/")) {
    await getSupabaseAdminClient().storage.from(EVENT_ASSET_BUCKET).remove([event.cover_image_url]).catch(() => undefined);
  }
}

export async function submitEventForReview(eventId: string) {
  const user = await currentStudentRequired();
  const pool = await getReadyPool();
  const initial = await pool.query<{ club_id: string }>(
    `select club_id from public.events where id = $1::uuid limit 1`,
    [eventId]
  );
  if (!initial.rows[0]) throw new EventsError("event_not_found", 404);
  const client = await pool.connect();
  try {
    await client.query("begin");
    const club = await client.query<{ status: string }>(
      `select status from public.student_clubs where id = $1::uuid for share`,
      [initial.rows[0].club_id]
    );
    if (club.rows[0]?.status !== "approved") throw new EventsError("club_not_approved", 403);
    const membership = await client.query<{ id: string }>(
      `select id
         from public.club_memberships
        where club_id = $1::uuid
          and user_id = $2
          and status = 'active'
          and role = any($3::text[])
        limit 1
        for share`,
      [initial.rows[0].club_id, user.id, rolesWithClubCapability("club.events.publish")]
    );
    if (!membership.rows[0]) throw new EventsError("club_access_denied", 403);
    const eventResult = await client.query<{
      id: string;
      club_id: string;
      university_id: string;
      status: EventStatus;
      cover_image_url: string | null;
      start_at: Date | string;
      ticket_request_deadline: Date | string;
      moderation_status: "active" | "platform_suspended";
    }>(
      `select id, club_id, university_id, status, cover_image_url, start_at, ticket_request_deadline, moderation_status
         from public.events
        where id = $1::uuid
        for update`,
      [eventId]
    );
    const event = eventResult.rows[0];
    if (!event || event.club_id !== initial.rows[0].club_id) throw new EventsError("event_not_found", 404);
    if (event.moderation_status !== "active") throw new EventsError("event_not_editable", 409);
    if (event.status !== "draft") throw new EventsError("event_not_editable", 409);
    const submitted = await client.query(
      `update public.events
          set status = 'pending_review', submitted_at = now(), rejection_reason = null, updated_by = $2, updated_at = now()
        where id = $1::uuid
          and status = 'draft'
          and cover_image_url is not null
          and start_at > now()
          and ticket_request_deadline > now()
        returning id`,
      [eventId, user.id]
    );
    if (!submitted.rows[0]) throw new EventsError("event_cover_required", 422);
    await client.query(
      `insert into public.event_audit_logs (
         university_id, club_id, event_id, actor_user_id, action, metadata
       ) values ($1, $2, $3, $4, 'event_submitted', '{}'::jsonb)`,
      [event.university_id, event.club_id, eventId, user.id]
    );
    await client.query("commit");
  } catch (error) {
    await client.query("rollback").catch(() => undefined);
    throw error;
  } finally {
    client.release();
  }
}

export async function cancelClubEvent(eventId: string) {
  const actor = await currentStudentRequired();
  const pool = await getReadyPool();
  const initial = await pool.query<{ club_id: string }>(
    `select club_id from public.events where id = $1::uuid limit 1`,
    [eventId]
  );
  if (!initial.rows[0]) throw new EventsError("event_not_found", 404);
  const client = await pool.connect();
  try {
    await client.query("begin");
    const club = await client.query<{ status: string }>(
      `select status from public.student_clubs where id = $1::uuid for share`,
      [initial.rows[0].club_id]
    );
    if (!club.rows[0]) throw new EventsError("club_not_found", 404);
    const membership = await client.query<{ id: string }>(
      `select id
         from public.club_memberships
        where club_id = $1::uuid
          and user_id = $2
          and status = 'active'
          and role = any($3::text[])
        limit 1
        for share`,
      [initial.rows[0].club_id, actor.id, rolesWithClubCapability("club.events.cancel")]
    );
    if (!membership.rows[0]) throw new EventsError("club_access_denied", 403);
    const eventResult = await client.query<{
      club_id: string;
      university_id: string;
      status: EventStatus;
      title: string;
      slug: string;
    }>(
      `select club_id, university_id, status, title, slug from public.events where id = $1::uuid for update`,
      [eventId]
    );
    const event = eventResult.rows[0];
    if (!event || event.club_id !== initial.rows[0].club_id) throw new EventsError("event_not_found", 404);
    if (!("draft pending_review published sold_out rejected".split(" ") as EventStatus[]).includes(event.status)) {
      throw new EventsError("event_not_editable", 409);
    }
    const cancelled = await client.query(
      `update public.events
          set status = 'cancelled',
              featured_status = case when featured_status = 'approved' then 'expired' else featured_status end,
              featured_until = case when featured_status = 'approved' then now() else featured_until end,
              updated_by = $2,
              updated_at = now()
        where id = $1::uuid
          and status in ('draft', 'pending_review', 'published', 'sold_out', 'rejected')
        returning id`,
      [eventId, actor.id]
    );
    if (!cancelled.rows[0]) throw new EventsError("event_not_editable", 409);

    const refundRequired = await client.query<{ count: number }>(
      `with affected as (
         update public.event_tickets ticket
            set reservation_status = 'released',
                reservation_expires_at = null,
                request_status = 'cancelled',
                ticket_status = 'revoked',
                refund_required_at = coalesce(ticket.refund_required_at, now()),
                cancelled_at = coalesce(ticket.cancelled_at, now()),
                cancelled_by = $2,
                updated_at = now()
          where ticket.event_id = $1::uuid
            and ticket.checked_in_at is null
            and ticket.ticket_status in ('pending', 'active')
            and ticket.amount > 0
            and ticket.payment_status in ('under_review', 'clarification_requested', 'approved')
          returning ticket.id, ticket.user_id
       ), logged as (
         insert into public.event_audit_logs (
           university_id, club_id, event_id, ticket_id, actor_user_id, action, metadata
         )
         select $3::uuid, $4::uuid, $1::uuid, affected.id, $2, audit_action.action,
                case when audit_action.action = 'reservation_released'
                  then jsonb_build_object('reason', 'event_cancelled')
                  else '{}'::jsonb
                end
           from affected
           cross join (values ('refund_required'::text), ('reservation_released'::text)) audit_action(action)
         returning ticket_id, action
       )
       select count(*) filter (where action = 'refund_required')::int as count from logged`,
      [eventId, actor.id, event.university_id, event.club_id]
    );
    const cancelledTickets = await client.query<{ count: number }>(
      `with affected as (
         update public.event_tickets ticket
            set reservation_status = 'cancelled',
                reservation_expires_at = null,
                request_status = 'cancelled',
                payment_status = case when ticket.payment_status = 'not_required' then 'not_required' else 'rejected' end,
                ticket_status = 'cancelled',
                cancelled_at = coalesce(ticket.cancelled_at, now()),
                cancelled_by = $2,
                refund_required_at = null,
                updated_at = now()
          where ticket.event_id = $1::uuid
            and ticket.checked_in_at is null
            and ticket.ticket_status in ('pending', 'active')
            and not (
              ticket.amount > 0
              and ticket.payment_status in ('under_review', 'clarification_requested', 'approved')
            )
          returning ticket.id, ticket.user_id
       ), logged as (
         insert into public.event_audit_logs (
           university_id, club_id, event_id, ticket_id, actor_user_id, action, metadata
         )
         select $3::uuid, $4::uuid, $1::uuid, affected.id, $2, audit_action.action,
                case when audit_action.action = 'reservation_released'
                  then jsonb_build_object('reason', 'event_cancelled')
                  else '{}'::jsonb
                end
           from affected
           cross join (values ('ticket_cancelled'::text), ('reservation_released'::text)) audit_action(action)
         returning ticket_id, action
       )
       select count(*) filter (where action = 'ticket_cancelled')::int as count from logged`,
      [eventId, actor.id, event.university_id, event.club_id]
    );
    await client.query(
      `insert into public.event_audit_logs (
         university_id, club_id, event_id, actor_user_id, action, metadata
       ) values (
         $1, $2, $3, $4, 'event_cancelled',
         jsonb_build_object('cancelled_ticket_count', $5::int, 'refund_required_count', $6::int)
       )`,
      [
        event.university_id,
        event.club_id,
        eventId,
        actor.id,
        Number(cancelledTickets.rows[0]?.count || 0),
        Number(refundRequired.rows[0]?.count || 0)
      ]
    );
    await client.query(
      `insert into public.notifications (user_id, type, title, body, href, actor_type, actor_id, metadata)
       select distinct ticket.user_id,
              'event_cancelled',
              'Event cancelled',
              $2,
              '/app/user/tickets',
              'club',
              $3::text,
              jsonb_build_object('event_id', $1::text)
         from public.event_tickets ticket
        where ticket.event_id = $1::uuid
          and ticket.user_id <> $4`,
      [eventId, event.title, event.club_id, actor.id]
    );
    await client.query("commit");
  } catch (error) {
    await client.query("rollback").catch(() => undefined);
    throw error;
  } finally {
    client.release();
  }
}

export async function deleteClubEventDraft(eventId: string) {
  const actor = await currentStudentRequired();
  const pool = await getReadyPool();
  const client = await pool.connect();
  let objectsToDelete: string[] = [];
  try {
    await client.query("begin");
    const eventResult = await client.query<{
      club_id: string;
      university_id: string;
      status: EventStatus;
      cover_image_url: string | null;
      moderation_status: "active" | "platform_suspended";
    }>(
      `select club_id, university_id, status, cover_image_url, moderation_status
         from public.events
        where id = $1::uuid
        for update`,
      [eventId]
    );
    const event = eventResult.rows[0];
    if (!event) throw new EventsError("event_not_found", 404);
    if (event.status !== "draft" || event.moderation_status !== "active") throw new EventsError("event_not_editable", 409);
    const membership = await client.query(
      `select id from public.club_memberships
        where club_id = $1::uuid
          and user_id = $2
          and status = 'active'
          and role = any($3::text[])
        limit 1 for share`,
      [event.club_id, actor.id, rolesWithClubCapability("club.events.cancel")]
    );
    if (!membership.rows[0]) throw new EventsError("club_access_denied", 403);
    const gallery = await client.query<{ object_path: string }>(
      `select object_path from public.event_images where event_id = $1::uuid`,
      [eventId]
    );
    objectsToDelete = [event.cover_image_url, ...gallery.rows.map((image) => image.object_path)]
      .filter((value): value is string => Boolean(value && !value.includes("..") && !value.startsWith("/")));
    await client.query(
      `insert into public.event_audit_logs (university_id, club_id, event_id, actor_user_id, action, metadata)
       values ($1, $2, $3, $4, 'event_deleted', jsonb_build_object('event_id', $3::text, 'lifecycle_status', 'draft'))`,
      [event.university_id, event.club_id, eventId, actor.id]
    );
    const deleted = await client.query(`delete from public.events where id = $1::uuid and status = 'draft'`, [eventId]);
    if (deleted.rowCount !== 1) throw new EventsError("event_not_editable", 409);
    await client.query("commit");
  } catch (error) {
    await client.query("rollback").catch(() => undefined);
    throw error;
  } finally {
    client.release();
  }
  if (objectsToDelete.length) {
    await getSupabaseAdminClient().storage.from(EVENT_ASSET_BUCKET).remove(objectsToDelete).catch(() => undefined);
  }
}

export async function updateEventCapacity(eventId: string, requestedCapacity: number) {
  const capacity = Number(requestedCapacity);
  if (!Number.isInteger(capacity) || capacity < 1 || capacity > 100_000) {
    throw new EventsError("event_invalid", 422);
  }
  const actor = await currentStudentRequired();
  const pool = await getReadyPool();
  const client = await pool.connect();
  try {
    await client.query("begin");
    await client.query(`select pg_advisory_xact_lock(hashtextextended($1::text, 0))`, [eventId]);
    const eventResult = await client.query<{
      club_id: string;
      university_id: string;
      capacity: number;
      status: EventStatus;
      moderation_status: string;
    }>(
      `select event.club_id, event.university_id, event.capacity, event.status, event.moderation_status
         from public.events event
         join public.student_clubs club on club.id = event.club_id
        where event.id = $1::uuid
          and club.status = 'approved'
        for update of event`,
      [eventId]
    );
    const event = eventResult.rows[0];
    if (!event) throw new EventsError("event_not_found", 404);
    if (event.moderation_status !== "active") throw new EventsError("event_not_editable", 409);
    if (!("draft pending_review published sold_out rejected".split(" ") as EventStatus[]).includes(event.status)) {
      throw new EventsError("event_not_editable", 409);
    }
    const membership = await client.query<{ id: string }>(
      `select id from public.club_memberships
        where club_id = $1::uuid
          and user_id = $2
          and status = 'active'
          and role = any($3::text[])
        limit 1
        for share`,
      [event.club_id, actor.id, rolesWithClubCapability("club.events.update")]
    );
    if (!membership.rows[0]) throw new EventsError("club_access_denied", 403);
    await client.query(`select * from private.expire_event_reservations($1::uuid)`, [eventId]);
    const consumedResult = await client.query<{ consumed: number }>(
      `select count(*)::int as consumed
         from public.event_tickets ticket
        where ticket.event_id = $1::uuid
          and (
            ticket.ticket_status in ('active', 'checked_in')
            or ticket.reservation_status = 'held_for_review'
            or (
              ticket.reservation_status = 'active'
              and ticket.reservation_expires_at is not null
              and ticket.reservation_expires_at > now()
            )
          )`,
      [eventId]
    );
    const consumed = Number(consumedResult.rows[0]?.consumed || 0);
    if (capacity < consumed) throw new EventsError("capacity_below_confirmed", 409);
    await client.query(
      `update public.events
          set capacity = $2,
              status = case
                when status in ('published', 'sold_out') and $2 <= $3 then 'sold_out'
                when status = 'sold_out' and $2 > $3 then 'published'
                else status
              end,
              updated_by = $4,
              updated_at = now()
        where id = $1::uuid`,
      [eventId, capacity, consumed, actor.id]
    );
    await client.query(
      `insert into public.event_audit_logs (
         university_id, club_id, event_id, actor_user_id, action, metadata
       ) values ($1, $2, $3, $4, 'quota_changed', jsonb_build_object(
         'previous_capacity', $5::int,
         'new_capacity', $6::int,
         'consumed_capacity', $7::int
       ))`,
      [event.university_id, event.club_id, eventId, actor.id, event.capacity, capacity, consumed]
    );
    await client.query("commit");
  } catch (error) {
    await client.query("rollback").catch(() => undefined);
    throw error;
  } finally {
    client.release();
  }
}

export async function setEventRegistrationOpen(eventId: string, open: boolean) {
  const actor = await currentStudentRequired();
  if (!/^[0-9a-f-]{36}$/i.test(eventId)) throw new EventsError("event_not_found", 404);
  const pool = await getReadyPool();
  const client = await pool.connect();
  try {
    await client.query("begin");
    const result = await client.query<{
      club_id: string;
      university_id: string;
      status: EventStatus;
      moderation_status: string;
      start_at: Date | string;
      ticket_request_deadline: Date | string;
      registration_ends_at: Date | string | null;
    }>(
      `select club_id, university_id, status, moderation_status, start_at,
              ticket_request_deadline, registration_ends_at
         from public.events where id = $1::uuid for update`,
      [eventId]
    );
    const event = result.rows[0];
    if (!event) throw new EventsError("event_not_found", 404);
    if (event.moderation_status !== "active" || !(["published", "sold_out"] as EventStatus[]).includes(event.status)) {
      throw new EventsError("event_not_editable", 409);
    }
    const membership = await client.query(
      `select 1 from public.club_memberships
        where club_id = $1::uuid and user_id = $2 and status = 'active'
          and role = any($3::text[]) limit 1 for share`,
      [event.club_id, actor.id, rolesWithClubCapability("club.events.update")]
    );
    if (!membership.rows[0]) throw new EventsError("club_access_denied", 403);
    const now = new Date();
    const startAt = new Date(event.start_at);
    const currentDeadline = new Date(event.ticket_request_deadline);
    const originalDeadline = event.registration_ends_at ? new Date(event.registration_ends_at) : currentDeadline;
    if (startAt <= now || (open && originalDeadline <= now)) throw new EventsError("event_not_editable", 409);
    if ((open && currentDeadline > now) || (!open && currentDeadline <= now)) throw new EventsError("event_not_editable", 409);
    const nextDeadline = open ? originalDeadline : now;
    await client.query(
      `update public.events set ticket_request_deadline = $2, updated_by = $3, updated_at = now() where id = $1::uuid`,
      [eventId, nextDeadline.toISOString(), actor.id]
    );
    await client.query(
      `insert into public.event_audit_logs (university_id, club_id, event_id, actor_user_id, action, metadata)
       values ($1::uuid, $2::uuid, $3::uuid, $4, $5, jsonb_build_object('registration_open', $6::boolean))`,
      [event.university_id, event.club_id, eventId, actor.id, open ? "registration_reopened" : "registration_closed", open]
    );
    await client.query("commit");
  } catch (error) {
    await client.query("rollback").catch(() => undefined);
    throw error;
  } finally {
    client.release();
  }
}

export async function listAdminEventModeration() {
  const pool = await getReadyPool();
  const result = await pool.query<EventRow>(
    `${EVENT_SELECT}
      where event.status in ('pending_review', 'published', 'sold_out', 'rejected', 'cancelled')
         or event.moderation_status = 'platform_suspended'
      order by (event.moderation_status = 'platform_suspended') desc,
               (event.status = 'pending_review') desc,
               event.submitted_at desc nulls last,
               event.created_at desc`
  );
  return result.rows.map(mapEvent);
}

export async function reviewEventAsAdmin(input: {
  eventId: string;
  action: "approve" | "reject";
  adminEmail: string;
  reason?: string | null;
}) {
  const pool = await getReadyPool();
  const client = await pool.connect();
  try {
    await client.query("begin");
    const initial = await client.query<{ club_id: string }>(
      `select club_id from public.events where id = $1::uuid limit 1`,
      [input.eventId]
    );
    if (!initial.rows[0]) throw new EventsError("event_not_found", 404);
    const club = await client.query<{ status: string }>(
      `select status from public.student_clubs where id = $1::uuid for share`,
      [initial.rows[0].club_id]
    );
    if (club.rows[0]?.status !== "approved") throw new EventsError("event_not_found", 404);
    const result = await client.query<{
      id: string;
      club_id: string;
      university_id: string;
      status: EventStatus;
      start_at: Date;
      ticket_request_deadline: Date;
      cover_image_url: string | null;
      moderation_status: "active" | "platform_suspended";
    }>(
      `select event.id, event.club_id, event.university_id, event.status, event.start_at,
              event.ticket_request_deadline, event.cover_image_url, event.moderation_status
         from public.events event
        where event.id = $1::uuid
          and event.club_id = $2::uuid
        for update`,
      [input.eventId, initial.rows[0].club_id]
    );
    const event = result.rows[0];
    if (!event) throw new EventsError("event_not_found", 404);
    if (event.moderation_status !== "active") throw new EventsError("event_not_editable", 409);
    if (event.status !== "pending_review") throw new EventsError("event_not_editable", 409);
    if (
      input.action === "approve" && (
        !event.cover_image_url ||
        new Date(event.start_at) <= new Date() ||
        new Date(event.ticket_request_deadline) <= new Date()
      )
    ) throw new EventsError("event_invalid", 422);
    const nextStatus = input.action === "approve" ? "published" : "rejected";
    const reason = input.action === "reject" ? (input.reason || "").trim().slice(0, 1000) : null;
    if (input.action === "reject" && !reason) throw new EventsError("event_invalid", 422);
    const updated = await client.query(
      `update public.events
          set status = $2,
              published_at = case when $2 = 'published' then now() else published_at end,
              reviewed_at = now(),
              reviewed_by = encode(digest(lower($3), 'sha256'), 'hex'),
              rejection_reason = $4,
              updated_at = now()
        where id = $1
          and status = 'pending_review'
          and ($2 <> 'published' or (
            cover_image_url is not null
            and start_at > now()
            and ticket_request_deadline > now()
          ))`,
      [input.eventId, nextStatus, input.adminEmail, reason]
    );
    if (updated.rowCount !== 1) throw new EventsError("event_invalid", 422);
    await client.query(
      `insert into public.event_audit_logs (university_id, club_id, event_id, action, metadata)
       values ($1, $2, $3, $4, jsonb_build_object('admin_email_hash', encode(digest(lower($5), 'sha256'), 'hex')))`,
      [event.university_id, event.club_id, event.id, input.action === "approve" ? "event_approved" : "event_rejected", input.adminEmail]
    );
    await client.query("commit");
  } catch (error) {
    await client.query("rollback").catch(() => undefined);
    throw error;
  } finally {
    client.release();
  }
}

export async function setEventFeaturedAsAdmin(input: {
  eventId: string;
  featured: boolean;
  featuredUntil?: string | null;
  adminEmail: string;
}) {
  const pool = await getReadyPool();
  const until = input.featured && input.featuredUntil ? new Date(input.featuredUntil) : null;
  if (until && (!Number.isFinite(until.getTime()) || until <= new Date())) throw new EventsError("event_invalid", 422);
  const client = await pool.connect();
  try {
    await client.query("begin");
    const initial = await client.query<{ club_id: string }>(
      `select club_id from public.events where id = $1::uuid limit 1`,
      [input.eventId]
    );
    if (!initial.rows[0]) throw new EventsError("event_not_found", 404);
    const club = await client.query<{ status: string }>(
      `select status from public.student_clubs where id = $1::uuid for share`,
      [initial.rows[0].club_id]
    );
    if (club.rows[0]?.status !== "approved") throw new EventsError("event_not_found", 404);
    const locked = await client.query<{ id: string; club_id: string; university_id: string }>(
      `select event.id, event.club_id, event.university_id
         from public.events event
        where event.id = $1::uuid
          and event.club_id = $2::uuid
          and event.status = 'published'
          and event.moderation_status = 'active'
          and event.start_at > now()
        for update`,
      [input.eventId, initial.rows[0].club_id]
    );
    const event = locked.rows[0];
    if (!event) throw new EventsError("event_not_found", 404);
    await client.query(
      `update public.events
          set featured_status = case when $2 then 'approved' else 'none' end,
              featured_at = case when $2 then now() else null end,
              featured_until = case when $2 then $3::timestamptz else null end,
              updated_at = now()
        where id = $1::uuid`,
      [input.eventId, input.featured, until?.toISOString() || null]
    );
    await client.query(
      `insert into public.event_audit_logs (university_id, club_id, event_id, action, metadata)
       values ($1, $2, $3, $4, jsonb_build_object('admin_email_hash', encode(digest(lower($5), 'sha256'), 'hex')))`,
      [event.university_id, event.club_id, event.id, input.featured ? "event_featured" : "event_unfeatured", input.adminEmail]
    );
    await client.query("commit");
  } catch (error) {
    await client.query("rollback").catch(() => undefined);
    throw error;
  } finally {
    client.release();
  }
}

export async function setEventModerationAsAdmin(input: {
  eventId: string;
  suspended: boolean;
  adminEmail: string;
  reason?: string | null;
}) {
  const reason = (input.reason || "").trim().slice(0, 1000);
  if (input.suspended && reason.length < 2) throw new EventsError("event_invalid", 422);
  const pool = await getReadyPool();
  const client = await pool.connect();
  try {
    await client.query("begin");
    const result = await client.query<{ club_id: string; university_id: string; moderation_status: string }>(
      `select club_id, university_id, moderation_status
         from public.events
        where id = $1::uuid
        for update`,
      [input.eventId]
    );
    const event = result.rows[0];
    if (!event) throw new EventsError("event_not_found", 404);
    const nextStatus = input.suspended ? "platform_suspended" : "active";
    if (event.moderation_status === nextStatus) throw new EventsError("event_not_editable", 409);
    await client.query(
      `update public.events
          set moderation_status = $2,
              moderation_reason = $3,
              moderated_at = now(),
              moderated_by = encode(digest(lower($4), 'sha256'), 'hex'),
              featured_status = case when $2 = 'platform_suspended' then 'expired' else featured_status end,
              featured_until = case when $2 = 'platform_suspended' then now() else featured_until end,
              updated_at = now()
        where id = $1::uuid`,
      [input.eventId, nextStatus, input.suspended ? reason : null, input.adminEmail]
    );
    await client.query(
      `insert into public.event_audit_logs (university_id, club_id, event_id, action, metadata)
       values ($1, $2, $3, $4, jsonb_build_object(
         'admin_email_hash', encode(digest(lower($5), 'sha256'), 'hex'),
         'has_reason', $6::boolean
       ))`,
      [
        event.university_id,
        event.club_id,
        input.eventId,
        input.suspended ? "platform_suspended" : "platform_suspension_lifted",
        input.adminEmail,
        Boolean(reason)
      ]
    );
    await client.query("commit");
  } catch (error) {
    await client.query("rollback").catch(() => undefined);
    throw error;
  } finally {
    client.release();
  }
}

export async function inviteClubMember(input: {
  clubId: string;
  usernameOrEmail: string;
  role: ClubRole;
}) {
  const actor = await currentStudentRequired();
  const identifier = input.usernameOrEmail.trim().replace(/^@/, "").toLowerCase();
  if (!identifier || !CLUB_ROLES.includes(input.role) || input.role === "club_owner") {
    throw new EventsError("club_member_invalid", 422);
  }
  const pool = await getReadyPool();
  const client = await pool.connect();
  try {
    await client.query("begin");
    const clubResult = await client.query<{ university_id: string; status: string }>(
      `select university_id, status from public.student_clubs where id = $1::uuid for share`,
      [input.clubId]
    );
    const club = clubResult.rows[0];
    if (!club || club.status !== "approved") throw new EventsError("club_not_approved", 403);
    const actorMembership = await client.query<{ id: string }>(
      `select id
         from public.club_memberships
        where club_id = $1::uuid
          and user_id = $2
          and role = any($3::text[])
          and status = 'active'
        limit 1
        for share`,
      [input.clubId, actor.id, rolesWithClubCapability("club.roles.manage")]
    );
    if (!actorMembership.rows[0]) throw new EventsError("club_access_denied", 403);
    const userResult = await client.query<{ id: string }>(
      `select id
         from public.users
        where status = 'active'
          and university_id = $2::uuid
          and (lower(email) = lower($1) or lower(coalesce(username, '')) = lower($1))
        limit 1`,
      [identifier, club.university_id]
    );
    const target = userResult.rows[0];
    if (!target) throw new EventsError("club_member_not_found", 404);
    const membership = await client.query<{ id: string }>(
      `insert into public.club_memberships (
         club_id, user_id, role, status, invited_by, invited_at, invitation_expires_at
       ) values ($1, $2, $3, 'invited', $4, now(), now() + interval '14 days')
       on conflict (club_id, user_id, role) do update
         set status = 'invited',
             invited_by = excluded.invited_by,
             invited_at = now(),
             invitation_expires_at = now() + interval '14 days',
             revoked_at = null,
             revoked_by = null,
             updated_at = now()
       where club_memberships.status in ('revoked', 'left')
          or (club_memberships.status = 'invited' and club_memberships.invitation_expires_at <= now())
       returning id`,
      [input.clubId, target.id, input.role, actor.id]
    );
    if (!membership.rows[0]) throw new EventsError("club_membership_not_editable", 409);
    await client.query(
      `insert into public.event_audit_logs (university_id, club_id, actor_user_id, action, metadata)
       values ($1, $2, $3, 'member_invited', jsonb_build_object('membership_id', $4::text, 'role', $5::text))`,
      [club.university_id, input.clubId, actor.id, membership.rows[0]?.id, input.role]
    );
    await client.query(
      `insert into public.club_audit_logs (
         club_id, actor_user_id, action, entity_type, entity_id, after_data, metadata
       ) values ($1::uuid, $2, 'member_invited', 'club_membership', $3,
                 jsonb_build_object('role', $4::text, 'status', 'invited'), '{}'::jsonb)`,
      [input.clubId, actor.id, membership.rows[0]?.id, input.role]
    );
    await client.query(
      `insert into public.notifications (user_id, type, title, body, href, actor_type, actor_id, metadata)
       values ($1, 'club_role_invitation', 'Club role invitation', $2, '/app/user/club', 'club', $3::text,
               jsonb_build_object('membership_id', $4::text, 'role', $5::text))`,
      [target.id, input.role.replaceAll("_", " "), input.clubId, membership.rows[0]?.id, input.role]
    );
    await client.query("commit");
    return membership.rows[0]?.id || null;
  } catch (error) {
    await client.query("rollback").catch(() => undefined);
    throw error;
  } finally {
    client.release();
  }
}

export async function acceptClubMembership(membershipId: string) {
  const user = await currentStudentRequired();
  const pool = await getReadyPool();
  const client = await pool.connect();
  try {
    await client.query("begin");
    const invitation = await client.query<{ id: string; club_id: string; university_id: string }>(
      `select membership.id, membership.club_id, club.university_id
         from public.club_memberships membership
         join public.student_clubs club on club.id = membership.club_id
         join public.users app_user on app_user.id = membership.user_id
        where membership.id = $1::uuid
          and membership.user_id = $2
          and membership.status = 'invited'
          and membership.invitation_expires_at > now()
          and club.status = 'approved'
          and club.university_id = app_user.university_id
        for update of membership
        for share of club`,
      [membershipId, user.id]
    );
    const target = invitation.rows[0];
    if (!target) throw new EventsError("club_access_denied", 409);
    await client.query(
      `update public.club_memberships
          set status = 'active', accepted_at = now(), updated_at = now()
        where id = $1::uuid and status = 'invited'`,
      [membershipId]
    );
    await client.query(
      `insert into public.event_audit_logs (university_id, club_id, actor_user_id, action, metadata)
       values ($1, $2, $3, 'membership_accepted', jsonb_build_object('membership_id', $4::text))`,
      [target.university_id, target.club_id, user.id, membershipId]
    );
    await client.query(
      `insert into public.club_audit_logs (
         club_id, actor_user_id, action, entity_type, entity_id, before_data, after_data, metadata
       ) values ($1::uuid, $2, 'membership_accepted', 'club_membership', $3,
                 jsonb_build_object('status', 'invited'), jsonb_build_object('status', 'active'), '{}'::jsonb)`,
      [target.club_id, user.id, membershipId]
    );
    await client.query("commit");
  } catch (error) {
    await client.query("rollback").catch(() => undefined);
    throw error;
  } finally {
    client.release();
  }
}

export async function revokeClubMembership(clubId: string, membershipId: string) {
  const actor = await currentStudentRequired();
  const pool = await getReadyPool();
  const client = await pool.connect();
  try {
    await client.query("begin");
    const club = await client.query<{ university_id: string }>(
      `select university_id from public.student_clubs where id = $1::uuid and status = 'approved' for share`,
      [clubId]
    );
    if (!club.rows[0]) throw new EventsError("club_not_found", 404);
    const actorMembership = await client.query<{ id: string }>(
      `select id
         from public.club_memberships
        where club_id = $1::uuid
          and user_id = $2
          and role = any($3::text[])
          and status = 'active'
        limit 1
        for share`,
      [clubId, actor.id, rolesWithClubCapability("club.roles.manage")]
    );
    if (!actorMembership.rows[0]) throw new EventsError("club_access_denied", 403);
    const result = await client.query<{ user_id: string; role: ClubRole }>(
      `update public.club_memberships
          set status = 'revoked', revoked_at = now(), revoked_by = $3, updated_at = now()
        where id = $1::uuid
          and club_id = $2::uuid
          and status in ('active', 'invited')
          and role <> 'club_owner'
        returning user_id, role`,
      [membershipId, clubId, actor.id]
    );
    if (!result.rows[0]) throw new EventsError("club_membership_not_editable", 409);
    await client.query(
      `update public.event_scanner_assignments
          set revoked_at = now(), revoked_by = $3
        where club_id = $1::uuid and user_id = $2 and revoked_at is null`,
      [clubId, result.rows[0].user_id, actor.id]
    );
    await client.query(
      `insert into public.event_audit_logs (university_id, club_id, actor_user_id, action, metadata)
       values ($1, $2, $3, 'role_revoked', jsonb_build_object('membership_id', $4::text, 'role', $5::text))`,
      [club.rows[0].university_id, clubId, actor.id, membershipId, result.rows[0].role]
    );
    await client.query(
      `insert into public.club_audit_logs (
         club_id, actor_user_id, action, entity_type, entity_id, before_data, after_data, metadata
       ) values ($1::uuid, $2, 'member_role_revoked', 'club_membership', $3,
                 jsonb_build_object('role', $4::text, 'status', 'active'),
                 jsonb_build_object('role', $4::text, 'status', 'revoked'), '{}'::jsonb)`,
      [clubId, actor.id, membershipId, result.rows[0].role]
    );
    await client.query(
      `insert into public.notifications (user_id, type, title, body, href, actor_type, actor_id, metadata)
       values ($1, 'club_role_changed', 'Club access updated', 'A club role was removed from your account.',
               '/app/user/club', 'club', $2::text, jsonb_build_object('role', $3::text))`,
      [result.rows[0].user_id, clubId, result.rows[0].role]
    );
    await client.query("commit");
  } catch (error) {
    await client.query("rollback").catch(() => undefined);
    throw error;
  } finally {
    client.release();
  }
}

export async function assignScannerToEvent(eventId: string, scannerUserId: string) {
  const actor = await currentStudentRequired();
  const pool = await getReadyPool();
  const initial = await pool.query<{ club_id: string }>(
    `select club_id from public.events where id = $1::uuid limit 1`,
    [eventId]
  );
  if (!initial.rows[0]) throw new EventsError("event_not_found", 404);
  const client = await pool.connect();
  try {
    await client.query("begin");
    const club = await client.query<{ status: string }>(
      `select status from public.student_clubs where id = $1::uuid for share`,
      [initial.rows[0].club_id]
    );
    if (club.rows[0]?.status !== "approved") throw new EventsError("club_not_approved", 403);
    const actorMembership = await client.query<{ id: string }>(
      `select id
         from public.club_memberships
        where club_id = $1::uuid
          and user_id = $2
          and status = 'active'
          and role = any($3::text[])
        limit 1
        for share`,
      [initial.rows[0].club_id, actor.id, rolesWithClubCapability("club.events.manage_attendees")]
    );
    if (!actorMembership.rows[0]) throw new EventsError("club_access_denied", 403);
    const eventResult = await client.query<{ club_id: string; university_id: string }>(
      `select club_id, university_id from public.events where id = $1::uuid for update`,
      [eventId]
    );
    const event = eventResult.rows[0];
    if (!event || event.club_id !== initial.rows[0].club_id) throw new EventsError("event_not_found", 404);
    const scannerMembership = await client.query<{ id: string }>(
      `select id
         from public.club_memberships
        where club_id = $1::uuid
          and user_id = $2
          and role = 'door_scanner'
          and status = 'active'
        limit 1
        for share`,
      [event.club_id, scannerUserId]
    );
    if (!scannerMembership.rows[0]) throw new EventsError("scanner_candidate_invalid", 422);
    await client.query(
      `insert into public.event_scanner_assignments (
         club_id, event_id, user_id, assigned_by, assigned_at
       ) values ($1, $2, $3, $4, now())
       on conflict (event_id, user_id) do update
         set assigned_by = excluded.assigned_by,
             assigned_at = now(),
             revoked_at = null,
             revoked_by = null`,
      [event.club_id, eventId, scannerUserId, actor.id]
    );
    await client.query(
      `insert into public.event_audit_logs (university_id, club_id, event_id, actor_user_id, action, metadata)
       values ($1, $2, $3, $4, 'scanner_assigned', jsonb_build_object('scanner_user_id', $5::text))`,
      [event.university_id, event.club_id, eventId, actor.id, scannerUserId]
    );
    await client.query("commit");
  } catch (error) {
    await client.query("rollback").catch(() => undefined);
    throw error;
  } finally {
    client.release();
  }
}

export async function revokeScannerFromEvent(eventId: string, scannerUserId: string) {
  const actor = await currentStudentRequired();
  const pool = await getReadyPool();
  const initial = await pool.query<{ club_id: string }>(
    `select club_id from public.events where id = $1::uuid limit 1`,
    [eventId]
  );
  if (!initial.rows[0]) throw new EventsError("event_not_found", 404);
  const client = await pool.connect();
  try {
    await client.query("begin");
    const club = await client.query<{ university_id: string }>(
      `select university_id from public.student_clubs where id = $1::uuid for share`,
      [initial.rows[0].club_id]
    );
    if (!club.rows[0]) throw new EventsError("club_not_found", 404);
    const actorMembership = await client.query<{ id: string }>(
      `select id
         from public.club_memberships
        where club_id = $1::uuid
          and user_id = $2
          and status = 'active'
          and role = any($3::text[])
        limit 1
        for share`,
      [initial.rows[0].club_id, actor.id, rolesWithClubCapability("club.events.manage_attendees")]
    );
    if (!actorMembership.rows[0]) throw new EventsError("club_access_denied", 403);
    const eventResult = await client.query<{ club_id: string }>(
      `select club_id from public.events where id = $1::uuid for update`,
      [eventId]
    );
    if (!eventResult.rows[0] || eventResult.rows[0].club_id !== initial.rows[0].club_id) {
      throw new EventsError("event_not_found", 404);
    }
    const revoked = await client.query(
      `update public.event_scanner_assignments
          set revoked_at = now(), revoked_by = $3
        where event_id = $1::uuid
          and user_id = $2
          and revoked_at is null
        returning id`,
      [eventId, scannerUserId, actor.id]
    );
    if (!revoked.rows[0]) throw new EventsError("scanner_assignment_not_editable", 409);
    await client.query(
      `insert into public.event_audit_logs (university_id, club_id, event_id, actor_user_id, action, metadata)
       values ($1, $2, $3, $4, 'scanner_revoked', jsonb_build_object('scanner_user_id', $5::text))`,
      [club.rows[0].university_id, initial.rows[0].club_id, eventId, actor.id, scannerUserId]
    );
    await client.query("commit");
  } catch (error) {
    await client.query("rollback").catch(() => undefined);
    throw error;
  } finally {
    client.release();
  }
}
