-- Cadesca merchant/restaurant production hardening.
-- This migration keeps merchant_accounts as the auth source of truth for
-- merchant login and creates linked restaurant rows for admin-created merchants.

create table if not exists public.restaurants (
  id text primary key,
  owner_merchant_id text,
  name text not null,
  bio text,
  address text,
  city text,
  country text,
  latitude double precision,
  longitude double precision,
  phone text,
  opening_hours text,
  status text not null default 'open',
  student_menu_enabled boolean not null default false,
  cadesca_partner boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  suspended_at timestamptz,
  deleted_at timestamptz
);

create table if not exists public.merchant_accounts (
  id text primary key,
  name text,
  email text not null,
  password_hash text not null,
  status text not null default 'active',
  restaurant_id text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  suspended_at timestamptz,
  deleted_at timestamptz
);

alter table public.merchant_accounts add column if not exists name text;
alter table public.merchant_accounts add column if not exists restaurant_id text;
alter table public.merchant_accounts add column if not exists status text;
alter table public.merchant_accounts add column if not exists created_at timestamptz;
alter table public.merchant_accounts add column if not exists updated_at timestamptz;
alter table public.merchant_accounts add column if not exists suspended_at timestamptz;
alter table public.merchant_accounts add column if not exists deleted_at timestamptz;

alter table public.restaurants add column if not exists owner_merchant_id text;
alter table public.restaurants add column if not exists bio text;
alter table public.restaurants add column if not exists address text;
alter table public.restaurants add column if not exists city text;
alter table public.restaurants add column if not exists country text;
alter table public.restaurants add column if not exists latitude double precision;
alter table public.restaurants add column if not exists longitude double precision;
alter table public.restaurants add column if not exists phone text;
alter table public.restaurants add column if not exists opening_hours text;
alter table public.restaurants add column if not exists status text;
alter table public.restaurants add column if not exists student_menu_enabled boolean;
alter table public.restaurants add column if not exists cadesca_partner boolean;
alter table public.restaurants add column if not exists created_at timestamptz;
alter table public.restaurants add column if not exists updated_at timestamptz;
alter table public.restaurants add column if not exists suspended_at timestamptz;
alter table public.restaurants add column if not exists deleted_at timestamptz;

alter table public.merchant_accounts drop constraint if exists merchant_accounts_email_key;

delete from public.merchant_accounts
where email is null or btrim(email) = '';

update public.merchant_accounts
set email = lower(btrim(email)),
    password_hash = coalesce(password_hash, ''),
    status = coalesce(nullif(status, ''), 'active'),
    created_at = coalesce(created_at, now()),
    updated_at = coalesce(updated_at, created_at, now());

update public.restaurants
set name = coalesce(nullif(name, ''), 'Unnamed restaurant'),
    status = coalesce(nullif(status, ''), 'open'),
    student_menu_enabled = coalesce(student_menu_enabled, false),
    cadesca_partner = coalesce(cadesca_partner, true),
    created_at = coalesce(created_at, now()),
    updated_at = coalesce(updated_at, created_at, now());

with ranked as (
  select
    id,
    row_number() over (
      partition by lower(email)
      order by
        case
          when deleted_at is null and status = 'active' then 0
          when deleted_at is null then 1
          else 2
        end,
        created_at desc nulls last,
        updated_at desc nulls last,
        id desc
    ) as duplicate_rank
  from public.merchant_accounts
  where email is not null and btrim(email) <> ''
)
update public.merchant_accounts as merchant
set status = 'deleted',
    deleted_at = coalesce(merchant.deleted_at, now()),
    updated_at = now()
from ranked
where merchant.id = ranked.id
  and ranked.duplicate_rank > 1
  and merchant.deleted_at is null;

alter table public.merchant_accounts alter column email set not null;
alter table public.merchant_accounts alter column password_hash set not null;
alter table public.merchant_accounts alter column status set default 'active';
alter table public.merchant_accounts alter column status set not null;
alter table public.merchant_accounts alter column created_at set default now();
alter table public.merchant_accounts alter column created_at set not null;
alter table public.merchant_accounts alter column updated_at set default now();
alter table public.merchant_accounts alter column updated_at set not null;

alter table public.restaurants alter column name set not null;
alter table public.restaurants alter column status set default 'open';
alter table public.restaurants alter column status set not null;
alter table public.restaurants alter column student_menu_enabled set default false;
alter table public.restaurants alter column student_menu_enabled set not null;
alter table public.restaurants alter column cadesca_partner set default true;
alter table public.restaurants alter column cadesca_partner set not null;
alter table public.restaurants alter column created_at set default now();
alter table public.restaurants alter column created_at set not null;
alter table public.restaurants alter column updated_at set default now();
alter table public.restaurants alter column updated_at set not null;

create unique index if not exists merchant_accounts_email_lower_active_idx
  on public.merchant_accounts (lower(email))
  where deleted_at is null;

create index if not exists restaurants_owner_merchant_id_idx on public.restaurants (owner_merchant_id);
create index if not exists merchant_accounts_restaurant_id_idx on public.merchant_accounts (restaurant_id);
create index if not exists restaurants_status_idx on public.restaurants (status);

alter table public.merchant_accounts enable row level security;
alter table public.restaurants enable row level security;
