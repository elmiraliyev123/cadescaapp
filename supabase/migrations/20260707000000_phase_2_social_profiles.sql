-- Phase 2 social profiles, usernames, follows, and private avatar storage.
-- Existing users.id values are text, so follow foreign keys preserve that
-- production contract while using a UUID primary key for follow rows.

create extension if not exists pgcrypto;

alter table public.users
  add column if not exists username text,
  add column if not exists display_name text,
  add column if not exists bio text,
  add column if not exists avatar_url text;

create or replace function public.normalize_public_username(candidate text)
returns text
language plpgsql
immutable
set search_path = public, pg_temp
as $$
declare
  normalized text;
begin
  normalized := lower(coalesce(candidate, ''));
  normalized := regexp_replace(normalized, '\s+', '_', 'g');
  normalized := regexp_replace(normalized, '[^a-z0-9_.]+', '_', 'g');
  normalized := regexp_replace(normalized, '\.{2,}', '.', 'g');
  normalized := regexp_replace(normalized, '_{2,}', '_', 'g');
  normalized := btrim(normalized, '.');

  if char_length(normalized) > 30 then
    normalized := substring(normalized from 1 for 30);
    normalized := btrim(normalized, '.');
  end if;

  return nullif(normalized, '');
end;
$$;

revoke all on function public.normalize_public_username(text) from public, anon, authenticated;
grant execute on function public.normalize_public_username(text) to authenticated;

create or replace function public.is_valid_public_username(candidate text)
returns boolean
language sql
immutable
set search_path = public, pg_temp
as $$
  select
    candidate is not null
    and candidate = lower(candidate)
    and char_length(candidate) between 3 and 30
    and candidate ~ '^[a-z0-9_][a-z0-9_.]*[a-z0-9_]$'
    and candidate not like '%..%'
    and candidate <> all (array[
      'admin', 'app', 'api', 'login', 'register', 'wallet', 'merchant',
      'support', 'help', 'settings', 'profile', 'cadesca', 'root', 'system'
    ]);
$$;

revoke all on function public.is_valid_public_username(text) from public, anon, authenticated;
grant execute on function public.is_valid_public_username(text) to authenticated;

create or replace function public.generate_unique_public_username(
  seed_name text,
  seed_email text,
  existing_user_id text default null
)
returns text
language plpgsql
set search_path = public, pg_temp
as $$
declare
  base text;
  candidate text;
  suffix text;
  attempt integer := 0;
begin
  base := public.normalize_public_username(seed_name);

  if base is null or not public.is_valid_public_username(base) then
    base := public.normalize_public_username(split_part(coalesce(seed_email, ''), '@', 1));
  end if;

  if base is null or not public.is_valid_public_username(base) then
    base := 'user';
  end if;

  loop
    if attempt = 0 then
      candidate := base;
    else
      suffix := substr(replace(gen_random_uuid()::text, '-', ''), 1, 5);
      candidate := substring(base from 1 for greatest(1, 30 - char_length(suffix) - 1)) || '_' || suffix;
    end if;

    if public.is_valid_public_username(candidate)
      and not exists (
        select 1
        from public.users app_user
        where app_user.username = candidate
          and (existing_user_id is null or app_user.id <> existing_user_id)
      )
    then
      return candidate;
    end if;

    attempt := attempt + 1;
    if attempt > 20 then
      return 'user_' || substr(replace(gen_random_uuid()::text, '-', ''), 1, 8);
    end if;
  end loop;
end;
$$;

revoke all on function public.generate_unique_public_username(text, text, text) from public, anon, authenticated;
grant execute on function public.generate_unique_public_username(text, text, text) to authenticated;

create or replace function public.ensure_user_public_profile()
returns trigger
language plpgsql
set search_path = public, pg_temp
as $$
begin
  if new.username is null or btrim(new.username) = '' then
    new.username := public.generate_unique_public_username(
      coalesce(nullif(btrim(new.display_name), ''), new.name),
      new.email,
      new.id
    );
  else
    new.username := lower(btrim(new.username));
  end if;

  if new.display_name is not null then
    new.display_name := nullif(btrim(new.display_name), '');
  end if;

  if new.bio is not null then
    new.bio := nullif(substring(btrim(new.bio) from 1 for 240), '');
  end if;

  return new;
end;
$$;

revoke all on function public.ensure_user_public_profile() from public, anon, authenticated;

drop trigger if exists ensure_users_public_profile on public.users;
create trigger ensure_users_public_profile
before insert or update of username, display_name, bio, name, email
on public.users
for each row execute function public.ensure_user_public_profile();

