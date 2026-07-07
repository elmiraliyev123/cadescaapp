alter table public.users
  add column if not exists student_number text,
  add column if not exists student_id_expires_at date,
  add column if not exists student_id_issued_at date,
  add column if not exists student_faculty_department text;

create table if not exists public.wallet_passes (
  id text primary key,
  user_id text not null references public.users(id) on delete cascade,
  provider text not null default 'google' check (provider in ('google')),
  google_object_id text not null unique,
  google_class_id text not null,
  unique_wallet_pass_id text not null unique,
  status text not null default 'pending' check (status in ('pending', 'active', 'revoked', 'expired')),
  last_sync timestamptz,
  revoked boolean not null default false,
  revoked_at timestamptz,
  expires_at timestamptz,
  last_totp_counter bigint,
  last_totp_used_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists wallet_passes_user_provider_idx
  on public.wallet_passes (user_id, provider);

create index if not exists wallet_passes_user_status_idx
  on public.wallet_passes (user_id, status, expires_at);

create index if not exists wallet_passes_status_sync_idx
  on public.wallet_passes (status, last_sync desc);

alter table public.wallet_passes enable row level security;

revoke all on table public.wallet_passes from anon, authenticated;
grant select on table public.wallet_passes to authenticated;
grant all on table public.wallet_passes to service_role;

drop policy if exists "students_select_own_wallet_passes" on public.wallet_passes;
create policy "students_select_own_wallet_passes"
on public.wallet_passes
for select
to authenticated
using (
  exists (
    select 1
    from public.users app_user
    where app_user.id = wallet_passes.user_id
      and app_user.auth_user_id = auth.uid()
      and app_user.status = 'active'
      and app_user.deleted_at is null
  )
);

create table if not exists public.security_rate_limits (
  id text primary key,
  count integer not null default 0,
  reset_at timestamptz not null,
  updated_at timestamptz not null default now()
);

alter table public.security_rate_limits enable row level security;

revoke all on table public.security_rate_limits from anon, authenticated;
grant all on table public.security_rate_limits to service_role;
