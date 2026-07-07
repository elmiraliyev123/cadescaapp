-- University-scoped social foundation for Cadesca Phase 1.
-- Keeps all social content isolated by university_id and exposes only the
-- explicit Data API grants needed by authenticated users.

create extension if not exists pgcrypto;

create table if not exists public.universities (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  name text not null,
  university_email_domain text not null unique,
  status text not null default 'active' check (status in ('active', 'inactive')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

insert into public.universities (slug, name, university_email_domain, status)
values
  ('bilkent', 'Bilkent University', 'bilkent.edu.tr', 'active'),
  ('metu', 'METU', 'metu.edu.tr', 'active'),
  ('hacettepe', 'Hacettepe University', 'hacettepe.edu.tr', 'active'),
  ('bogazici', 'Bogazici University', 'boun.edu.tr', 'active'),
  ('itu', 'Istanbul Technical University', 'itu.edu.tr', 'active'),
  ('koc', 'Koc University', 'ku.edu.tr', 'active'),
  ('sabanci', 'Sabanci University', 'sabanciuniv.edu', 'active'),
  ('ada', 'ADA University', 'ada.edu.az', 'active'),
  ('baku-state', 'Baku State University', 'bdu.edu.az', 'active'),
  ('unec', 'UNEC', 'unec.edu.az', 'active'),
  ('mit', 'MIT', 'mit.edu', 'active'),
  ('stanford', 'Stanford University', 'stanford.edu', 'active')
on conflict (slug) do update
set name = excluded.name,
    university_email_domain = excluded.university_email_domain,
    status = excluded.status,
    updated_at = now();

alter table public.users
  add column if not exists university_id uuid references public.universities(id),
  add column if not exists verified_at timestamptz;

update public.users app_user
set university_id = university.id
from public.universities university
where app_user.university_id is null
  and (
    lower(app_user.university_domain) = lower(university.university_email_domain)
    or lower(app_user.university_domain) like ('%.' || lower(university.university_email_domain))
    or lower(app_user.university_name) = lower(university.name)
  );

update public.users
set verified_at = coalesce(verified_at, updated_at, created_at, now())
where student_status = 'verified'
  and verified_at is null;

create index if not exists users_university_id_idx
  on public.users (university_id);

create index if not exists users_university_student_status_idx
  on public.users (university_id, student_status)
  where status = 'active' and deleted_at is null;

create or replace function public.set_current_updated_at()
returns trigger
language plpgsql
set search_path = public, pg_temp
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

revoke all on function public.set_current_updated_at() from public, anon, authenticated;

create or replace function public.sync_user_university()
returns trigger
language plpgsql
set search_path = public, pg_temp
as $$
declare
  matched_university_id uuid;
  normalized_domain text;
  normalized_name text;
begin
  normalized_domain := lower(nullif(btrim(new.university_domain), ''));
  normalized_name := lower(nullif(btrim(new.university_name), ''));

  if new.student_status = 'verified' and new.verified_at is null then
    new.verified_at := now();
  end if;

  if normalized_domain is not null then
    select university.id
      into matched_university_id
    from public.universities university
    where university.status = 'active'
      and (
        normalized_domain = lower(university.university_email_domain)
        or normalized_domain like ('%.' || lower(university.university_email_domain))
      )
    order by length(university.university_email_domain) desc
    limit 1;
  end if;

  if matched_university_id is null and normalized_name is not null then
    select university.id
      into matched_university_id
    from public.universities university
    where university.status = 'active'
      and lower(university.name) = normalized_name
    limit 1;
  end if;

  if matched_university_id is not null then
    new.university_id := matched_university_id;
  end if;

  return new;
end;
$$;

revoke all on function public.sync_user_university() from public, anon, authenticated;

drop trigger if exists set_universities_updated_at on public.universities;
create trigger set_universities_updated_at
before update on public.universities
for each row execute function public.set_current_updated_at();

drop trigger if exists sync_users_university_fields on public.users;
create trigger sync_users_university_fields
before insert or update of university_id, university_name, university_domain, student_status, verified_at
on public.users
for each row execute function public.sync_user_university();

create table if not exists public.university_posts (
  id uuid primary key default gen_random_uuid(),
  university_id uuid not null references public.universities(id) on delete restrict,
  user_id text not null references public.users(id) on delete cascade,
  body text not null check (char_length(btrim(body)) between 1 and 1000),
  image_url text check (image_url is null or image_url ~* '^https?://'),
  status text not null default 'active' check (status in ('active', 'hidden', 'deleted')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.university_post_likes (
  id uuid primary key default gen_random_uuid(),
  university_id uuid not null references public.universities(id) on delete restrict,
  post_id uuid not null references public.university_posts(id) on delete cascade,
  user_id text not null references public.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (post_id, user_id)
);

create table if not exists public.university_post_comments (
  id uuid primary key default gen_random_uuid(),
  university_id uuid not null references public.universities(id) on delete restrict,
  post_id uuid not null references public.university_posts(id) on delete cascade,
  user_id text not null references public.users(id) on delete cascade,
  body text not null check (char_length(btrim(body)) between 1 and 500),
  status text not null default 'active' check (status in ('active', 'hidden', 'deleted')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.university_post_reports (
  id uuid primary key default gen_random_uuid(),
  university_id uuid not null references public.universities(id) on delete restrict,
  post_id uuid not null references public.university_posts(id) on delete cascade,
  user_id text not null references public.users(id) on delete cascade,
  reason text not null default 'reported_from_feed' check (char_length(btrim(reason)) between 1 and 300),
  status text not null default 'open' check (status in ('open', 'resolved', 'dismissed')),
  resolved_by text,
  resolved_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (post_id, user_id)
);

create index if not exists university_posts_university_created_idx
  on public.university_posts (university_id, created_at desc);

create index if not exists university_posts_user_created_idx
  on public.university_posts (user_id, created_at desc);

create index if not exists university_posts_status_created_idx
  on public.university_posts (status, created_at desc);

create index if not exists university_post_likes_university_idx
  on public.university_post_likes (university_id);

create index if not exists university_post_likes_user_idx
  on public.university_post_likes (user_id);

create index if not exists university_post_likes_post_idx
  on public.university_post_likes (post_id);

create index if not exists university_post_comments_university_created_idx
  on public.university_post_comments (university_id, created_at desc);

create index if not exists university_post_comments_user_created_idx
  on public.university_post_comments (user_id, created_at desc);

create index if not exists university_post_comments_post_created_idx
  on public.university_post_comments (post_id, created_at asc);

create index if not exists university_post_reports_university_created_idx
  on public.university_post_reports (university_id, created_at desc);

create index if not exists university_post_reports_user_idx
  on public.university_post_reports (user_id);

create index if not exists university_post_reports_post_idx
  on public.university_post_reports (post_id);

create index if not exists university_post_reports_status_created_idx
  on public.university_post_reports (status, created_at desc);

drop trigger if exists set_university_posts_updated_at on public.university_posts;
create trigger set_university_posts_updated_at
before update on public.university_posts
for each row execute function public.set_current_updated_at();

drop trigger if exists set_university_post_likes_updated_at on public.university_post_likes;
create trigger set_university_post_likes_updated_at
before update on public.university_post_likes
for each row execute function public.set_current_updated_at();

drop trigger if exists set_university_post_comments_updated_at on public.university_post_comments;
create trigger set_university_post_comments_updated_at
before update on public.university_post_comments
for each row execute function public.set_current_updated_at();

drop trigger if exists set_university_post_reports_updated_at on public.university_post_reports;
create trigger set_university_post_reports_updated_at
before update on public.university_post_reports
for each row execute function public.set_current_updated_at();

alter table public.universities enable row level security;
alter table public.university_posts enable row level security;
alter table public.university_post_likes enable row level security;
alter table public.university_post_comments enable row level security;
alter table public.university_post_reports enable row level security;

revoke all on table public.universities from anon, authenticated;
revoke all on table public.university_posts from anon, authenticated;
revoke all on table public.university_post_likes from anon, authenticated;
revoke all on table public.university_post_comments from anon, authenticated;
revoke all on table public.university_post_reports from anon, authenticated;

grant usage on schema public to anon, authenticated;

grant select on table public.universities to authenticated;

grant select, insert, delete on table public.university_posts to authenticated;
grant update (status, updated_at) on table public.university_posts to authenticated;

grant select, insert, delete on table public.university_post_likes to authenticated;

grant select, insert, delete on table public.university_post_comments to authenticated;
grant update (status, updated_at) on table public.university_post_comments to authenticated;

grant select, insert on table public.university_post_reports to authenticated;
grant update (status, resolved_by, resolved_at, updated_at) on table public.university_post_reports to authenticated;

grant all on table public.universities to service_role;
grant all on table public.university_posts to service_role;
grant all on table public.university_post_likes to service_role;
grant all on table public.university_post_comments to service_role;
grant all on table public.university_post_reports to service_role;

drop policy if exists "verified_students_select_own_university" on public.universities;
drop policy if exists "verified_students_select_university_posts" on public.university_posts;
drop policy if exists "verified_students_insert_university_posts" on public.university_posts;
drop policy if exists "students_update_own_university_posts" on public.university_posts;
drop policy if exists "students_delete_own_university_posts" on public.university_posts;
drop policy if exists "verified_students_select_university_likes" on public.university_post_likes;
drop policy if exists "verified_students_insert_own_university_likes" on public.university_post_likes;
drop policy if exists "students_delete_own_university_likes" on public.university_post_likes;
drop policy if exists "verified_students_select_university_comments" on public.university_post_comments;
drop policy if exists "verified_students_insert_own_university_comments" on public.university_post_comments;
drop policy if exists "students_update_own_university_comments" on public.university_post_comments;
drop policy if exists "students_delete_own_university_comments" on public.university_post_comments;
drop policy if exists "students_select_own_reports_admins_all" on public.university_post_reports;
drop policy if exists "verified_students_insert_own_reports" on public.university_post_reports;
drop policy if exists "admins_update_reports" on public.university_post_reports;

create policy "verified_students_select_own_university"
on public.universities
for select
to authenticated
using (
  exists (
    select 1
    from public.users app_user
    where app_user.auth_user_id = (select auth.uid())
      and app_user.status = 'active'
      and app_user.deleted_at is null
      and (
        app_user.role = 'admin'
        or (
          app_user.student_status = 'verified'
          and app_user.university_id = universities.id
        )
      )
  )
);

create policy "verified_students_select_university_posts"
on public.university_posts
for select
to authenticated
using (
  exists (
    select 1
    from public.users app_user
    where app_user.auth_user_id = (select auth.uid())
      and app_user.status = 'active'
      and app_user.deleted_at is null
      and (
        app_user.role = 'admin'
        or (
          app_user.student_status = 'verified'
          and app_user.university_id = university_posts.university_id
          and university_posts.status = 'active'
        )
      )
  )
);

create policy "verified_students_insert_university_posts"
on public.university_posts
for insert
to authenticated
with check (
  status = 'active'
  and exists (
    select 1
    from public.users app_user
    where app_user.auth_user_id = (select auth.uid())
      and app_user.id = university_posts.user_id
      and app_user.status = 'active'
      and app_user.deleted_at is null
      and app_user.student_status = 'verified'
      and app_user.university_id = university_posts.university_id
  )
);

create policy "students_update_own_university_posts"
on public.university_posts
for update
to authenticated
using (
  exists (
    select 1
    from public.users app_user
    where app_user.auth_user_id = (select auth.uid())
      and app_user.id = university_posts.user_id
      and app_user.status = 'active'
      and app_user.deleted_at is null
      and app_user.student_status = 'verified'
      and app_user.university_id = university_posts.university_id
  )
  or exists (
    select 1
    from public.users admin_user
    where admin_user.auth_user_id = (select auth.uid())
      and admin_user.status = 'active'
      and admin_user.deleted_at is null
      and admin_user.role = 'admin'
  )
)
with check (
  exists (
    select 1
    from public.users app_user
    where app_user.auth_user_id = (select auth.uid())
      and app_user.id = university_posts.user_id
      and app_user.status = 'active'
      and app_user.deleted_at is null
      and app_user.student_status = 'verified'
      and app_user.university_id = university_posts.university_id
  )
  or exists (
    select 1
    from public.users admin_user
    where admin_user.auth_user_id = (select auth.uid())
      and admin_user.status = 'active'
      and admin_user.deleted_at is null
      and admin_user.role = 'admin'
  )
);

create policy "students_delete_own_university_posts"
on public.university_posts
for delete
to authenticated
using (
  exists (
    select 1
    from public.users app_user
    where app_user.auth_user_id = (select auth.uid())
      and app_user.id = university_posts.user_id
      and app_user.status = 'active'
      and app_user.deleted_at is null
      and app_user.student_status = 'verified'
      and app_user.university_id = university_posts.university_id
  )
  or exists (
    select 1
    from public.users admin_user
    where admin_user.auth_user_id = (select auth.uid())
      and admin_user.status = 'active'
      and admin_user.deleted_at is null
      and admin_user.role = 'admin'
  )
);

create policy "verified_students_select_university_likes"
on public.university_post_likes
for select
to authenticated
using (
  exists (
    select 1
    from public.users app_user
    where app_user.auth_user_id = (select auth.uid())
      and app_user.status = 'active'
      and app_user.deleted_at is null
      and (
        app_user.role = 'admin'
        or (
          app_user.student_status = 'verified'
          and app_user.university_id = university_post_likes.university_id
        )
      )
  )
);

create policy "verified_students_insert_own_university_likes"
on public.university_post_likes
for insert
to authenticated
with check (
  exists (
    select 1
    from public.users app_user
    join public.university_posts post
      on post.id = university_post_likes.post_id
    where app_user.auth_user_id = (select auth.uid())
      and app_user.id = university_post_likes.user_id
      and app_user.status = 'active'
      and app_user.deleted_at is null
      and app_user.student_status = 'verified'
      and app_user.university_id = university_post_likes.university_id
      and post.university_id = app_user.university_id
      and post.status = 'active'
  )
);

create policy "students_delete_own_university_likes"
on public.university_post_likes
for delete
to authenticated
using (
  exists (
    select 1
    from public.users app_user
    where app_user.auth_user_id = (select auth.uid())
      and app_user.id = university_post_likes.user_id
      and app_user.status = 'active'
      and app_user.deleted_at is null
  )
);

create policy "verified_students_select_university_comments"
on public.university_post_comments
for select
to authenticated
using (
  exists (
    select 1
    from public.users app_user
    where app_user.auth_user_id = (select auth.uid())
      and app_user.status = 'active'
      and app_user.deleted_at is null
      and (
        app_user.role = 'admin'
        or (
          app_user.student_status = 'verified'
          and app_user.university_id = university_post_comments.university_id
          and university_post_comments.status = 'active'
        )
      )
  )
);

create policy "verified_students_insert_own_university_comments"
on public.university_post_comments
for insert
to authenticated
with check (
  status = 'active'
  and exists (
    select 1
    from public.users app_user
    join public.university_posts post
      on post.id = university_post_comments.post_id
    where app_user.auth_user_id = (select auth.uid())
      and app_user.id = university_post_comments.user_id
      and app_user.status = 'active'
      and app_user.deleted_at is null
      and app_user.student_status = 'verified'
      and app_user.university_id = university_post_comments.university_id
      and post.university_id = app_user.university_id
      and post.status = 'active'
  )
);

create policy "students_update_own_university_comments"
on public.university_post_comments
for update
to authenticated
using (
  exists (
    select 1
    from public.users app_user
    where app_user.auth_user_id = (select auth.uid())
      and app_user.id = university_post_comments.user_id
      and app_user.status = 'active'
      and app_user.deleted_at is null
      and app_user.student_status = 'verified'
      and app_user.university_id = university_post_comments.university_id
  )
  or exists (
    select 1
    from public.users admin_user
    where admin_user.auth_user_id = (select auth.uid())
      and admin_user.status = 'active'
      and admin_user.deleted_at is null
      and admin_user.role = 'admin'
  )
)
with check (
  exists (
    select 1
    from public.users app_user
    where app_user.auth_user_id = (select auth.uid())
      and app_user.id = university_post_comments.user_id
      and app_user.status = 'active'
      and app_user.deleted_at is null
      and app_user.student_status = 'verified'
      and app_user.university_id = university_post_comments.university_id
  )
  or exists (
    select 1
    from public.users admin_user
    where admin_user.auth_user_id = (select auth.uid())
      and admin_user.status = 'active'
      and admin_user.deleted_at is null
      and admin_user.role = 'admin'
  )
);

create policy "students_delete_own_university_comments"
on public.university_post_comments
for delete
to authenticated
using (
  exists (
    select 1
    from public.users app_user
    where app_user.auth_user_id = (select auth.uid())
      and app_user.id = university_post_comments.user_id
      and app_user.status = 'active'
      and app_user.deleted_at is null
  )
  or exists (
    select 1
    from public.users admin_user
    where admin_user.auth_user_id = (select auth.uid())
      and admin_user.status = 'active'
      and admin_user.deleted_at is null
      and admin_user.role = 'admin'
  )
);

create policy "students_select_own_reports_admins_all"
on public.university_post_reports
for select
to authenticated
using (
  exists (
    select 1
    from public.users app_user
    where app_user.auth_user_id = (select auth.uid())
      and app_user.status = 'active'
      and app_user.deleted_at is null
      and (
        app_user.role = 'admin'
        or app_user.id = university_post_reports.user_id
      )
  )
);

create policy "verified_students_insert_own_reports"
on public.university_post_reports
for insert
to authenticated
with check (
  status = 'open'
  and exists (
    select 1
    from public.users app_user
    join public.university_posts post
      on post.id = university_post_reports.post_id
    where app_user.auth_user_id = (select auth.uid())
      and app_user.id = university_post_reports.user_id
      and app_user.status = 'active'
      and app_user.deleted_at is null
      and app_user.student_status = 'verified'
      and app_user.university_id = university_post_reports.university_id
      and post.university_id = app_user.university_id
      and post.status = 'active'
  )
);

create policy "admins_update_reports"
on public.university_post_reports
for update
to authenticated
using (
  exists (
    select 1
    from public.users admin_user
    where admin_user.auth_user_id = (select auth.uid())
      and admin_user.status = 'active'
      and admin_user.deleted_at is null
      and admin_user.role = 'admin'
  )
)
with check (
  exists (
    select 1
    from public.users admin_user
    where admin_user.auth_user_id = (select auth.uid())
      and admin_user.status = 'active'
      and admin_user.deleted_at is null
      and admin_user.role = 'admin'
  )
);