do $$
declare
  user_record record;
  duplicate_record record;
  is_first boolean;
begin
  for user_record in
    select id, name, email, display_name, username
    from public.users
    where username is null
       or btrim(username) = ''
       or username <> lower(username)
       or not public.is_valid_public_username(username)
    order by created_at nulls last, id
  loop
    update public.users
    set username = public.generate_unique_public_username(
          coalesce(nullif(btrim(user_record.display_name), ''), user_record.name),
          user_record.email,
          user_record.id
        )
    where id = user_record.id;
  end loop;

  for duplicate_record in
    select username
    from public.users
    where username is not null
    group by username
    having count(*) > 1
  loop
    is_first := true;

    for user_record in
      select id, name, email, display_name
      from public.users
      where username = duplicate_record.username
      order by created_at nulls last, id
    loop
      if is_first then
        is_first := false;
      else
        update public.users
        set username = public.generate_unique_public_username(
              coalesce(nullif(btrim(user_record.display_name), ''), user_record.name),
              user_record.email,
              user_record.id
            )
        where id = user_record.id;
      end if;
    end loop;
  end loop;
end;
$$;

create unique index if not exists users_username_key
  on public.users (username);

create index if not exists users_username_lower_idx
  on public.users (lower(username));

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'users_username_valid'
      and conrelid = 'public.users'::regclass
  ) then
    alter table public.users
      add constraint users_username_valid
      check (public.is_valid_public_username(username));
  end if;

  if not exists (
    select 1
    from pg_constraint
    where conname = 'users_display_name_length'
      and conrelid = 'public.users'::regclass
  ) then
    alter table public.users
      add constraint users_display_name_length
      check (display_name is null or char_length(btrim(display_name)) between 1 and 80);
  end if;

  if not exists (
    select 1
    from pg_constraint
    where conname = 'users_bio_length'
      and conrelid = 'public.users'::regclass
  ) then
    alter table public.users
      add constraint users_bio_length
      check (bio is null or char_length(btrim(bio)) <= 240);
  end if;
end;
$$;

alter table public.users
  alter column username set not null;

create table if not exists public.user_follows (
  id uuid primary key default gen_random_uuid(),
  follower_id text not null references public.users(id) on delete cascade,
  following_id text not null references public.users(id) on delete cascade,
  university_id uuid not null references public.universities(id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (follower_id, following_id),
  check (follower_id <> following_id)
);

create index if not exists user_follows_university_created_idx
  on public.user_follows (university_id, created_at desc);

create index if not exists user_follows_follower_idx
  on public.user_follows (follower_id, created_at desc);

create index if not exists user_follows_following_idx
  on public.user_follows (following_id, created_at desc);

create or replace function public.sync_user_follow_university()
returns trigger
language plpgsql
set search_path = public, pg_temp
as $$
declare
  follower_university_id uuid;
  following_university_id uuid;
begin
  if new.follower_id = new.following_id then
    raise exception 'user_cannot_follow_self' using errcode = '23514';
  end if;

  select app_user.university_id
    into follower_university_id
  from public.users app_user
  where app_user.id = new.follower_id
    and app_user.status = 'active'
    and app_user.deleted_at is null
    and app_user.student_status = 'verified';

  select app_user.university_id
    into following_university_id
  from public.users app_user
  where app_user.id = new.following_id
    and app_user.status = 'active'
    and app_user.deleted_at is null
    and app_user.student_status = 'verified';

  if follower_university_id is null
    or following_university_id is null
    or follower_university_id <> following_university_id
  then
    raise exception 'same_university_verified_users_required' using errcode = '23514';
  end if;

  new.university_id := follower_university_id;
  return new;
end;
$$;

revoke all on function public.sync_user_follow_university() from public, anon, authenticated;

drop trigger if exists sync_user_follows_university on public.user_follows;
create trigger sync_user_follows_university
before insert or update of follower_id, following_id, university_id
on public.user_follows
for each row execute function public.sync_user_follow_university();

drop trigger if exists set_user_follows_updated_at on public.user_follows;
create trigger set_user_follows_updated_at
before update on public.user_follows
for each row execute function public.set_current_updated_at();

alter table public.user_follows enable row level security;

revoke all on table public.user_follows from anon, authenticated;

grant select, insert, delete on table public.user_follows to authenticated;
grant all on table public.user_follows to service_role;

grant update (locale, display_name, username, bio, avatar_url, updated_at)
  on table public.users to authenticated;

drop policy if exists "students_update_own_locale" on public.users;
drop policy if exists "students_update_own_profile_settings" on public.users;

create policy "students_update_own_profile_settings"
on public.users
for update
to authenticated
using ((select auth.uid()) is not null and auth_user_id = (select auth.uid()))
with check ((select auth.uid()) is not null and auth_user_id = (select auth.uid()));

drop policy if exists "verified_students_select_university_follows" on public.user_follows;
drop policy if exists "verified_students_insert_own_university_follows" on public.user_follows;
drop policy if exists "students_delete_own_university_follows" on public.user_follows;

create policy "verified_students_select_university_follows"
on public.user_follows
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
          and app_user.university_id = user_follows.university_id
        )
      )
  )
);

