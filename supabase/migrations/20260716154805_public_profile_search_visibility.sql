alter table public.users
  add column if not exists public_profile_enabled boolean;

update public.users
set public_profile_enabled = true
where public_profile_enabled is null;

alter table public.users
  alter column public_profile_enabled set default true,
  alter column public_profile_enabled set not null;

create index if not exists users_public_profile_search_idx
  on public.users (lower(username), updated_at desc)
  where role = 'user'
    and status = 'active'
    and student_status = 'verified'
    and public_profile_enabled = true
    and suspended_at is null
    and deleted_at is null;

comment on column public.users.public_profile_enabled is
  'Controls whether the verified profile and its public-preview posts may appear on public Cadesca pages and in search.';

grant update (public_profile_enabled)
  on table public.users to authenticated;
