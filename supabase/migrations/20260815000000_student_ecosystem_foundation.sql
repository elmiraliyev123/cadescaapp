-- Cadesca student ecosystem foundation.
-- Additive only: preserves existing users, clubs, posts, events and tickets.

create extension if not exists pgcrypto;

-- Club roles keep legacy operational roles while adding product-facing roles.
alter table public.club_memberships
  drop constraint if exists club_memberships_role_check;

alter table public.club_memberships
  add constraint club_memberships_role_check check (
    role in (
      'club_owner', 'club_admin', 'event_manager', 'content_manager', 'club_member',
      'event_organizer', 'finance_manager', 'door_scanner'
    )
  );

-- A post's public actor is distinct from the human who performed the action.
alter table public.university_posts
  add column if not exists actor_type text not null default 'user',
  add column if not exists club_id uuid references public.student_clubs(id) on delete restrict,
  add column if not exists created_by_user_id text references public.users(id) on delete restrict;

update public.university_posts
set created_by_user_id = user_id
where created_by_user_id is null;

alter table public.university_posts
  alter column created_by_user_id set not null;

alter table public.university_posts
  drop constraint if exists university_posts_actor_check;

alter table public.university_posts
  add constraint university_posts_actor_check check (
    (actor_type = 'user' and club_id is null and user_id = created_by_user_id)
    or (actor_type = 'club' and club_id is not null)
  );

create index if not exists university_posts_club_created_idx
  on public.university_posts (club_id, created_at desc)
  where actor_type = 'club' and status = 'active';

-- Enrich the canonical Events model without replacing current ticket logic.
alter table public.events
  add column if not exists short_description text,
  add column if not exists venue_name text,
  add column if not exists venue_address text,
  add column if not exists registration_starts_at timestamptz,
  add column if not exists registration_ends_at timestamptz,
  add column if not exists visibility text not null default 'university',
  add column if not exists moderation_status text not null default 'active',
  add column if not exists moderation_reason text,
  add column if not exists moderated_at timestamptz,
  add column if not exists moderated_by text,
  add column if not exists organizer_contact text,
  add column if not exists external_link text,
  add column if not exists tags text[] not null default '{}'::text[];

update public.events
set short_description = left(description, 240),
    venue_name = coalesce(venue_name, location),
    registration_ends_at = coalesce(registration_ends_at, ticket_request_deadline),
    visibility = case when published_at is not null then 'public' else visibility end
where short_description is null
   or venue_name is null
   or registration_ends_at is null;

alter table public.events
  drop constraint if exists events_visibility_check,
  add constraint events_visibility_check check (visibility in ('public', 'university', 'private')),
  drop constraint if exists events_moderation_status_check,
  add constraint events_moderation_status_check check (moderation_status in ('active', 'platform_suspended')),
  drop constraint if exists events_registration_window_check,
  add constraint events_registration_window_check check (
    registration_starts_at is null
    or registration_ends_at is null
    or registration_starts_at < registration_ends_at
  );

drop policy if exists "verified_students_insert_university_posts" on public.university_posts;
create policy "verified_students_insert_university_posts"
on public.university_posts for insert to authenticated
with check (
  status = 'active'
  and actor_type = 'user'
  and club_id is null
  and created_by_user_id = user_id
  and exists (
    select 1 from public.users app_user
    where app_user.auth_user_id = (select auth.uid())
      and app_user.id = university_posts.user_id
      and app_user.status = 'active'
      and app_user.deleted_at is null
      and app_user.student_status = 'verified'
      and app_user.university_id = university_posts.university_id
  )
);

create table if not exists public.event_images (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.events(id) on delete cascade,
  object_path text not null,
  alt_text text,
  sort_order integer not null default 0,
  created_by text not null references public.users(id) on delete restrict,
  created_at timestamptz not null default now(),
  unique (event_id, object_path),
  constraint event_images_sort_order_check check (sort_order between 0 and 1000)
);

create index if not exists event_images_event_order_idx
  on public.event_images (event_id, sort_order, created_at);

create index if not exists events_university_moderated_discovery_idx
  on public.events (university_id, moderation_status, start_at, published_at desc)
  where status in ('published', 'sold_out');

create index if not exists events_tags_gin_idx on public.events using gin (tags);

-- Durable, typed notifications replace browser-only read state for product events.
create table if not exists public.notifications (
  id uuid primary key default gen_random_uuid(),
  user_id text not null references public.users(id) on delete cascade,
  type text not null,
  title text not null,
  body text,
  href text,
  actor_type text,
  actor_id text,
  metadata jsonb not null default '{}'::jsonb,
  read_at timestamptz,
  created_at timestamptz not null default now(),
  constraint notifications_type_length check (char_length(type) between 2 and 80),
  constraint notifications_metadata_object check (jsonb_typeof(metadata) = 'object'),
  constraint notifications_safe_href check (href is null or href ~ '^/')
);

create index if not exists notifications_user_created_idx
  on public.notifications (user_id, created_at desc);
create index if not exists notifications_user_unread_idx
  on public.notifications (user_id, created_at desc) where read_at is null;