create policy "verified_students_insert_own_university_follows"
on public.user_follows
for insert
to authenticated
with check (
  exists (
    select 1
    from public.users follower
    join public.users following
      on following.id = user_follows.following_id
    where follower.auth_user_id = (select auth.uid())
      and follower.id = user_follows.follower_id
      and follower.status = 'active'
      and follower.deleted_at is null
      and follower.student_status = 'verified'
      and follower.university_id = user_follows.university_id
      and following.status = 'active'
      and following.deleted_at is null
      and following.student_status = 'verified'
      and following.university_id = follower.university_id
      and follower.id <> following.id
  )
);

create policy "students_delete_own_university_follows"
on public.user_follows
for delete
to authenticated
using (
  exists (
    select 1
    from public.users app_user
    where app_user.auth_user_id = (select auth.uid())
      and app_user.id = user_follows.follower_id
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

do $$
begin
  if to_regclass('storage.buckets') is not null then
    insert into storage.buckets (id, name, "public", file_size_limit, allowed_mime_types)
    values (
      'avatars',
      'avatars',
      false,
      3145728,
      array['image/jpeg', 'image/png', 'image/webp']::text[]
    )
    on conflict (id) do update
    set "public" = false,
        file_size_limit = excluded.file_size_limit,
        allowed_mime_types = excluded.allowed_mime_types;
  end if;

  if to_regclass('storage.objects') is not null then
    execute 'drop policy if exists "avatars_select_own_objects" on storage.objects';
    execute 'drop policy if exists "avatars_insert_own_objects" on storage.objects';
    execute 'drop policy if exists "avatars_update_own_objects" on storage.objects';
    execute 'drop policy if exists "avatars_delete_own_objects" on storage.objects';

    execute $policy$
      create policy "avatars_select_own_objects"
      on storage.objects
      for select
      to authenticated
      using (
        bucket_id = 'avatars'
        and (storage.foldername(name))[1] = (
          select app_user.id
          from public.users app_user
          where app_user.auth_user_id = (select auth.uid())
            and app_user.status = 'active'
            and app_user.deleted_at is null
          limit 1
        )
      )
    $policy$;

    execute $policy$
      create policy "avatars_insert_own_objects"
      on storage.objects
      for insert
      to authenticated
      with check (
        bucket_id = 'avatars'
        and (storage.foldername(name))[1] = (
          select app_user.id
          from public.users app_user
          where app_user.auth_user_id = (select auth.uid())
            and app_user.status = 'active'
            and app_user.deleted_at is null
          limit 1
        )
      )
    $policy$;

    execute $policy$
      create policy "avatars_update_own_objects"
      on storage.objects
      for update
      to authenticated
      using (
        bucket_id = 'avatars'
        and (storage.foldername(name))[1] = (
          select app_user.id
          from public.users app_user
          where app_user.auth_user_id = (select auth.uid())
            and app_user.status = 'active'
            and app_user.deleted_at is null
          limit 1
        )
      )
      with check (
        bucket_id = 'avatars'
        and (storage.foldername(name))[1] = (
          select app_user.id
          from public.users app_user
          where app_user.auth_user_id = (select auth.uid())
            and app_user.status = 'active'
            and app_user.deleted_at is null
          limit 1
        )
      )
    $policy$;

    execute $policy$
      create policy "avatars_delete_own_objects"
      on storage.objects
      for delete
      to authenticated
      using (
        bucket_id = 'avatars'
        and (storage.foldername(name))[1] = (
          select app_user.id
          from public.users app_user
          where app_user.auth_user_id = (select auth.uid())
            and app_user.status = 'active'
            and app_user.deleted_at is null
          limit 1
        )
      )
    $policy$;
  end if;
end;
$$;
