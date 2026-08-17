-- Student Club Manager platform foundation.
-- Additive only: existing clubs, memberships, posts, events, tickets and audit
-- rows remain canonical and are not copied or rewritten.

alter table public.club_memberships
  drop constraint if exists club_memberships_role_check;

alter table public.club_memberships
  add constraint club_memberships_role_check check (
    role in (
      'club_owner', 'club_admin', 'event_manager', 'content_manager', 'viewer', 'club_member',
      'event_organizer', 'finance_manager', 'door_scanner'
    )
  );

alter table public.student_clubs
  add column if not exists acronym text,
  add column if not exists category text,
  add column if not exists cover_image_url text,
  add column if not exists founded_year integer,
  add column if not exists official_recognition_status text not null default 'not_declared',
  add column if not exists social_links jsonb not null default '{}'::jsonb,
  add column if not exists leadership jsonb not null default '[]'::jsonb,
  add column if not exists application_submitted_at timestamptz,
  add column if not exists application_resubmitted_at timestamptz,
  add column if not exists profile_review_status text not null default 'not_required';

update public.student_clubs
   set application_submitted_at = coalesce(application_submitted_at, created_at)
 where status in ('pending_review', 'clarification_requested', 'approved', 'rejected', 'suspended', 'archived')
   and application_submitted_at is null;

alter table public.student_clubs
  drop constraint if exists student_clubs_acronym_length,
  add constraint student_clubs_acronym_length check (acronym is null or char_length(btrim(acronym)) between 2 and 20),
  drop constraint if exists student_clubs_category_length,
  add constraint student_clubs_category_length check (category is null or char_length(btrim(category)) between 2 and 80),
  drop constraint if exists student_clubs_founded_year_check,
  add constraint student_clubs_founded_year_check check (founded_year is null or founded_year between 1800 and 2200),
  drop constraint if exists student_clubs_recognition_status_check,
  add constraint student_clubs_recognition_status_check check (
    official_recognition_status in ('not_declared', 'recognized', 'not_recognized', 'pending_confirmation')
  ),
  drop constraint if exists student_clubs_profile_review_status_check,
  add constraint student_clubs_profile_review_status_check check (
    profile_review_status in ('not_required', 'pending_review', 'changes_requested')
  ),
  drop constraint if exists student_clubs_social_links_object,
  add constraint student_clubs_social_links_object check (jsonb_typeof(social_links) = 'object'),
  drop constraint if exists student_clubs_leadership_array,
  add constraint student_clubs_leadership_array check (jsonb_typeof(leadership) = 'array');

