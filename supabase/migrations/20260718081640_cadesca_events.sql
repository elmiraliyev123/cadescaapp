-- Cadesca Events: verified clubs, moderated events, atomic ticketing,
-- private payment evidence, and identity-linked QR admission.

create extension if not exists pgcrypto;
create schema if not exists private;
revoke all on schema private from public, anon, authenticated;
grant usage on schema private to service_role;

-- Club onboarding reuses the existing hashed OTP implementation with a
-- dedicated purpose. The application server applies durable IP/email limits.
alter table if exists public.email_verification_codes
  drop constraint if exists email_verification_codes_purpose_check;

alter table if exists public.email_verification_codes
  add constraint email_verification_codes_purpose_check
  check (purpose in ('signup', 'login', 'password_reset', 'club_application'));

create unique index if not exists users_username_lower_key
  on public.users (lower(username))
  where username is not null;

-- Never derive authorization state from raw_user_meta_data. Authenticated users
-- may edit that document themselves; only app metadata or trusted DB state may
-- affect student verification.
create or replace function private.handle_auth_user_profile()
returns trigger
language plpgsql
security definer
set search_path = public, auth, pg_temp
as $$
declare
  normalized_email text;
  profile_name text;
  trusted_verified_source text;
  is_trusted_ocr_verified boolean;
begin
  normalized_email := lower(nullif(btrim(new.email), ''));
  if normalized_email is null then
    return new;
  end if;

  profile_name := coalesce(
    nullif(btrim(new.raw_app_meta_data ->> 'name'), ''),
    nullif(btrim(new.raw_user_meta_data ->> 'name'), ''),
    split_part(normalized_email, '@', 1),
    'Student'
  );

  trusted_verified_source := coalesce(
    nullif(btrim(new.raw_app_meta_data ->> 'verified_via'), ''),
    'email'
  );
  is_trusted_ocr_verified := trusted_verified_source = 'ocr';

  insert into public.users (
    id,
    auth_user_id,
    name,
    email,
    password_hash,
    student_status,
    student_menu_access,
    email_verified,
    verified_via,
    accepted_terms_at
  )
  values (
    'user_' || replace(new.id::text, '-', ''),
    new.id,
    profile_name,
    normalized_email,
    'supabase_auth_managed',
    case when is_trusted_ocr_verified then 'verified' else 'not_verified' end,
    is_trusted_ocr_verified,
    new.email_confirmed_at is not null,
    case when is_trusted_ocr_verified then 'ocr' else 'email' end,
    case
      when nullif(btrim(new.raw_app_meta_data ->> 'accepted_terms_at'), '') is not null
        then (new.raw_app_meta_data ->> 'accepted_terms_at')::timestamptz
      else null
    end
  )
  on conflict (email) do update
    set auth_user_id = coalesce(public.users.auth_user_id, excluded.auth_user_id),
        name = coalesce(nullif(public.users.name, ''), excluded.name),
        email_verified = public.users.email_verified or excluded.email_verified,
        verified_via = case
          when public.users.verified_via = 'ocr' or excluded.verified_via = 'ocr' then 'ocr'
          else public.users.verified_via
        end,
        student_status = case
          when public.users.verified_via = 'ocr' or excluded.verified_via = 'ocr' then 'verified'
          else public.users.student_status
        end,
        student_menu_access = public.users.student_menu_access or excluded.student_menu_access,
        accepted_terms_at = coalesce(public.users.accepted_terms_at, excluded.accepted_terms_at),
        updated_at = now();

  return new;
end;
$$;

revoke all on function private.handle_auth_user_profile() from public, anon, authenticated;

