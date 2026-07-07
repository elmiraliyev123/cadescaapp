-- Production RLS/Auth hardening for Cadesca.
-- This migration is safe to run against an existing project: policies are
-- replaced idempotently and default public Data API grants are tightened.

create schema if not exists private;
revoke all on schema private from public, anon, authenticated;

alter table public.users
  add column if not exists auth_user_id uuid references auth.users(id) on delete cascade;

alter table public.merchant_accounts
  add column if not exists auth_user_id uuid references auth.users(id) on delete set null;

create unique index if not exists users_auth_user_id_key
  on public.users (auth_user_id)
  where auth_user_id is not null;

create unique index if not exists merchant_accounts_auth_user_id_key
  on public.merchant_accounts (auth_user_id)
  where auth_user_id is not null;

create table if not exists public.email_verification_codes (
  id text primary key,
  email text not null,
  code_hash text not null,
  purpose text not null check (purpose in ('signup', 'login', 'password_reset')),
  expires_at timestamptz not null,
  consumed_at timestamptz,
  attempts integer not null default 0,
  created_at timestamptz not null default now()
);

create index if not exists email_verification_codes_active_idx
  on public.email_verification_codes (email, purpose, created_at desc)
  where consumed_at is null;

alter table public.users enable row level security;
alter table public.merchant_accounts enable row level security;
alter table public.restaurants enable row level security;
alter table public.restaurant_menu_items enable row level security;
alter table public.qr_tokens enable row level security;
alter table public.student_check_ins enable row level security;
alter table public.email_verification_codes enable row level security;

revoke all on table public.users from anon, authenticated;
revoke all on table public.merchant_accounts from anon, authenticated;
revoke all on table public.restaurants from anon, authenticated;
revoke all on table public.restaurant_menu_items from anon, authenticated;
revoke all on table public.qr_tokens from anon, authenticated;
revoke all on table public.student_check_ins from anon, authenticated;
revoke all on table public.email_verification_codes from anon, authenticated;

grant usage on schema public to anon, authenticated;

grant select on table public.users to authenticated;
grant update (locale) on table public.users to authenticated;

grant select on table public.merchant_accounts to authenticated;
grant update (name) on table public.merchant_accounts to authenticated;

grant select on table public.restaurants to authenticated;
grant update (bio, address, city, country, latitude, longitude, phone, opening_hours, updated_at)
  on table public.restaurants to authenticated;

grant select, insert, update, delete on table public.restaurant_menu_items to authenticated;
grant select on table public.qr_tokens to authenticated;
grant select on table public.student_check_ins to authenticated;

grant all on table public.users to service_role;
grant all on table public.merchant_accounts to service_role;
grant all on table public.restaurants to service_role;
grant all on table public.restaurant_menu_items to service_role;
grant all on table public.qr_tokens to service_role;
grant all on table public.student_check_ins to service_role;
grant all on table public.email_verification_codes to service_role;

drop policy if exists "students_select_own_user" on public.users;
drop policy if exists "students_update_own_locale" on public.users;
drop policy if exists "merchants_select_own_account" on public.merchant_accounts;
drop policy if exists "merchants_update_own_account_name" on public.merchant_accounts;
drop policy if exists "authenticated_select_open_restaurants" on public.restaurants;
drop policy if exists "merchants_update_own_restaurant" on public.restaurants;
drop policy if exists "authenticated_select_active_menu_items" on public.restaurant_menu_items;
drop policy if exists "merchants_insert_own_menu_items" on public.restaurant_menu_items;
drop policy if exists "merchants_update_own_menu_items" on public.restaurant_menu_items;
drop policy if exists "merchants_delete_own_menu_items" on public.restaurant_menu_items;
drop policy if exists "students_select_own_qr_tokens" on public.qr_tokens;
drop policy if exists "students_and_merchants_select_related_check_ins" on public.student_check_ins;

create policy "students_select_own_user"
on public.users
for select
to authenticated
using ((select auth.uid()) is not null and auth_user_id = (select auth.uid()));

create policy "students_update_own_locale"
on public.users
for update
to authenticated
using ((select auth.uid()) is not null and auth_user_id = (select auth.uid()))
with check ((select auth.uid()) is not null and auth_user_id = (select auth.uid()));

create policy "merchants_select_own_account"
on public.merchant_accounts
for select
to authenticated
using ((select auth.uid()) is not null and auth_user_id = (select auth.uid()));

create policy "merchants_update_own_account_name"
on public.merchant_accounts
for update
to authenticated
using ((select auth.uid()) is not null and auth_user_id = (select auth.uid()))
with check ((select auth.uid()) is not null and auth_user_id = (select auth.uid()));

create policy "authenticated_select_open_restaurants"
on public.restaurants
for select
to authenticated
using (
  deleted_at is null
  and (
    status = 'open'
    or exists (
      select 1
      from public.merchant_accounts merchant
      where merchant.auth_user_id = (select auth.uid())
        and (merchant.id = restaurants.owner_merchant_id or merchant.restaurant_id = restaurants.id)
    )
  )
);