-- OAuth 2.0 Authorization Code + PKCE registry and one-time credentials.
create table if not exists public.oauth_clients (
  client_id text primary key,
  name text not null,
  client_type text not null,
  redirect_uris text[] not null,
  allowed_scopes text[] not null default array['openid', 'profile'],
  access_policy text not null default 'active_user',
  status text not null default 'active',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint oauth_clients_type_check check (client_type in ('public', 'confidential')),
  constraint oauth_clients_status_check check (status in ('active', 'disabled')),
  constraint oauth_clients_redirects_check check (cardinality(redirect_uris) > 0)
);

insert into public.oauth_clients (
  client_id, name, client_type, redirect_uris, allowed_scopes, access_policy
) values
  (
    'studentclub',
    'Cadesca Student Club Manager',
    'public',
    array['https://studentclub.cadesca.com/auth/callback'],
    array['openid', 'profile', 'university'],
    'verified_student'
  ),
  (
    'bilmatch',
    'BilMatch',
    'public',
    array['https://bilmatch.com.tr/auth/cadesca/callback'],
    array['openid', 'profile', 'university'],
    'bilkent_undergraduate'
  )
on conflict (client_id) do update
set name = excluded.name,
    client_type = excluded.client_type,
    redirect_uris = excluded.redirect_uris,
    allowed_scopes = excluded.allowed_scopes,
    access_policy = excluded.access_policy,
    updated_at = now();

create table if not exists public.oauth_authorization_codes (
  id uuid primary key default gen_random_uuid(),
  code_hash text not null unique,
  client_id text not null references public.oauth_clients(client_id) on delete cascade,
  user_id text not null references public.users(id) on delete cascade,
  redirect_uri text not null,
  scope text[] not null,
  nonce text,
  code_challenge text not null,
  code_challenge_method text not null default 'S256',
  expires_at timestamptz not null,
  used_at timestamptz,
  created_at timestamptz not null default now(),
  constraint oauth_codes_pkce_method_check check (code_challenge_method = 'S256'),
  constraint oauth_codes_short_lived_check check (expires_at <= created_at + interval '10 minutes')
);

create index if not exists oauth_codes_expiry_idx
  on public.oauth_authorization_codes (expires_at) where used_at is null;

create table if not exists public.oauth_access_tokens (
  id uuid primary key default gen_random_uuid(),
  token_hash text not null unique,
  client_id text not null references public.oauth_clients(client_id) on delete cascade,
  user_id text not null references public.users(id) on delete cascade,
  scope text[] not null,
  expires_at timestamptz not null,
  revoked_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists oauth_access_tokens_expiry_idx
  on public.oauth_access_tokens (expires_at) where revoked_at is null;

-- Browser roles never mutate OAuth credentials or internal notifications directly.
alter table public.event_images enable row level security;
alter table public.notifications enable row level security;
alter table public.oauth_clients enable row level security;
alter table public.oauth_authorization_codes enable row level security;
alter table public.oauth_access_tokens enable row level security;

revoke all on public.event_images from public, anon, authenticated;
revoke all on public.notifications from public, anon, authenticated;
revoke all on public.oauth_clients from public, anon, authenticated;
revoke all on public.oauth_authorization_codes from public, anon, authenticated;
revoke all on public.oauth_access_tokens from public, anon, authenticated;

grant all on public.event_images to service_role;
grant all on public.notifications to service_role;
grant all on public.oauth_clients to service_role;
grant all on public.oauth_authorization_codes to service_role;
grant all on public.oauth_access_tokens to service_role;

drop policy if exists event_images_authorized_read on public.event_images;
create policy event_images_authorized_read
on public.event_images for select to authenticated
using (
  exists (
    select 1
    from public.events event
    where event.id = event_images.event_id
      and (
        private.event_has_club_role(event.club_id, array[
          'club_owner', 'club_admin', 'event_manager', 'event_organizer',
          'finance_manager', 'door_scanner', 'content_manager'
        ])
        or (
          event.status in ('published', 'sold_out')
          and event.moderation_status = 'active'
          and (
            event.visibility = 'public'
            or event.university_id = (
              select app_user.university_id
              from public.users app_user
              where app_user.id = private.event_current_user_id()
            )
          )
        )
      )
  )
);

-- Keep platform enforcement outside the club-controlled lifecycle.
drop policy if exists events_authorized_read on public.events;
create policy events_authorized_read
on public.events for select to authenticated
using (
  private.event_has_club_role(club_id, array[
    'club_owner', 'club_admin', 'event_manager', 'event_organizer',
    'finance_manager', 'door_scanner', 'content_manager'
  ])
  or (
    status in ('published', 'sold_out')
    and moderation_status = 'active'
    and (
      visibility = 'public'
      or university_id = (
        select app_user.university_id
        from public.users app_user
        where app_user.id = private.event_current_user_id()
      )
    )
  )
);

create or replace function public.set_oauth_client_updated_at()
returns trigger language plpgsql set search_path = public, pg_temp as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

revoke all on function public.set_oauth_client_updated_at() from public, anon, authenticated;

drop trigger if exists set_oauth_clients_updated_at on public.oauth_clients;
create trigger set_oauth_clients_updated_at
before update on public.oauth_clients
for each row execute function public.set_oauth_client_updated_at();