create table if not exists public.student_clubs (
  id uuid primary key default gen_random_uuid(),
  university_id uuid not null references public.universities(id) on delete restrict,
  name text not null,
  slug text not null,
  description text not null,
  logo_url text,
  official_email text not null,
  contact_email text not null,
  website_url text,
  instagram_url text,
  university_page_url text,
  verification_document_url text not null,
  contact_phone text,
  additional_note text,
  clarification_message text,
  status text not null default 'pending_review',
  approved_at timestamptz,
  approved_by text,
  rejected_at timestamptz,
  rejected_by text,
  rejection_reason text,
  suspended_at timestamptz,
  suspended_by text,
  suspension_reason text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint student_clubs_name_length check (char_length(btrim(name)) between 2 and 160),
  constraint student_clubs_slug_format check (
    slug = lower(slug)
    and slug ~ '^[a-z0-9](?:[a-z0-9-]{1,58}[a-z0-9])?$'
  ),
  constraint student_clubs_description_length check (char_length(btrim(description)) between 20 and 4000),
  constraint student_clubs_status_check check (
    status in ('pending_review', 'clarification_requested', 'approved', 'rejected', 'suspended', 'archived')
  ),
  constraint student_clubs_official_email_format check (official_email = lower(official_email) and official_email ~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$'),
  constraint student_clubs_contact_email_format check (contact_email = lower(contact_email) and contact_email ~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$'),
  constraint student_clubs_approval_state check (
    (status <> 'approved' or approved_at is not null)
    and (status <> 'rejected' or (rejected_at is not null and rejection_reason is not null))
    and (status <> 'suspended' or (suspended_at is not null and suspension_reason is not null))
  )
);

create unique index if not exists student_clubs_slug_lower_key
  on public.student_clubs (lower(slug));
create unique index if not exists student_clubs_university_name_lower_key
  on public.student_clubs (university_id, lower(name));
create unique index if not exists student_clubs_id_university_key
  on public.student_clubs (id, university_id);
create index if not exists student_clubs_university_status_idx
  on public.student_clubs (university_id, status, created_at desc);
create index if not exists student_clubs_status_created_idx
  on public.student_clubs (status, created_at desc);

create table if not exists public.club_memberships (
  id uuid primary key default gen_random_uuid(),
  club_id uuid not null references public.student_clubs(id) on delete cascade,
  user_id text not null references public.users(id) on delete cascade,
  role text not null,
  status text not null default 'invited',
  invited_by text references public.users(id) on delete set null,
  invited_at timestamptz,
  accepted_at timestamptz,
  revoked_at timestamptz,
  revoked_by text references public.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint club_memberships_role_check check (
    role in ('club_owner', 'event_organizer', 'finance_manager', 'door_scanner')
  ),
  constraint club_memberships_status_check check (
    status in ('invited', 'active', 'revoked', 'left', 'suspended')
  ),
  constraint club_memberships_acceptance_state check (
    status <> 'active' or accepted_at is not null
  ),
  constraint club_memberships_revocation_state check (
    status <> 'revoked' or revoked_at is not null
  ),
  unique (club_id, user_id, role)
);

create index if not exists club_memberships_user_status_idx
  on public.club_memberships (user_id, status, club_id);
create index if not exists club_memberships_club_role_status_idx
  on public.club_memberships (club_id, role, status, user_id);
create unique index if not exists club_memberships_single_active_owner_idx
  on public.club_memberships (club_id)
  where role = 'club_owner' and status = 'active';

create table if not exists public.club_application_messages (
  id uuid primary key default gen_random_uuid(),
  club_id uuid not null references public.student_clubs(id) on delete cascade,
  sender_user_id text references public.users(id) on delete set null,
  sender_admin_hash text,
  sender_type text not null,
  message text not null,
  created_at timestamptz not null default now(),
  constraint club_application_messages_sender_check check (
    sender_type in ('representative', 'admin')
    and ((sender_type = 'representative' and sender_user_id is not null) or (sender_type = 'admin' and sender_admin_hash is not null))
  ),
  constraint club_application_messages_length check (char_length(btrim(message)) between 2 and 2000)
);

create index if not exists club_application_messages_club_created_idx
  on public.club_application_messages (club_id, created_at desc);

create table if not exists public.events (
  id uuid primary key default gen_random_uuid(),
  club_id uuid not null references public.student_clubs(id) on delete restrict,
  university_id uuid not null references public.universities(id) on delete restrict,
  title text not null,
  slug text not null,
  description text not null,
  cover_image_url text,
  location text not null,
  venue_details text,
  start_at timestamptz not null,
  end_at timestamptz not null,
  timezone text not null,
  ticket_price numeric(12,2) not null default 0,
  currency text not null,
  is_free boolean not null default false,
  capacity integer not null,
  ticket_request_deadline timestamptz not null,
  bank_transfer_enabled boolean not null default false,
  cash_payment_enabled boolean not null default false,
  free_ticket_mode text not null default 'automatic',
  iban text,
  iban_account_name text,
  payment_instructions text,
  refund_policy text not null,
  age_requirement integer,
  status text not null default 'draft',
  featured_status text not null default 'none',
  featured_at timestamptz,
  featured_until timestamptz,
  published_at timestamptz,
  submitted_at timestamptz,
  reviewed_at timestamptz,
  reviewed_by text,
  rejection_reason text,
  created_by text not null references public.users(id) on delete restrict,
  updated_by text not null references public.users(id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint events_title_length check (char_length(btrim(title)) between 3 and 140),
  constraint events_slug_format check (slug = lower(slug) and slug ~ '^[a-z0-9](?:[a-z0-9-]{1,90}[a-z0-9])?$'),
  constraint events_description_length check (char_length(btrim(description)) between 20 and 10000),
  constraint events_time_order check (end_at > start_at and ticket_request_deadline < start_at),
  constraint events_capacity_check check (capacity > 0 and capacity <= 100000),
  constraint events_price_check check (ticket_price >= 0),
  constraint events_currency_check check (currency = upper(currency) and currency ~ '^[A-Z]{3}$'),
  constraint events_free_consistency check (
    (is_free and ticket_price = 0 and not bank_transfer_enabled and not cash_payment_enabled)
    or
    (not is_free and ticket_price > 0 and (bank_transfer_enabled or cash_payment_enabled))
  ),
  constraint events_bank_consistency check (
    not bank_transfer_enabled or (nullif(btrim(iban), '') is not null and nullif(btrim(iban_account_name), '') is not null)
  ),
  constraint events_age_check check (age_requirement is null or age_requirement between 0 and 99),
  constraint events_status_check check (
    status in ('draft', 'pending_review', 'published', 'sold_out', 'rejected', 'cancelled', 'completed', 'archived')
  ),
  constraint events_featured_status_check check (featured_status in ('none', 'candidate', 'approved', 'expired')),
  constraint events_free_ticket_mode_check check (free_ticket_mode in ('automatic', 'organizer_approval')),
  constraint events_publish_state check (
    status not in ('published', 'sold_out') or published_at is not null
  ),
  constraint events_feature_state check (
    featured_status <> 'approved' or featured_at is not null
  )
);

create unique index if not exists events_slug_lower_key on public.events (lower(slug));
create unique index if not exists events_id_club_key on public.events (id, club_id);
create index if not exists events_club_status_start_idx on public.events (club_id, status, start_at);
create index if not exists events_university_discovery_idx
  on public.events (university_id, start_at, published_at desc)
  where status in ('published', 'sold_out');
create index if not exists events_featured_discovery_idx
  on public.events (university_id, featured_at desc, start_at)
  where featured_status = 'approved' and status = 'published';
create index if not exists events_pending_review_idx
  on public.events (submitted_at, created_at)
  where status = 'pending_review';

create table if not exists public.event_tickets (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.events(id) on delete restrict,
  user_id text not null references public.users(id) on delete restrict,
  reservation_status text not null,
  reservation_expires_at timestamptz,
  request_status text not null,
  payment_method text,
  payment_status text not null,
  ticket_status text not null,
  amount numeric(12,2) not null,
  currency text not null,
  payment_reference text,
  receipt_url text,
  submitted_payment_at timestamptz,
  cash_payment_deadline timestamptz,
  approved_at timestamptz,
  approved_by text references public.users(id) on delete set null,
  rejected_at timestamptz,
  rejected_by text references public.users(id) on delete set null,
  rejected_reason text,
  clarification_requested_at timestamptz,
  clarification_message text,
  cancelled_at timestamptz,
  cancelled_by text references public.users(id) on delete set null,
  refunded_at timestamptz,
  refunded_by text references public.users(id) on delete set null,
  refund_required_at timestamptz,
  checked_in_at timestamptz,
  checked_in_by text references public.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint event_tickets_reservation_status_check check (
    reservation_status in ('active', 'held_for_review', 'released', 'expired', 'cancelled')
  ),
  constraint event_tickets_request_status_check check (
    request_status in ('pending', 'submitted', 'approved', 'rejected', 'cancelled', 'expired')
  ),
  constraint event_tickets_payment_method_check check (
    payment_method is null or payment_method in ('bank_transfer', 'cash', 'free')
  ),
  constraint event_tickets_payment_status_check check (
    payment_status in ('not_required', 'pending', 'under_review', 'clarification_requested', 'approved', 'rejected', 'refunded')
  ),
  constraint event_tickets_ticket_status_check check (
    ticket_status in ('pending', 'active', 'rejected', 'cancelled', 'refunded', 'checked_in', 'revoked', 'expired')
  ),
  constraint event_tickets_amount_check check (amount >= 0),
  constraint event_tickets_currency_check check (currency = upper(currency) and currency ~ '^[A-Z]{3}$'),
  constraint event_tickets_active_reservation_expiry check (
    reservation_status <> 'active'
    or reservation_expires_at is not null
    or ticket_status in ('active', 'checked_in')
  ),
  constraint event_tickets_held_expiry_check check (
    reservation_status <> 'held_for_review' or reservation_expires_at is null
  ),
  constraint event_tickets_check_in_state check (
    ticket_status <> 'checked_in' or (checked_in_at is not null and checked_in_by is not null)
  ),
  unique (event_id, user_id)
);

create index if not exists event_tickets_user_created_idx
  on public.event_tickets (user_id, created_at desc);
create index if not exists event_tickets_event_status_idx
  on public.event_tickets (event_id, ticket_status, request_status);
create index if not exists event_tickets_active_reservations_idx
  on public.event_tickets (event_id, reservation_expires_at)
  where reservation_status = 'active';
create index if not exists event_tickets_held_review_idx
  on public.event_tickets (event_id, submitted_payment_at)
  where reservation_status = 'held_for_review';
create index if not exists event_tickets_finance_review_idx
  on public.event_tickets (event_id, submitted_payment_at desc)
  where payment_status in ('under_review', 'clarification_requested', 'pending');
create index if not exists event_tickets_unchecked_active_idx
  on public.event_tickets (event_id, user_id)
  where ticket_status = 'active' and checked_in_at is null;
create index if not exists event_tickets_refund_required_idx
  on public.event_tickets (event_id, refund_required_at, submitted_payment_at)
  where refund_required_at is not null and refunded_at is null;

-- Durable replay consumption for legacy/native TOTP credentials.  This table is
-- intentionally unavailable to browser roles; only trusted server code may
-- consume a (user, credential kind, counter) tuple once.
create table if not exists public.qr_credential_uses (
  id uuid primary key default gen_random_uuid(),
  user_id text not null references public.users(id) on delete cascade,
  kind text not null,
  counter bigint not null,
  created_at timestamptz not null default now(),
  constraint qr_credential_uses_kind_length check (char_length(btrim(kind)) between 2 and 40),
  constraint qr_credential_uses_counter_nonnegative check (counter >= 0),
  unique (user_id, kind, counter)
);

create index if not exists qr_credential_uses_user_created_idx
  on public.qr_credential_uses (user_id, created_at desc);

create table if not exists public.event_ticket_clarifications (
  id uuid primary key default gen_random_uuid(),
  ticket_id uuid not null references public.event_tickets(id) on delete cascade,
  sender_user_id text references public.users(id) on delete set null,
  sender_role text not null,
  message text not null,
  created_at timestamptz not null default now(),
  constraint event_ticket_clarifications_sender_check check (
    sender_role in ('student', 'club_owner', 'finance_manager')
  ),
  constraint event_ticket_clarifications_message_length check (char_length(btrim(message)) between 1 and 2000)
);

create index if not exists event_ticket_clarifications_ticket_created_idx
  on public.event_ticket_clarifications (ticket_id, created_at desc);

create table if not exists public.event_scanner_assignments (
  id uuid primary key default gen_random_uuid(),
  club_id uuid not null references public.student_clubs(id) on delete cascade,
  event_id uuid not null references public.events(id) on delete cascade,
  user_id text not null references public.users(id) on delete cascade,
  assigned_by text not null references public.users(id) on delete restrict,
  assigned_at timestamptz not null default now(),
  revoked_at timestamptz,
  revoked_by text references public.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (event_id, user_id)
);

alter table public.events
  drop constraint if exists events_club_university_fk;
alter table public.events
  add constraint events_club_university_fk
  foreign key (club_id, university_id)
  references public.student_clubs(id, university_id)
  on delete restrict;

alter table public.event_scanner_assignments
  drop constraint if exists event_scanner_assignments_event_club_fk;
alter table public.event_scanner_assignments
  add constraint event_scanner_assignments_event_club_fk
  foreign key (event_id, club_id)
  references public.events(id, club_id)
  on delete cascade;

create index if not exists event_scanner_assignments_user_active_idx
  on public.event_scanner_assignments (user_id, event_id)
  where revoked_at is null;
create index if not exists event_scanner_assignments_club_event_idx
  on public.event_scanner_assignments (club_id, event_id);

create table if not exists public.event_check_ins (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.events(id) on delete restrict,
  ticket_id uuid not null references public.event_tickets(id) on delete restrict,
  user_id text not null references public.users(id) on delete restrict,
  scanner_user_id text not null references public.users(id) on delete restrict,
  qr_kind text,
  checked_in_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  unique (ticket_id),
  unique (event_id, user_id)
);

create index if not exists event_check_ins_event_time_idx
  on public.event_check_ins (event_id, checked_in_at desc);
create index if not exists event_check_ins_scanner_time_idx
  on public.event_check_ins (scanner_user_id, checked_in_at desc);

create table if not exists public.event_audit_logs (
  id uuid primary key default gen_random_uuid(),
  university_id uuid references public.universities(id) on delete set null,
  club_id uuid references public.student_clubs(id) on delete set null,
  event_id uuid references public.events(id) on delete set null,
  ticket_id uuid references public.event_tickets(id) on delete set null,
  actor_user_id text references public.users(id) on delete set null,
  action text not null,
  metadata jsonb not null default '{}'::jsonb,
  ip_hash text,
  created_at timestamptz not null default now(),
  constraint event_audit_logs_action_length check (char_length(action) between 2 and 100),
  constraint event_audit_logs_metadata_object check (jsonb_typeof(metadata) = 'object')
);

create index if not exists event_audit_logs_club_created_idx
  on public.event_audit_logs (club_id, created_at desc);
create index if not exists event_audit_logs_event_created_idx
  on public.event_audit_logs (event_id, created_at desc);
create index if not exists event_audit_logs_ticket_created_idx
  on public.event_audit_logs (ticket_id, created_at desc);
create index if not exists event_audit_logs_actor_created_idx
  on public.event_audit_logs (actor_user_id, created_at desc);

create or replace function private.audit_club_role_assignment()
returns trigger
language plpgsql
security invoker
set search_path = public, private, pg_temp
as $$
begin
  insert into public.event_audit_logs (
    university_id, club_id, actor_user_id, action, metadata
  )
  select club.university_id,
         new.club_id,
         new.user_id,
         'role_assigned',
         jsonb_build_object('membership_id', new.id::text, 'role', new.role)
    from public.student_clubs club
   where club.id = new.club_id;
  return new;
end;
$$;

drop trigger if exists club_membership_role_assigned_audit on public.club_memberships;
create trigger club_membership_role_assigned_audit
after update of status on public.club_memberships
for each row
when (old.status = 'invited' and new.status = 'active')
execute function private.audit_club_role_assignment();

drop trigger if exists set_student_clubs_updated_at on public.student_clubs;
create trigger set_student_clubs_updated_at
before update on public.student_clubs
for each row execute function public.set_current_updated_at();

drop trigger if exists set_club_memberships_updated_at on public.club_memberships;
create trigger set_club_memberships_updated_at
before update on public.club_memberships
for each row execute function public.set_current_updated_at();

drop trigger if exists set_events_updated_at on public.events;
create trigger set_events_updated_at
before update on public.events
for each row execute function public.set_current_updated_at();

drop trigger if exists set_event_tickets_updated_at on public.event_tickets;
create trigger set_event_tickets_updated_at
before update on public.event_tickets
for each row execute function public.set_current_updated_at();

drop trigger if exists set_event_scanner_assignments_updated_at on public.event_scanner_assignments;
create trigger set_event_scanner_assignments_updated_at
before update on public.event_scanner_assignments
for each row execute function public.set_current_updated_at();

create or replace function private.event_audit_metadata_has_forbidden_key(candidate jsonb)
returns boolean
language plpgsql
immutable
security definer
set search_path = pg_catalog, private, pg_temp
as $$
declare
  item record;
begin
  if candidate is null then
    return false;
  end if;

  if jsonb_typeof(candidate) = 'object' then
    for item in select entry.key, entry.value from jsonb_each(candidate) as entry
    loop
      if lower(item.key) = any(array[
        'otp', 'password', 'access_token', 'refresh_token', 'qr_secret',
        'service_role_key', 'session_cookie', 'receipt_binary', 'iban'
      ]) or private.event_audit_metadata_has_forbidden_key(item.value) then
        return true;
      end if;
    end loop;
  elsif jsonb_typeof(candidate) = 'array' then
    for item in select entry.value from jsonb_array_elements(candidate) as entry
    loop
      if private.event_audit_metadata_has_forbidden_key(item.value) then
        return true;
      end if;
    end loop;
  end if;

  return false;
end;
$$;

revoke all on function private.event_audit_metadata_has_forbidden_key(jsonb) from public, anon, authenticated;
grant execute on function private.event_audit_metadata_has_forbidden_key(jsonb) to service_role;

alter table public.event_audit_logs
  drop constraint if exists event_audit_logs_no_secret_keys;
alter table public.event_audit_logs
  add constraint event_audit_logs_no_secret_keys check (
    not private.event_audit_metadata_has_forbidden_key(metadata)
  );

create or replace function private.prevent_event_audit_mutation()
returns trigger
language plpgsql
set search_path = public, pg_temp
as $$
begin
  raise exception using errcode = 'P0001', message = 'event_audit_logs_are_append_only';
end;
$$;

revoke all on function private.prevent_event_audit_mutation() from public, anon, authenticated;

drop trigger if exists event_audit_logs_append_only on public.event_audit_logs;
create trigger event_audit_logs_append_only
before update or delete on public.event_audit_logs
for each row execute function private.prevent_event_audit_mutation();

create or replace function private.event_current_user_id()
returns text
language sql
stable
security definer
set search_path = public, auth, pg_temp
as $$
  select app_user.id
    from public.users app_user
   where app_user.auth_user_id = (select auth.uid())
     and app_user.status = 'active'
   limit 1;
$$;

create or replace function private.event_has_club_role(
  target_club_id uuid,
  allowed_roles text[]
)
returns boolean
language sql
stable
security definer
set search_path = public, auth, pg_temp
as $$
  select exists (
    select 1
      from public.club_memberships membership
     where membership.club_id = target_club_id
       and membership.user_id = private.event_current_user_id()
       and membership.status = 'active'
       and membership.role = any(allowed_roles)
  );
$$;

revoke all on function private.event_current_user_id() from public, anon;
revoke all on function private.event_has_club_role(uuid, text[]) from public, anon;
grant execute on function private.event_current_user_id() to authenticated, service_role;
grant execute on function private.event_has_club_role(uuid, text[]) to authenticated, service_role;

alter table public.student_clubs enable row level security;
alter table public.club_memberships enable row level security;
alter table public.club_application_messages enable row level security;
alter table public.events enable row level security;
alter table public.event_tickets enable row level security;
alter table public.qr_credential_uses enable row level security;
alter table public.event_ticket_clarifications enable row level security;
alter table public.event_scanner_assignments enable row level security;
alter table public.event_check_ins enable row level security;
alter table public.event_audit_logs enable row level security;

revoke all on table public.student_clubs from anon, authenticated;
revoke all on table public.club_memberships from anon, authenticated;
revoke all on table public.club_application_messages from anon, authenticated;
revoke all on table public.events from anon, authenticated;
revoke all on table public.event_tickets from anon, authenticated;
revoke all on table public.qr_credential_uses from public, anon, authenticated;
revoke all on table public.event_ticket_clarifications from anon, authenticated;
revoke all on table public.event_scanner_assignments from anon, authenticated;
revoke all on table public.event_check_ins from anon, authenticated;
revoke all on table public.event_audit_logs from anon, authenticated;

grant all on table public.student_clubs to service_role;
grant all on table public.club_memberships to service_role;
grant all on table public.club_application_messages to service_role;
grant all on table public.events to service_role;
grant all on table public.event_tickets to service_role;
grant all on table public.qr_credential_uses to service_role;
grant all on table public.event_ticket_clarifications to service_role;
grant all on table public.event_scanner_assignments to service_role;
grant all on table public.event_check_ins to service_role;
grant select, insert on table public.event_audit_logs to service_role;

drop policy if exists student_clubs_authorized_read on public.student_clubs;
create policy student_clubs_authorized_read
on public.student_clubs
for select
to authenticated
using (
  private.event_has_club_role(id, array['club_owner', 'event_organizer', 'finance_manager', 'door_scanner'])
  or (
    status = 'approved'
    and university_id = (
      select app_user.university_id
        from public.users app_user
       where app_user.id = private.event_current_user_id()
    )
  )
);

drop policy if exists club_memberships_authorized_read on public.club_memberships;
create policy club_memberships_authorized_read
on public.club_memberships
for select
to authenticated
using (
  user_id = private.event_current_user_id()
  or private.event_has_club_role(club_id, array['club_owner'])
);

drop policy if exists club_application_messages_authorized_read on public.club_application_messages;
create policy club_application_messages_authorized_read
on public.club_application_messages
for select
to authenticated
using (
  private.event_has_club_role(club_id, array['club_owner'])
);

drop policy if exists events_authorized_read on public.events;
create policy events_authorized_read
on public.events
for select
to authenticated
using (
  private.event_has_club_role(club_id, array['club_owner', 'event_organizer', 'finance_manager', 'door_scanner'])
  or (
    status in ('published', 'sold_out')
    and university_id = (
      select app_user.university_id
        from public.users app_user
       where app_user.id = private.event_current_user_id()
    )
  )
);

drop policy if exists event_tickets_authorized_read on public.event_tickets;
create policy event_tickets_authorized_read
on public.event_tickets
for select
to authenticated
using (
  user_id = private.event_current_user_id()
  or exists (
    select 1
      from public.events event
     where event.id = event_tickets.event_id
       and private.event_has_club_role(event.club_id, array['club_owner', 'event_organizer', 'finance_manager'])
  )
);

drop policy if exists event_ticket_clarifications_authorized_read on public.event_ticket_clarifications;
create policy event_ticket_clarifications_authorized_read
on public.event_ticket_clarifications
for select
to authenticated
using (
  exists (
    select 1
      from public.event_tickets ticket
      join public.events event on event.id = ticket.event_id
     where ticket.id = event_ticket_clarifications.ticket_id
       and (
         ticket.user_id = private.event_current_user_id()
         or private.event_has_club_role(event.club_id, array['club_owner', 'finance_manager'])
       )
  )
);

drop policy if exists event_scanner_assignments_authorized_read on public.event_scanner_assignments;
create policy event_scanner_assignments_authorized_read
on public.event_scanner_assignments
for select
to authenticated
using (
  user_id = private.event_current_user_id()
  or private.event_has_club_role(club_id, array['club_owner', 'event_organizer'])
);

drop policy if exists event_check_ins_authorized_read on public.event_check_ins;
create policy event_check_ins_authorized_read
on public.event_check_ins
for select
to authenticated
using (
  user_id = private.event_current_user_id()
  or exists (
    select 1
      from public.events event
     where event.id = event_check_ins.event_id
       and (
         private.event_has_club_role(event.club_id, array['club_owner', 'event_organizer'])
         or exists (
           select 1
             from public.event_scanner_assignments assignment
            where assignment.event_id = event_check_ins.event_id
              and assignment.user_id = private.event_current_user_id()
              and assignment.revoked_at is null
         )
       )
  )
);

drop policy if exists event_audit_logs_owner_read on public.event_audit_logs;
create policy event_audit_logs_owner_read
on public.event_audit_logs
for select
to authenticated
using (
  club_id is not null
  and private.event_has_club_role(club_id, array['club_owner'])
);

-- There are intentionally no authenticated INSERT/UPDATE/DELETE policies or
-- table grants. All state transitions pass through server authorization and
-- the private transactional functions below.

do $$
begin
  if to_regclass('storage.buckets') is not null then
    insert into storage.buckets (id, name, "public", file_size_limit, allowed_mime_types)
    values (
      'event-assets',
      'event-assets',
      false,
      10485760,
      array['image/avif', 'image/jpeg', 'image/png', 'image/webp']::text[]
    )
    on conflict (id) do update
      set "public" = excluded."public",
          file_size_limit = excluded.file_size_limit,
          allowed_mime_types = excluded.allowed_mime_types;

    insert into storage.buckets (id, name, "public", file_size_limit, allowed_mime_types)
    values (
      'club-verification',
      'club-verification',
      false,
      10485760,
      array['application/pdf', 'image/jpeg', 'image/png']::text[]
    )
    on conflict (id) do update
      set "public" = excluded."public",
          file_size_limit = excluded.file_size_limit,
          allowed_mime_types = excluded.allowed_mime_types;

    insert into storage.buckets (id, name, "public", file_size_limit, allowed_mime_types)
    values (
      'event-receipts',
      'event-receipts',
      false,
      8388608,
      array['application/pdf', 'image/jpeg', 'image/png', 'image/webp']::text[]
    )
    on conflict (id) do update
      set "public" = excluded."public",
          file_size_limit = excluded.file_size_limit,
          allowed_mime_types = excluded.allowed_mime_types;
  end if;
end;
$$;

grant select on table storage.buckets to service_role;
grant select, insert, update, delete on table storage.objects to service_role;

drop policy if exists service_role_cadesca_events_storage_all on storage.objects;
create policy service_role_cadesca_events_storage_all
on storage.objects
for all
to service_role
using (bucket_id in ('event-assets', 'club-verification', 'event-receipts'))
with check (bucket_id in ('event-assets', 'club-verification', 'event-receipts'));

-- Every ticket/admission transition serializes on the event and acquires
-- heavyweight row locks in one order: advisory event key, club, then event.
-- Authorization/user rows and finally ticket rows are locked by the caller.
create or replace function private.lock_event_context(target_event_id uuid)
returns void
language plpgsql
security definer
set search_path = public, private, pg_temp
as $$
declare
  resolved_club_id uuid;
  locked_club_id uuid;
begin
  if target_event_id is null then
    raise exception using errcode = 'P0001', message = 'event_not_found';
  end if;

  perform pg_advisory_xact_lock(hashtextextended(target_event_id::text, 0));

  select event.club_id
    into resolved_club_id
    from public.events event
   where event.id = target_event_id;
  if not found then
    raise exception using errcode = 'P0001', message = 'event_not_found';
  end if;

  perform 1
    from public.student_clubs club
   where club.id = resolved_club_id
   for share;
  if not found then
    raise exception using errcode = 'P0001', message = 'event_not_found';
  end if;

  select event.club_id
    into locked_club_id
    from public.events event
   where event.id = target_event_id
   for update;
  if not found then
    raise exception using errcode = 'P0001', message = 'event_not_found';
  end if;
  if locked_club_id <> resolved_club_id then
    raise exception using errcode = '40001', message = 'event_context_changed';
  end if;
end;
$$;

revoke all on function private.lock_event_context(uuid) from public, anon, authenticated, service_role;

create or replace function private.refresh_event_capacity_status(target_event_id uuid)
returns void
language plpgsql
security definer
set search_path = public, private, pg_temp
as $$
declare
  event_capacity integer;
  consumed integer;
  current_status text;
begin
  perform private.lock_event_context(target_event_id);

  select capacity, status
    into event_capacity, current_status
    from public.events
   where id = target_event_id;

  if event_capacity is null or current_status not in ('published', 'sold_out') then
    return;
  end if;

  select count(*)::int
    into consumed
    from public.event_tickets ticket
   where ticket.event_id = target_event_id
     and (
       ticket.ticket_status in ('active', 'checked_in')
       or ticket.reservation_status = 'held_for_review'
       or (
         ticket.reservation_status = 'active'
         and ticket.reservation_expires_at is not null
         and ticket.reservation_expires_at > clock_timestamp()
       )
     );

  if consumed >= event_capacity and current_status = 'published' then
    update public.events set status = 'sold_out', updated_at = now() where id = target_event_id;
  elsif consumed < event_capacity and current_status = 'sold_out' then
    update public.events set status = 'published', updated_at = now() where id = target_event_id;
  end if;
end;
$$;

create or replace function private.expire_event_reservations(target_event_id uuid default null)
returns table(expired_count integer)
language plpgsql
security definer
set search_path = public, private, pg_temp
as $$
declare
  affected_event_id uuid;
  event_expired_count integer := 0;
  total_expired integer := 0;
begin
  if target_event_id is null then
    -- Transaction-level advisory locks persist until this cron transaction
    -- commits, so all workers traverse event UUIDs in the same order.
    for affected_event_id in
      select event.id
        from public.events event
       where (
         event.status = 'sold_out'
         or (event.status in ('published', 'sold_out') and event.end_at <= clock_timestamp())
         or (
           event.featured_status = 'approved'
           and event.featured_until is not null
           and event.featured_until <= clock_timestamp()
         )
         or exists (
           select 1
             from public.event_tickets ticket
            where ticket.event_id = event.id
              and ticket.ticket_status = 'pending'
              and (
                (
                  ticket.reservation_status = 'active'
                  and ticket.reservation_expires_at is not null
                  and ticket.reservation_expires_at <= clock_timestamp()
                )
                or (
                  ticket.reservation_status = 'held_for_review'
                  and ticket.payment_method = 'cash'
                  and ticket.payment_status = 'pending'
                  and ticket.cash_payment_deadline is not null
                  and ticket.cash_payment_deadline <= clock_timestamp()
                )
              )
         )
       )
       order by event.id
    loop
      select expiration.expired_count
        into event_expired_count
        from private.expire_event_reservations(affected_event_id) expiration;
      total_expired := total_expired + coalesce(event_expired_count, 0);
    end loop;

    return query select total_expired;
    return;
  end if;

  perform private.lock_event_context(target_event_id);

  with expired as (
    update public.event_tickets ticket
       set reservation_status = 'expired',
           request_status = 'expired',
           payment_status = case
             when ticket.payment_status = 'not_required' then 'not_required'
             else 'rejected'
           end,
           ticket_status = 'expired',
           rejected_reason = coalesce(ticket.rejected_reason, 'deadline_expired'),
           reservation_expires_at = null,
           refund_required_at = null,
           updated_at = now()
     where ticket.event_id = target_event_id
       and ticket.ticket_status = 'pending'
       and (
         (
           ticket.reservation_status = 'active'
           and ticket.reservation_expires_at is not null
           and ticket.reservation_expires_at <= clock_timestamp()
         )
         or (
           ticket.reservation_status = 'held_for_review'
           and ticket.payment_method = 'cash'
           and ticket.payment_status = 'pending'
           and ticket.cash_payment_deadline is not null
           and ticket.cash_payment_deadline <= clock_timestamp()
         )
       )
     returning ticket.id, ticket.event_id, ticket.user_id
  ), logged as (
    insert into public.event_audit_logs (
      university_id, club_id, event_id, ticket_id, actor_user_id, action, metadata
    )
    select event.university_id,
           event.club_id,
           expired.event_id,
           expired.id,
           expired.user_id,
           audit_action.action,
           '{}'::jsonb
      from expired
      join public.events event on event.id = expired.event_id
      cross join (values ('reservation_expired'::text), ('reservation_released'::text)) audit_action(action)
    returning event_id, action
  )
  select count(*) filter (where action = 'reservation_expired')::int into event_expired_count from logged;

  perform private.refresh_event_capacity_status(target_event_id);

  update public.events event
     set featured_status = 'expired',
         updated_at = now()
   where event.id = target_event_id
     and event.featured_status = 'approved'
     and event.featured_until is not null
     and event.featured_until <= clock_timestamp();

  update public.events event
     set status = 'completed',
         featured_status = case when event.featured_status = 'approved' then 'expired' else event.featured_status end,
         updated_at = now()
   where event.id = target_event_id
     and event.status in ('published', 'sold_out')
     and event.end_at <= clock_timestamp();

  return query select coalesce(event_expired_count, 0);
end;
$$;

create or replace function private.reserve_event_ticket(
  target_event_id uuid,
  target_user_id text,
  requested_payment_method text default null
)
returns table(
  ticket_id uuid,
  reservation_status text,
  request_status text,
  payment_status text,
  ticket_status text,
  reservation_expires_at timestamptz
)
language plpgsql
security definer
set search_path = public, private, pg_temp
as $$
declare
  event_row public.events%rowtype;
  club_status text;
  student_row public.users%rowtype;
  consumed integer;
  created_ticket public.event_tickets%rowtype;
  chosen_method text;
begin
  if target_event_id is null or nullif(btrim(target_user_id), '') is null then
    raise exception using errcode = 'P0001', message = 'event_not_found';
  end if;

  perform private.lock_event_context(target_event_id);

  select event.*
    into event_row
    from public.events event
   where event.id = target_event_id;

  select club.status into club_status
    from public.student_clubs club
   where club.id = event_row.club_id;

  if club_status <> 'approved'
     or event_row.status not in ('published', 'sold_out')
     or event_row.start_at <= clock_timestamp()
     or event_row.ticket_request_deadline <= clock_timestamp() then
    raise exception using errcode = 'P0001', message = 'event_unavailable';
  end if;

  select app_user.*
    into student_row
    from public.users app_user
   where app_user.id = target_user_id
   for share;

  if not found
     or student_row.status <> 'active'
     or student_row.student_status <> 'verified'
     or student_row.university_id is null
     or student_row.university_id <> event_row.university_id then
    raise exception using errcode = 'P0001', message = 'verified_student_required';
  end if;

  perform private.expire_event_reservations(target_event_id);

  if exists (
    select 1
      from public.event_tickets ticket
     where ticket.event_id = target_event_id
       and ticket.user_id = target_user_id
  ) then
    raise exception using errcode = '23505', message = 'duplicate_ticket_request';
  end if;

  select count(*)::int
    into consumed
    from public.event_tickets ticket
   where ticket.event_id = target_event_id
     and (
       ticket.ticket_status in ('active', 'checked_in')
       or ticket.reservation_status = 'held_for_review'
       or (
         ticket.reservation_status = 'active'
         and ticket.reservation_expires_at is not null
         and ticket.reservation_expires_at > clock_timestamp()
       )
     );

  if consumed >= event_row.capacity then
    perform private.refresh_event_capacity_status(target_event_id);
    raise exception using errcode = 'P0001', message = 'no_places_available';
  end if;

  if event_row.is_free then
    if requested_payment_method is not null and requested_payment_method <> 'free' then
      raise exception using errcode = 'P0001', message = 'invalid_payment_method';
    end if;
    chosen_method := 'free';
  else
    chosen_method := requested_payment_method;
    if chosen_method is not null and chosen_method not in ('bank_transfer', 'cash') then
      raise exception using errcode = 'P0001', message = 'invalid_payment_method';
    end if;
    if chosen_method = 'bank_transfer' and not event_row.bank_transfer_enabled then
      raise exception using errcode = 'P0001', message = 'payment_method_unavailable';
    end if;
    if chosen_method = 'cash' and not event_row.cash_payment_enabled then
      raise exception using errcode = 'P0001', message = 'payment_method_unavailable';
    end if;
  end if;

  if event_row.is_free and event_row.free_ticket_mode = 'automatic' then
    insert into public.event_tickets (
      event_id, user_id, reservation_status, reservation_expires_at,
      request_status, payment_method, payment_status, ticket_status,
      amount, currency, approved_at
    ) values (
      target_event_id, target_user_id, 'active', null,
      'approved', 'free', 'not_required', 'active',
      0, event_row.currency, now()
    ) returning * into created_ticket;
  elsif event_row.is_free then
    insert into public.event_tickets (
      event_id, user_id, reservation_status, reservation_expires_at,
      request_status, payment_method, payment_status, ticket_status,
      amount, currency
    ) values (
      target_event_id, target_user_id, 'held_for_review', null,
      'pending', 'free', 'not_required', 'pending',
      0, event_row.currency
    ) returning * into created_ticket;
  else
    insert into public.event_tickets (
      event_id, user_id, reservation_status, reservation_expires_at,
      request_status, payment_method, payment_status, ticket_status,
      amount, currency
    ) values (
      target_event_id, target_user_id, 'active', clock_timestamp() + interval '30 minutes',
      'pending', chosen_method, 'pending', 'pending',
      event_row.ticket_price, event_row.currency
    ) returning * into created_ticket;
  end if;

  insert into public.event_audit_logs (
    university_id, club_id, event_id, ticket_id, actor_user_id, action, metadata
  )
  select event_row.university_id,
         event_row.club_id,
         target_event_id,
         created_ticket.id,
         target_user_id,
         audit_action.action,
         jsonb_build_object('payment_method', coalesce(chosen_method, 'not_selected'))
    from (values ('ticket_requested'::text), ('reservation_created'::text)) audit_action(action);

  perform private.refresh_event_capacity_status(target_event_id);

  return query
    select created_ticket.id,
           created_ticket.reservation_status,
           created_ticket.request_status,
           created_ticket.payment_status,
           created_ticket.ticket_status,
           created_ticket.reservation_expires_at;
end;
$$;

create or replace function private.submit_event_payment(
  target_ticket_id uuid,
  target_user_id text,
  submitted_reference text,
  submitted_receipt_url text
)
returns table(
  ticket_id uuid,
  reservation_status text,
  request_status text,
  payment_status text,
  ticket_status text
)
language plpgsql
security definer
set search_path = public, private, pg_temp
as $$
declare
  ticket_row public.event_tickets%rowtype;
  event_row public.events%rowtype;
  student_row public.users%rowtype;
  preliminary_event_id uuid;
  club_status text;
  was_clarification boolean;
begin
  if nullif(btrim(submitted_receipt_url), '') is null
     or submitted_receipt_url like '/%'
     or submitted_receipt_url like '%..%' then
    raise exception using errcode = 'P0001', message = 'payment_evidence_required';
  end if;

  select ticket.event_id
    into preliminary_event_id
    from public.event_tickets ticket
   where ticket.id = target_ticket_id;
  if not found then
    raise exception using errcode = 'P0001', message = 'ticket_not_found';
  end if;

  perform private.lock_event_context(preliminary_event_id);
  select event.* into event_row from public.events event where event.id = preliminary_event_id;
  select club.status into club_status from public.student_clubs club where club.id = event_row.club_id;

  if club_status <> 'approved'
     or event_row.status not in ('published', 'sold_out')
     or event_row.start_at <= clock_timestamp() then
    raise exception using errcode = 'P0001', message = 'event_unavailable';
  end if;

  select app_user.*
    into student_row
    from public.users app_user
   where app_user.id = target_user_id
   for share;
  if not found
     or student_row.status <> 'active'
     or student_row.student_status <> 'verified'
     or student_row.university_id is null
     or student_row.university_id <> event_row.university_id then
    raise exception using errcode = 'P0001', message = 'ticket_not_found';
  end if;

  perform private.expire_event_reservations(preliminary_event_id);
  select ticket.* into ticket_row
    from public.event_tickets ticket
   where ticket.id = target_ticket_id
   for update;
  if not found or ticket_row.user_id <> target_user_id or ticket_row.event_id <> preliminary_event_id then
    raise exception using errcode = 'P0001', message = 'ticket_not_found';
  end if;

  if not event_row.bank_transfer_enabled
     or coalesce(ticket_row.payment_method, 'bank_transfer') <> 'bank_transfer' then
    raise exception using errcode = 'P0001', message = 'payment_method_unavailable';
  end if;

  was_clarification := ticket_row.payment_status = 'clarification_requested';
  if not was_clarification and event_row.ticket_request_deadline <= clock_timestamp() then
    raise exception using errcode = 'P0001', message = 'event_unavailable';
  end if;
  if not (
    (
      ticket_row.reservation_status = 'active'
      and ticket_row.ticket_status = 'pending'
      and ticket_row.reservation_expires_at > clock_timestamp()
    )
    or (
      ticket_row.reservation_status = 'held_for_review'
      and ticket_row.ticket_status = 'pending'
      and ticket_row.payment_status = 'clarification_requested'
    )
  ) then
    raise exception using errcode = 'P0001', message = 'reservation_expired';
  end if;

  update public.event_tickets
     set payment_method = 'bank_transfer',
         payment_reference = nullif(btrim(submitted_reference), ''),
         receipt_url = submitted_receipt_url,
         submitted_payment_at = clock_timestamp(),
         payment_status = 'under_review',
         request_status = 'submitted',
         reservation_status = 'held_for_review',
         reservation_expires_at = null,
         clarification_message = case when was_clarification then null else clarification_message end,
         updated_at = now()
   where id = target_ticket_id
   returning * into ticket_row;

  if was_clarification then
    insert into public.event_ticket_clarifications (ticket_id, sender_user_id, sender_role, message)
    values (target_ticket_id, target_user_id, 'student', 'payment_evidence_resubmitted');
  end if;

  insert into public.event_audit_logs (
    university_id, club_id, event_id, ticket_id, actor_user_id, action, metadata
  ) values (
    event_row.university_id,
    event_row.club_id,
    event_row.id,
    target_ticket_id,
    target_user_id,
    'payment_evidence_uploaded',
    jsonb_build_object('has_reference', nullif(btrim(submitted_reference), '') is not null)
  );

  return query select ticket_row.id,
                      ticket_row.reservation_status,
                      ticket_row.request_status,
                      ticket_row.payment_status,
                      ticket_row.ticket_status;
end;
$$;

create or replace function private.arrange_cash_payment(
  target_ticket_id uuid,
  actor_user_id text,
  requested_deadline timestamptz
)
returns table(
  ticket_id uuid,
  reservation_status text,
  request_status text,
  payment_status text,
  ticket_status text,
  cash_payment_deadline timestamptz
)
language plpgsql
security definer
set search_path = public, private, pg_temp
as $$
declare
  ticket_row public.event_tickets%rowtype;
  event_row public.events%rowtype;
  actor_row public.users%rowtype;
  student_row public.users%rowtype;
  preliminary_event_id uuid;
  preliminary_student_user_id text;
  club_status text;
  actor_role text;
  safe_deadline timestamptz;
begin
  select ticket.event_id, ticket.user_id
    into preliminary_event_id, preliminary_student_user_id
    from public.event_tickets ticket
   where ticket.id = target_ticket_id;
  if not found then
    raise exception using errcode = 'P0001', message = 'ticket_not_found';
  end if;

  perform private.lock_event_context(preliminary_event_id);
  select event.* into event_row from public.events event where event.id = preliminary_event_id;
  select club.status into club_status from public.student_clubs club where club.id = event_row.club_id;

  if club_status <> 'approved'
     or event_row.status not in ('published', 'sold_out')
     or event_row.start_at <= clock_timestamp()
     or event_row.ticket_request_deadline <= clock_timestamp() then
    raise exception using errcode = 'P0001', message = 'event_unavailable';
  end if;

  -- Arrangement is a club-side acceptance step. Lock authorization rows before
  -- the ticket so revocation cannot race this transition.
  perform membership.id
    from public.club_memberships membership
   where membership.club_id = event_row.club_id
     and membership.user_id = actor_user_id
   for share;

  select app_user.*
    into actor_row
    from public.users app_user
   where app_user.id = actor_user_id
   for share;
  if not found or actor_row.status <> 'active' then
    raise exception using errcode = 'P0001', message = 'finance_access_denied';
  end if;

  select membership.role
    into actor_role
    from public.club_memberships membership
   where membership.club_id = event_row.club_id
     and membership.user_id = actor_user_id
     and membership.status = 'active'
     and membership.role in ('club_owner', 'event_organizer', 'finance_manager')
   order by
     membership.role = 'club_owner' desc,
     membership.role = 'finance_manager' desc
   limit 1;
  if actor_role is null then
    raise exception using errcode = 'P0001', message = 'finance_access_denied';
  end if;

  select app_user.*
    into student_row
    from public.users app_user
   where app_user.id = preliminary_student_user_id
   for share;
  if not found
     or student_row.status <> 'active'
     or student_row.student_status <> 'verified'
     or student_row.university_id is null
     or student_row.university_id <> event_row.university_id then
    raise exception using errcode = 'P0001', message = 'ticket_not_found';
  end if;

  perform private.expire_event_reservations(preliminary_event_id);
  select ticket.* into ticket_row
    from public.event_tickets ticket
   where ticket.id = target_ticket_id
   for update;
  if not found or ticket_row.event_id <> preliminary_event_id then
    raise exception using errcode = 'P0001', message = 'ticket_not_found';
  end if;

  if not event_row.cash_payment_enabled
     or ticket_row.payment_method not in ('cash')
     or ticket_row.reservation_status <> 'active'
     or ticket_row.ticket_status <> 'pending'
     or ticket_row.reservation_expires_at <= clock_timestamp() then
    raise exception using errcode = 'P0001', message = 'payment_method_unavailable';
  end if;

  safe_deadline := least(
    coalesce(requested_deadline, clock_timestamp() + interval '24 hours'),
    event_row.start_at - interval '1 hour'
  );
  if safe_deadline is null or safe_deadline <= clock_timestamp() then
    raise exception using errcode = 'P0001', message = 'payment_method_unavailable';
  end if;

  update public.event_tickets
     set payment_method = 'cash',
         reservation_status = 'held_for_review',
         reservation_expires_at = null,
         request_status = 'submitted',
         payment_status = 'pending',
         cash_payment_deadline = safe_deadline,
         updated_at = now()
   where id = target_ticket_id
   returning * into ticket_row;

  insert into public.event_audit_logs (
    university_id, club_id, event_id, ticket_id, actor_user_id, action, metadata
  ) values (
    event_row.university_id,
    event_row.club_id,
    event_row.id,
    target_ticket_id,
    actor_user_id,
    'cash_payment_arranged',
    jsonb_build_object('deadline', safe_deadline, 'actor_role', actor_role)
  );

  return query select ticket_row.id,
                      ticket_row.reservation_status,
                      ticket_row.request_status,
                      ticket_row.payment_status,
                      ticket_row.ticket_status,
                      ticket_row.cash_payment_deadline;
end;
$$;

create or replace function private.confirm_event_check_in(
  target_event_id uuid,
  target_student_user_id text,
  target_scanner_user_id text,
  scanned_qr_kind text default null
)
returns table(
  result text,
  checked_in_at timestamptz,
  ticket_id uuid
)
language plpgsql
security definer
set search_path = public, private, pg_temp
as $$
declare
  event_row public.events%rowtype;
  ticket_row public.event_tickets%rowtype;
  student_row public.users%rowtype;
  scanner_row public.users%rowtype;
  club_status text;
  assignment_found boolean := false;
  membership_found boolean := false;
  scanner_found boolean := false;
  admission_ticket_id uuid;
  confirmed_at timestamptz;
begin
  perform private.lock_event_context(target_event_id);
  select event.* into event_row from public.events event where event.id = target_event_id;

  select club.status into club_status
    from public.student_clubs club
   where club.id = event_row.club_id;

  if club_status <> 'approved'
     or event_row.status not in ('published', 'sold_out')
     or clock_timestamp() < event_row.start_at - interval '6 hours'
     or clock_timestamp() > event_row.end_at + interval '2 hours' then
    raise exception using errcode = 'P0001', message = 'event_unavailable';
  end if;

  perform assignment.id
    from public.event_scanner_assignments assignment
   where assignment.event_id = target_event_id
     and assignment.user_id = target_scanner_user_id
     and assignment.club_id = event_row.club_id
     and assignment.revoked_at is null
   for share;
  assignment_found := found;

  perform membership.id
    from public.club_memberships membership
   where membership.club_id = event_row.club_id
     and membership.user_id = target_scanner_user_id
     and membership.role = 'door_scanner'
     and membership.status = 'active'
   for share;
  membership_found := found;

  select scanner.*
    into scanner_row
    from public.users scanner
   where scanner.id = target_scanner_user_id
   for share;
  scanner_found := found;

  if not assignment_found or not membership_found or not scanner_found or scanner_row.status <> 'active' then
    insert into public.event_audit_logs (
      university_id, club_id, event_id, actor_user_id, action, metadata
    ) values (
      event_row.university_id,
      event_row.club_id,
      event_row.id,
      case when scanner_found then target_scanner_user_id else null end,
      'unauthorized_scan_attempted',
      jsonb_build_object(
        'assignment_active', assignment_found,
        'membership_active', membership_found,
        'scanner_active', scanner_found and scanner_row.status = 'active'
      )
    );
    return query select 'unauthorized_scanner'::text, null::timestamptz, null::uuid;
    return;
  end if;

  select student.* into student_row
    from public.users student
   where student.id = target_student_user_id
   for share;
  if not found
     or student_row.status <> 'active'
     or student_row.student_status <> 'verified'
     or student_row.university_id is null
     or student_row.university_id <> event_row.university_id then
    raise exception using errcode = 'P0001', message = 'wrong_university';
  end if;

  select * into ticket_row
    from public.event_tickets
   where event_id = target_event_id
     and user_id = target_student_user_id
   for update;
  if not found then
    raise exception using errcode = 'P0001', message = 'no_ticket';
  end if;
  if ticket_row.checked_in_at is not null or ticket_row.ticket_status = 'checked_in' then
    insert into public.event_audit_logs (
      university_id, club_id, event_id, ticket_id, actor_user_id, action, metadata
    ) values (
      event_row.university_id,
      event_row.club_id,
      event_row.id,
      ticket_row.id,
      target_scanner_user_id,
      'duplicate_entry_attempted',
      '{}'::jsonb
    );
    return query select 'already_checked_in'::text, ticket_row.checked_in_at, ticket_row.id;
    return;
  end if;
  if ticket_row.ticket_status <> 'active'
     or ticket_row.request_status <> 'approved'
     or ticket_row.payment_status not in ('approved', 'not_required') then
    raise exception using errcode = 'P0001', message = 'admission_unavailable';
  end if;

  admission_ticket_id := ticket_row.id;
  confirmed_at := clock_timestamp();
  update public.event_tickets as target_ticket
     set ticket_status = 'checked_in',
         checked_in_at = confirmed_at,
         checked_in_by = target_scanner_user_id,
         updated_at = now()
   where target_ticket.id = ticket_row.id
     and target_ticket.checked_in_at is null
     and target_ticket.ticket_status = 'active'
   returning * into ticket_row;

  if not found then
    select ticket.* into ticket_row
      from public.event_tickets ticket
     where ticket.id = admission_ticket_id;
    insert into public.event_audit_logs (
      university_id, club_id, event_id, ticket_id, actor_user_id, action, metadata
    ) values (
      event_row.university_id,
      event_row.club_id,
      event_row.id,
      ticket_row.id,
      target_scanner_user_id,
      'duplicate_entry_attempted',
      '{}'::jsonb
    );
    return query select 'already_checked_in'::text, ticket_row.checked_in_at, ticket_row.id;
    return;
  end if;

  insert into public.event_check_ins (
    event_id, ticket_id, user_id, scanner_user_id, qr_kind, checked_in_at
  ) values (
    target_event_id,
    ticket_row.id,
    target_student_user_id,
    target_scanner_user_id,
    left(nullif(btrim(scanned_qr_kind), ''), 40),
    confirmed_at
  );

  insert into public.event_audit_logs (
    university_id, club_id, event_id, ticket_id, actor_user_id, action, metadata
  ) values (
    event_row.university_id,
    event_row.club_id,
    event_row.id,
    ticket_row.id,
    target_scanner_user_id,
    'entry_confirmed',
    jsonb_build_object('qr_kind', coalesce(left(nullif(btrim(scanned_qr_kind), ''), 40), 'unknown'))
  );

  return query select 'entry_confirmed'::text, confirmed_at, ticket_row.id;
end;
$$;

create or replace function private.review_event_ticket(
  target_ticket_id uuid,
  actor_user_id text,
  review_action text,
  review_message text default null
)
returns table(
  ticket_id uuid,
  reservation_status text,
  request_status text,
  payment_status text,
  ticket_status text
)
language plpgsql
security definer
set search_path = public, private, pg_temp
as $$
declare
  ticket_row public.event_tickets%rowtype;
  event_row public.events%rowtype;
  actor_row public.users%rowtype;
  preliminary_event_id uuid;
  club_status text;
  actor_role text;
  audit_action text;
begin
  if review_action not in ('approve', 'reject', 'clarify', 'confirm_cash', 'approve_free', 'refund') then
    raise exception using errcode = 'P0001', message = 'invalid_ticket_transition';
  end if;

  select ticket.event_id
    into preliminary_event_id
    from public.event_tickets ticket
   where ticket.id = target_ticket_id;
  if not found then
    raise exception using errcode = 'P0001', message = 'ticket_not_found';
  end if;

  perform private.lock_event_context(preliminary_event_id);
  select event.* into event_row from public.events event where event.id = preliminary_event_id;
  select club.status into club_status from public.student_clubs club where club.id = event_row.club_id;

  -- Lock every membership row for this actor before deciding which role is
  -- sufficient. This prevents a revoke/suspend from racing the transition.
  perform membership.id
    from public.club_memberships membership
   where membership.club_id = event_row.club_id
     and membership.user_id = actor_user_id
   for share;

  select app_user.*
    into actor_row
    from public.users app_user
   where app_user.id = actor_user_id
   for share;
  if not found or actor_row.status <> 'active' then
    raise exception using errcode = 'P0001', message = 'finance_access_denied';
  end if;

  perform private.expire_event_reservations(preliminary_event_id);
  select ticket.* into ticket_row
    from public.event_tickets ticket
   where ticket.id = target_ticket_id
   for update;
  if not found or ticket_row.event_id <> preliminary_event_id then
    raise exception using errcode = 'P0001', message = 'ticket_not_found';
  end if;

  if review_action = 'approve_free'
     or (review_action = 'reject' and ticket_row.payment_method = 'free') then
    select membership.role into actor_role
      from public.club_memberships membership
     where membership.club_id = event_row.club_id
       and membership.user_id = actor_user_id
       and membership.status = 'active'
       and membership.role in ('club_owner', 'event_organizer')
     order by membership.role = 'club_owner' desc
     limit 1;
  else
    select membership.role into actor_role
      from public.club_memberships membership
     where membership.club_id = event_row.club_id
       and membership.user_id = actor_user_id
       and membership.status = 'active'
       and membership.role in ('club_owner', 'finance_manager')
     order by membership.role = 'club_owner' desc
     limit 1;
  end if;

  if actor_role is null then
    raise exception using errcode = 'P0001', message = 'finance_access_denied';
  end if;

  if review_action in ('approve', 'confirm_cash', 'approve_free')
     and (
       club_status <> 'approved'
       or event_row.status not in ('published', 'sold_out')
       or event_row.end_at <= clock_timestamp()
     ) then
    raise exception using errcode = 'P0001', message = 'event_unavailable';
  end if;

  if review_action = 'approve' then
    if ticket_row.payment_method <> 'bank_transfer'
       or ticket_row.payment_status not in ('under_review', 'clarification_requested')
       or ticket_row.reservation_status <> 'held_for_review'
       or ticket_row.ticket_status <> 'pending' then
      raise exception using errcode = 'P0001', message = 'invalid_ticket_transition';
    end if;
    update public.event_tickets
       set payment_status = 'approved',
           request_status = 'approved',
           ticket_status = 'active',
           approved_at = now(),
           approved_by = actor_user_id,
           refund_required_at = null,
           clarification_message = null,
           updated_at = now()
     where id = target_ticket_id
     returning * into ticket_row;
    audit_action := 'payment_approved';

  elsif review_action = 'reject' then
    if not (
      (
        ticket_row.ticket_status = 'pending'
        and ticket_row.request_status in ('pending', 'submitted')
      )
      or (
        ticket_row.refund_required_at is not null
        and ticket_row.ticket_status = 'revoked'
        and ticket_row.payment_status in ('pending', 'under_review', 'clarification_requested')
      )
    ) then
      raise exception using errcode = 'P0001', message = 'invalid_ticket_transition';
    end if;
    update public.event_tickets as target_ticket
       set payment_status = case when target_ticket.payment_status = 'not_required' then 'not_required' else 'rejected' end,
           request_status = 'rejected',
           ticket_status = 'rejected',
           reservation_status = 'released',
           reservation_expires_at = null,
           rejected_at = now(),
           rejected_by = actor_user_id,
           rejected_reason = left(coalesce(nullif(btrim(review_message), ''), 'organizer_rejected'), 1000),
           refund_required_at = null,
           updated_at = now()
     where target_ticket.id = target_ticket_id
     returning * into ticket_row;
    audit_action := 'payment_rejected';

  elsif review_action = 'clarify' then
    if ticket_row.payment_method <> 'bank_transfer'
       or ticket_row.payment_status <> 'under_review'
       or ticket_row.ticket_status not in ('pending', 'revoked')
       or (ticket_row.ticket_status = 'revoked' and ticket_row.refund_required_at is null)
       or nullif(btrim(review_message), '') is null then
      raise exception using errcode = 'P0001', message = 'invalid_ticket_transition';
    end if;
    update public.event_tickets
       set payment_status = 'clarification_requested',
           clarification_requested_at = now(),
           clarification_message = left(btrim(review_message), 1000),
           updated_at = now()
     where id = target_ticket_id
     returning * into ticket_row;
    insert into public.event_ticket_clarifications (ticket_id, sender_user_id, sender_role, message)
    values (target_ticket_id, actor_user_id, actor_role, left(btrim(review_message), 2000));
    audit_action := 'clarification_requested';

  elsif review_action = 'confirm_cash' then
    if ticket_row.payment_method <> 'cash'
       or ticket_row.payment_status <> 'pending'
       or ticket_row.reservation_status <> 'held_for_review'
       or ticket_row.cash_payment_deadline is null
       or ticket_row.cash_payment_deadline <= clock_timestamp() then
      raise exception using errcode = 'P0001', message = 'invalid_ticket_transition';
    end if;
    update public.event_tickets
       set payment_status = 'approved',
           request_status = 'approved',
           ticket_status = 'active',
           approved_at = now(),
           approved_by = actor_user_id,
           refund_required_at = null,
           updated_at = now()
     where id = target_ticket_id
     returning * into ticket_row;
    audit_action := 'cash_payment_confirmed';

  elsif review_action = 'approve_free' then
    if ticket_row.payment_method <> 'free'
       or ticket_row.payment_status <> 'not_required'
       or ticket_row.request_status <> 'pending'
       or ticket_row.reservation_status <> 'held_for_review'
       or ticket_row.ticket_status <> 'pending' then
      raise exception using errcode = 'P0001', message = 'invalid_ticket_transition';
    end if;
    update public.event_tickets
       set request_status = 'approved',
           ticket_status = 'active',
           approved_at = now(),
           approved_by = actor_user_id,
           refund_required_at = null,
           updated_at = now()
     where id = target_ticket_id
     returning * into ticket_row;
    audit_action := 'free_ticket_approved';

  elsif review_action = 'refund' then
    if ticket_row.amount <= 0
       or ticket_row.checked_in_at is not null
       or not (
         (ticket_row.payment_status = 'approved' and ticket_row.ticket_status = 'active')
         or (
           ticket_row.refund_required_at is not null
           and ticket_row.ticket_status = 'revoked'
           and ticket_row.payment_status in ('approved', 'under_review', 'clarification_requested')
         )
       ) then
      raise exception using errcode = 'P0001', message = 'invalid_ticket_transition';
    end if;
    update public.event_tickets
       set payment_status = 'refunded',
           ticket_status = 'refunded',
           reservation_status = 'released',
           refunded_at = now(),
           refunded_by = actor_user_id,
           refund_required_at = null,
           updated_at = now()
     where id = target_ticket_id
     returning * into ticket_row;
    audit_action := 'ticket_refunded';
  end if;

  insert into public.event_audit_logs (
    university_id, club_id, event_id, ticket_id, actor_user_id, action, metadata
  ) values (
    event_row.university_id,
    event_row.club_id,
    event_row.id,
    ticket_row.id,
    actor_user_id,
    audit_action,
    jsonb_build_object('actor_role', actor_role)
  );

  if review_action in ('reject', 'refund') then
    insert into public.event_audit_logs (
      university_id, club_id, event_id, ticket_id, actor_user_id, action, metadata
    ) values (
      event_row.university_id,
      event_row.club_id,
      event_row.id,
      ticket_row.id,
      actor_user_id,
      'reservation_released',
      jsonb_build_object('reason', review_action)
    );
  end if;

  perform private.refresh_event_capacity_status(event_row.id);

  return query select ticket_row.id,
                      ticket_row.reservation_status,
                      ticket_row.request_status,
                      ticket_row.payment_status,
                      ticket_row.ticket_status;
end;
$$;

create or replace function private.cancel_event_ticket(
  target_ticket_id uuid,
  actor_user_id text
)
returns table(
  ticket_id uuid,
  reservation_status text,
  request_status text,
  payment_status text,
  ticket_status text
)
language plpgsql
security definer
set search_path = public, private, pg_temp
as $$
declare
  ticket_row public.event_tickets%rowtype;
  event_row public.events%rowtype;
  preliminary_event_id uuid;
  preliminary_ticket_user_id text;
  membership_authorized boolean := false;
begin
  select ticket.event_id, ticket.user_id
    into preliminary_event_id, preliminary_ticket_user_id
    from public.event_tickets ticket
   where ticket.id = target_ticket_id;
  if not found then
    raise exception using errcode = 'P0001', message = 'ticket_not_found';
  end if;

  perform private.lock_event_context(preliminary_event_id);
  select event.* into event_row from public.events event where event.id = preliminary_event_id;

  if preliminary_ticket_user_id <> actor_user_id then
    perform membership.id
      from public.club_memberships membership
     where membership.club_id = event_row.club_id
       and membership.user_id = actor_user_id
       and membership.status = 'active'
       and membership.role in ('club_owner', 'event_organizer', 'finance_manager')
     for share;
    membership_authorized := found;
  end if;

  perform app_user.id
    from public.users app_user
   where app_user.id = actor_user_id
   for share;

  select ticket.* into ticket_row
    from public.event_tickets ticket
   where ticket.id = target_ticket_id
   for update;
  if not found
     or ticket_row.event_id <> preliminary_event_id
     or ticket_row.user_id <> preliminary_ticket_user_id
     or (ticket_row.user_id <> actor_user_id and not membership_authorized) then
    raise exception using errcode = 'P0001', message = 'ticket_not_found';
  end if;
  if ticket_row.checked_in_at is not null
     or ticket_row.ticket_status in ('checked_in', 'cancelled', 'refunded', 'rejected', 'expired') then
    raise exception using errcode = 'P0001', message = 'invalid_ticket_transition';
  end if;
  if ticket_row.amount > 0 and ticket_row.payment_status = 'approved' then
    raise exception using errcode = 'P0001', message = 'refund_required';
  end if;

  update public.event_tickets as target_ticket
     set reservation_status = 'cancelled',
         reservation_expires_at = null,
         request_status = 'cancelled',
         payment_status = case when target_ticket.payment_status = 'not_required' then 'not_required' else 'rejected' end,
         ticket_status = 'cancelled',
         cancelled_at = now(),
         cancelled_by = actor_user_id,
         refund_required_at = null,
         updated_at = now()
   where target_ticket.id = target_ticket_id
   returning * into ticket_row;

  insert into public.event_audit_logs (
    university_id, club_id, event_id, ticket_id, actor_user_id, action, metadata
  ) values (
    event_row.university_id,
    event_row.club_id,
    event_row.id,
    ticket_row.id,
    actor_user_id,
    'ticket_cancelled',
    '{}'::jsonb
  );

  insert into public.event_audit_logs (
    university_id, club_id, event_id, ticket_id, actor_user_id, action, metadata
  ) values (
    event_row.university_id,
    event_row.club_id,
    event_row.id,
    ticket_row.id,
    actor_user_id,
    'reservation_released',
    jsonb_build_object('reason', 'ticket_cancelled')
  );

  perform private.refresh_event_capacity_status(event_row.id);
  return query select ticket_row.id,
                      ticket_row.reservation_status,
                      ticket_row.request_status,
                      ticket_row.payment_status,
                      ticket_row.ticket_status;
end;
$$;

create or replace function private.release_event_ticket(
  target_ticket_id uuid,
  actor_user_id text,
  release_reason text default null
)
returns table(
  ticket_id uuid,
  reservation_status text,
  request_status text,
  payment_status text,
  ticket_status text
)
language sql
security definer
set search_path = public, private, pg_temp
as $$
  select *
    from private.review_event_ticket(
      target_ticket_id,
      actor_user_id,
      'reject',
      coalesce(nullif(btrim(release_reason), ''), 'released')
    );
$$;

create or replace function private.approve_event_payment(target_ticket_id uuid, actor_user_id text)
returns table(
  ticket_id uuid,
  reservation_status text,
  request_status text,
  payment_status text,
  ticket_status text
)
language sql
security definer
set search_path = public, private, pg_temp
as $$
  select * from private.review_event_ticket(target_ticket_id, actor_user_id, 'approve', null);
$$;

create or replace function private.reject_event_payment(target_ticket_id uuid, actor_user_id text, reason text)
returns table(
  ticket_id uuid,
  reservation_status text,
  request_status text,
  payment_status text,
  ticket_status text
)
language sql
security definer
set search_path = public, private, pg_temp
as $$
  select * from private.review_event_ticket(target_ticket_id, actor_user_id, 'reject', reason);
$$;

create or replace function private.activate_free_ticket(target_ticket_id uuid, actor_user_id text)
returns table(
  ticket_id uuid,
  reservation_status text,
  request_status text,
  payment_status text,
  ticket_status text
)
language sql
security definer
set search_path = public, private, pg_temp
as $$
  select * from private.review_event_ticket(target_ticket_id, actor_user_id, 'approve_free', null);
$$;

create or replace function private.confirm_cash_payment(target_ticket_id uuid, actor_user_id text)
returns table(
  ticket_id uuid,
  reservation_status text,
  request_status text,
  payment_status text,
  ticket_status text
)
language sql
security definer
set search_path = public, private, pg_temp
as $$
  select * from private.review_event_ticket(target_ticket_id, actor_user_id, 'confirm_cash', null);
$$;

revoke all on function private.refresh_event_capacity_status(uuid) from public, anon, authenticated;
revoke all on function private.expire_event_reservations(uuid) from public, anon, authenticated;
revoke all on function private.reserve_event_ticket(uuid, text, text) from public, anon, authenticated;
revoke all on function private.submit_event_payment(uuid, text, text, text) from public, anon, authenticated;
revoke all on function private.arrange_cash_payment(uuid, text, timestamptz) from public, anon, authenticated;
revoke all on function private.review_event_ticket(uuid, text, text, text) from public, anon, authenticated;
revoke all on function private.cancel_event_ticket(uuid, text) from public, anon, authenticated;
revoke all on function private.confirm_event_check_in(uuid, text, text, text) from public, anon, authenticated;
revoke all on function private.release_event_ticket(uuid, text, text) from public, anon, authenticated;
revoke all on function private.approve_event_payment(uuid, text) from public, anon, authenticated;
revoke all on function private.reject_event_payment(uuid, text, text) from public, anon, authenticated;
revoke all on function private.activate_free_ticket(uuid, text) from public, anon, authenticated;
revoke all on function private.confirm_cash_payment(uuid, text) from public, anon, authenticated;

grant execute on function private.expire_event_reservations(uuid) to service_role;
grant execute on function private.reserve_event_ticket(uuid, text, text) to service_role;
grant execute on function private.submit_event_payment(uuid, text, text, text) to service_role;
grant execute on function private.arrange_cash_payment(uuid, text, timestamptz) to service_role;
grant execute on function private.review_event_ticket(uuid, text, text, text) to service_role;
grant execute on function private.cancel_event_ticket(uuid, text) to service_role;
grant execute on function private.confirm_event_check_in(uuid, text, text, text) to service_role;
grant execute on function private.release_event_ticket(uuid, text, text) to service_role;
grant execute on function private.approve_event_payment(uuid, text) to service_role;
grant execute on function private.reject_event_payment(uuid, text, text) to service_role;
grant execute on function private.activate_free_ticket(uuid, text) to service_role;
grant execute on function private.confirm_cash_payment(uuid, text) to service_role;