create policy "merchants_update_own_restaurant"
on public.restaurants
for update
to authenticated
using (
  exists (
    select 1
    from public.merchant_accounts merchant
    where merchant.auth_user_id = (select auth.uid())
      and (merchant.id = restaurants.owner_merchant_id or merchant.restaurant_id = restaurants.id)
  )
)
with check (
  exists (
    select 1
    from public.merchant_accounts merchant
    where merchant.auth_user_id = (select auth.uid())
      and (merchant.id = restaurants.owner_merchant_id or merchant.restaurant_id = restaurants.id)
  )
);

create policy "authenticated_select_active_menu_items"
on public.restaurant_menu_items
for select
to authenticated
using (
  deleted_at is null
  and status = 'active'
  and exists (
    select 1
    from public.restaurants restaurant
    where restaurant.id = restaurant_menu_items.restaurant_id
      and restaurant.deleted_at is null
      and (
        restaurant.status = 'open'
        or exists (
          select 1
          from public.merchant_accounts merchant
          where merchant.auth_user_id = (select auth.uid())
            and (merchant.id = restaurant.owner_merchant_id or merchant.restaurant_id = restaurant.id)
        )
      )
  )
);

create policy "merchants_insert_own_menu_items"
on public.restaurant_menu_items
for insert
to authenticated
with check (
  exists (
    select 1
    from public.restaurants restaurant
    join public.merchant_accounts merchant
      on merchant.id = restaurant.owner_merchant_id
      or merchant.restaurant_id = restaurant.id
    where restaurant.id = restaurant_menu_items.restaurant_id
      and merchant.auth_user_id = (select auth.uid())
  )
);

create policy "merchants_update_own_menu_items"
on public.restaurant_menu_items
for update
to authenticated
using (
  exists (
    select 1
    from public.restaurants restaurant
    join public.merchant_accounts merchant
      on merchant.id = restaurant.owner_merchant_id
      or merchant.restaurant_id = restaurant.id
    where restaurant.id = restaurant_menu_items.restaurant_id
      and merchant.auth_user_id = (select auth.uid())
  )
)
with check (
  exists (
    select 1
    from public.restaurants restaurant
    join public.merchant_accounts merchant
      on merchant.id = restaurant.owner_merchant_id
      or merchant.restaurant_id = restaurant.id
    where restaurant.id = restaurant_menu_items.restaurant_id
      and merchant.auth_user_id = (select auth.uid())
  )
);

create policy "merchants_delete_own_menu_items"
on public.restaurant_menu_items
for delete
to authenticated
using (
  exists (
    select 1
    from public.restaurants restaurant
    join public.merchant_accounts merchant
      on merchant.id = restaurant.owner_merchant_id
      or merchant.restaurant_id = restaurant.id
    where restaurant.id = restaurant_menu_items.restaurant_id
      and merchant.auth_user_id = (select auth.uid())
  )
);

create policy "students_select_own_qr_tokens"
on public.qr_tokens
for select
to authenticated
using (
  exists (
    select 1
    from public.users app_user
    where app_user.id = qr_tokens.user_id
      and app_user.auth_user_id = (select auth.uid())
  )
);

create policy "students_and_merchants_select_related_check_ins"
on public.student_check_ins
for select
to authenticated
using (
  exists (
    select 1
    from public.users app_user
    where app_user.id = student_check_ins.user_id
      and app_user.auth_user_id = (select auth.uid())
  )
  or exists (
    select 1
    from public.merchant_accounts merchant
    where merchant.auth_user_id = (select auth.uid())
      and (merchant.id = student_check_ins.merchant_user_id or merchant.restaurant_id = student_check_ins.restaurant_id)
  )
);

create or replace function private.handle_auth_user_profile()
returns trigger
language plpgsql
security definer
set search_path = public, auth, pg_temp
as $$
declare
  normalized_email text;
  profile_name text;
  verified_source text;
  is_ocr_verified boolean;
begin
  normalized_email := lower(nullif(btrim(new.email), ''));
  if normalized_email is null then
    return new;
  end if;

  profile_name := coalesce(
    nullif(btrim(new.raw_user_meta_data ->> 'name'), ''),
    nullif(btrim(new.raw_app_meta_data ->> 'name'), ''),
    split_part(normalized_email, '@', 1),
    'Student'
  );

  verified_source := coalesce(
    nullif(btrim(new.raw_app_meta_data ->> 'verified_via'), ''),
    nullif(btrim(new.raw_user_meta_data ->> 'verified_via'), ''),
    'email'
  );
  is_ocr_verified := verified_source = 'ocr';

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
    case when is_ocr_verified then 'verified' else 'not_verified' end,
    is_ocr_verified,
    new.email_confirmed_at is not null,
    case when is_ocr_verified then 'ocr' else 'email' end,
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

drop trigger if exists cadesca_auth_user_profile on auth.users;
create trigger cadesca_auth_user_profile
after insert or update of email, email_confirmed_at, raw_app_meta_data, raw_user_meta_data
on auth.users
for each row execute function private.handle_auth_user_profile();