create table if not exists public.club_application_drafts (
  id uuid primary key default gen_random_uuid(),
  applicant_user_id text not null references public.users(id) on delete cascade,
  university_id uuid references public.universities(id) on delete restrict,
  payload jsonb not null default '{}'::jsonb,
  current_step integer not null default 1,
  status text not null default 'active',
  submitted_club_id uuid references public.student_clubs(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  submitted_at timestamptz,
  constraint club_application_drafts_payload_object check (jsonb_typeof(payload) = 'object'),
  constraint club_application_drafts_step_check check (current_step between 1 and 5),
  constraint club_application_drafts_status_check check (status in ('active', 'submitted', 'abandoned')),
  constraint club_application_drafts_submission_state check (
    (status = 'submitted' and submitted_at is not null and submitted_club_id is not null)
    or status <> 'submitted'
  )
);

create unique index if not exists club_application_drafts_one_active_per_user_idx
  on public.club_application_drafts (applicant_user_id)
  where status = 'active';
create index if not exists club_application_drafts_user_updated_idx
  on public.club_application_drafts (applicant_user_id, updated_at desc);
create index if not exists club_application_drafts_university_idx
  on public.club_application_drafts (university_id)
  where university_id is not null;
create index if not exists club_application_drafts_submitted_club_idx
  on public.club_application_drafts (submitted_club_id)
  where submitted_club_id is not null;

create table if not exists public.club_application_history (
  id uuid primary key default gen_random_uuid(),
  club_id uuid not null references public.student_clubs(id) on delete cascade,
  actor_user_id text references public.users(id) on delete set null,
  actor_admin_hash text,
  action text not null,
  reviewer_comment text,
  snapshot jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  constraint club_application_history_actor_check check (
    actor_user_id is not null or actor_admin_hash is not null
  ),
  constraint club_application_history_action_length check (char_length(action) between 2 and 80),
  constraint club_application_history_snapshot_object check (jsonb_typeof(snapshot) = 'object')
);

create index if not exists club_application_history_club_created_idx
  on public.club_application_history (club_id, created_at desc);
create index if not exists club_application_history_actor_created_idx
  on public.club_application_history (actor_user_id, created_at desc)
  where actor_user_id is not null;

alter table public.club_memberships
  add column if not exists invitation_expires_at timestamptz;

update public.club_memberships
   set invitation_expires_at = coalesce(invited_at, created_at) + interval '14 days'
 where status = 'invited'
   and invitation_expires_at is null;

create index if not exists club_memberships_pending_invite_expiry_idx
  on public.club_memberships (invitation_expires_at)
  where status = 'invited';

create table if not exists public.club_media_assets (
  id uuid primary key default gen_random_uuid(),
  club_id uuid not null references public.student_clubs(id) on delete cascade,
  uploaded_by text not null references public.users(id) on delete restrict,
  storage_bucket text not null default 'event-assets',
  object_path text not null,
  media_kind text not null,
  mime_type text not null,
  byte_size integer not null,
  alt_text text,
  created_at timestamptz not null default now(),
  deleted_at timestamptz,
  deleted_by text references public.users(id) on delete set null,
  constraint club_media_assets_kind_check check (media_kind in ('logo', 'cover', 'event', 'post', 'gallery', 'document')),
  constraint club_media_assets_bucket_check check (storage_bucket in ('event-assets', 'social-images')),
  constraint club_media_assets_byte_size_check check (byte_size > 0 and byte_size <= 15728640),
  constraint club_media_assets_path_check check (object_path ~ '^(clubs|events)/[0-9a-f-]{36}/'),
  unique (object_path)
);

create index if not exists club_media_assets_club_created_idx
  on public.club_media_assets (club_id, created_at desc)
  where deleted_at is null;
create index if not exists club_media_assets_uploaded_by_idx
  on public.club_media_assets (uploaded_by, created_at desc);

insert into public.club_media_assets (club_id, uploaded_by, object_path, media_kind, mime_type, byte_size, created_at)
select club.id, owner.user_id, club.logo_url, 'logo', 'application/octet-stream', 1, club.created_at
  from public.student_clubs club
  join lateral (
    select membership.user_id from public.club_memberships membership
     where membership.club_id = club.id and membership.role = 'club_owner'
     order by membership.created_at asc limit 1
  ) owner on true
 where club.logo_url ~ '^clubs/[0-9a-f-]{36}/'
on conflict (object_path) do nothing;

insert into public.club_media_assets (club_id, uploaded_by, object_path, media_kind, mime_type, byte_size, created_at)
select event.club_id, event.created_by, event.cover_image_url, 'event', 'application/octet-stream', 1, event.created_at
  from public.events event
 where event.cover_image_url ~ '^events/[0-9a-f-]{36}/'
on conflict (object_path) do nothing;

insert into public.club_media_assets (club_id, uploaded_by, object_path, media_kind, mime_type, byte_size, created_at)
select event.club_id, image.created_by, image.object_path, 'gallery', 'application/octet-stream', 1, image.created_at
  from public.event_images image
  join public.events event on event.id = image.event_id
 where image.object_path ~ '^events/[0-9a-f-]{36}/'
on conflict (object_path) do nothing;

insert into public.club_media_assets (club_id, uploaded_by, storage_bucket, object_path, media_kind, mime_type, byte_size, created_at)
select post.club_id, post.created_by_user_id, 'social-images', post.image_url, 'post', 'application/octet-stream', 1, post.created_at
  from public.university_posts post
 where post.actor_type = 'club' and post.club_id is not null and post.image_url ~ '^clubs/[0-9a-f-]{36}/'
on conflict (object_path) do nothing;

alter table public.university_posts
  add column if not exists title text,
  add column if not exists publication_status text not null default 'published',
  add column if not exists scheduled_at timestamptz,
  add column if not exists updated_by_user_id text references public.users(id) on delete set null,
  add column if not exists related_event_id uuid references public.events(id) on delete set null,
  add column if not exists tags text[] not null default '{}'::text[],
  add column if not exists link_url text,
  add column if not exists archived_at timestamptz;

update public.university_posts
   set publication_status = case
     when status = 'deleted' then 'archived'
     else 'published'
   end,
       updated_by_user_id = coalesce(updated_by_user_id, created_by_user_id)
 where publication_status = 'published'
    or updated_by_user_id is null;

alter table public.university_posts
  drop constraint if exists university_posts_publication_status_check,
  add constraint university_posts_publication_status_check check (
    publication_status in ('draft', 'published', 'scheduled', 'archived')
  ),
  drop constraint if exists university_posts_schedule_state_check,
  add constraint university_posts_schedule_state_check check (
    publication_status <> 'scheduled' or scheduled_at is not null
  ),
  drop constraint if exists university_posts_title_length,
  add constraint university_posts_title_length check (title is null or char_length(btrim(title)) between 2 and 160);

create index if not exists university_posts_club_publication_created_idx
  on public.university_posts (club_id, publication_status, created_at desc)
  where actor_type = 'club';
create index if not exists university_posts_scheduled_publish_idx
  on public.university_posts (scheduled_at)
  where publication_status = 'scheduled' and status = 'hidden';
create index if not exists university_posts_related_event_idx
  on public.university_posts (related_event_id)
  where related_event_id is not null;
create index if not exists university_posts_tags_gin_idx
  on public.university_posts using gin (tags);

create table if not exists public.club_audit_logs (
  id uuid primary key default gen_random_uuid(),
  club_id uuid not null references public.student_clubs(id) on delete restrict,
  actor_user_id text references public.users(id) on delete set null,
  actor_admin_hash text,
  action text not null,
  entity_type text not null,
  entity_id text,
  before_data jsonb,
  after_data jsonb,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  constraint club_audit_logs_actor_check check (actor_user_id is not null or actor_admin_hash is not null),
  constraint club_audit_logs_action_length check (char_length(action) between 2 and 100),
  constraint club_audit_logs_entity_type_length check (char_length(entity_type) between 2 and 60),
  constraint club_audit_logs_before_object check (before_data is null or jsonb_typeof(before_data) = 'object'),
  constraint club_audit_logs_after_object check (after_data is null or jsonb_typeof(after_data) = 'object'),
  constraint club_audit_logs_metadata_object check (jsonb_typeof(metadata) = 'object'),
  constraint club_audit_logs_no_secret_keys check (
    not (coalesce(before_data, '{}'::jsonb) ?| array['password', 'token', 'secret', 'code'])
    and not (coalesce(after_data, '{}'::jsonb) ?| array['password', 'token', 'secret', 'code'])
    and not (metadata ?| array['password', 'token', 'secret', 'code'])
  )
);

create index if not exists club_audit_logs_club_created_idx
  on public.club_audit_logs (club_id, created_at desc);
create index if not exists club_audit_logs_actor_created_idx
  on public.club_audit_logs (actor_user_id, created_at desc)
  where actor_user_id is not null;
create index if not exists club_audit_logs_entity_idx
  on public.club_audit_logs (club_id, entity_type, entity_id, created_at desc);

create or replace function private.prevent_club_audit_mutation()
returns trigger
language plpgsql
set search_path = pg_catalog
as $$
begin
  raise exception using errcode = 'P0001', message = 'club_audit_logs_are_append_only';
end;
$$;

revoke all on function private.prevent_club_audit_mutation() from public, anon, authenticated;

drop trigger if exists club_audit_logs_append_only on public.club_audit_logs;
create trigger club_audit_logs_append_only
before update or delete on public.club_audit_logs
for each row execute function private.prevent_club_audit_mutation();

alter table public.club_application_drafts enable row level security;
alter table public.club_application_history enable row level security;
alter table public.club_media_assets enable row level security;
alter table public.club_audit_logs enable row level security;

revoke all on table public.club_application_drafts from public, anon, authenticated;
revoke all on table public.club_application_history from public, anon, authenticated;
revoke all on table public.club_media_assets from public, anon, authenticated;
revoke all on table public.club_audit_logs from public, anon, authenticated;

grant all on table public.club_application_drafts to service_role;
grant all on table public.club_application_history to service_role;
grant all on table public.club_media_assets to service_role;
grant select, insert on table public.club_audit_logs to service_role;
