-- Auth-domain university verification and request-access queue.
-- Keeps the legacy university_email_domain column for older social/feed code,
-- while moving new signup matching to email_domains[].

create extension if not exists pgcrypto;

alter table public.universities
  add column if not exists country_code text,
  add column if not exists country_name text,
  add column if not exists city text,
  add column if not exists website_url text,
  add column if not exists email_domains text[];

update public.universities
set email_domains = array[lower(university_email_domain)]
where email_domains is null
  and university_email_domain is not null;

update public.universities
set email_domains = array_remove(array(
  select distinct lower(btrim(domain))
  from unnest(email_domains) as domain
  where btrim(domain) <> ''
), null)
where email_domains is not null;

alter table public.universities
  alter column email_domains set default '{}'::text[],
  alter column email_domains set not null;

alter table public.universities
  drop constraint if exists universities_email_domains_not_empty,
  add constraint universities_email_domains_not_empty check (cardinality(email_domains) > 0);

create index if not exists universities_email_domains_gin_idx
  on public.universities using gin (email_domains);

insert into public.universities (
  slug,
  name,
  university_email_domain,
  email_domains,
  country_code,
  country_name,
  status
)
values
  ('bilkent', 'Bilkent University', 'bilkent.edu.tr', array['bilkent.edu.tr'], 'TR', 'Turkey', 'active'),
  ('metu', 'Middle East Technical University', 'metu.edu.tr', array['metu.edu.tr'], 'TR', 'Turkey', 'active'),
  ('hacettepe', 'Hacettepe University', 'hacettepe.edu.tr', array['hacettepe.edu.tr'], 'TR', 'Turkey', 'active'),
  ('koc', 'Koç University', 'ku.edu.tr', array['ku.edu.tr'], 'TR', 'Turkey', 'active'),
  ('sabanci', 'Sabancı University', 'sabanciuniv.edu', array['sabanciuniv.edu'], 'TR', 'Turkey', 'active'),
  ('bogazici', 'Boğaziçi University', 'boun.edu.tr', array['boun.edu.tr'], 'TR', 'Turkey', 'active'),
  ('itu', 'Istanbul Technical University', 'itu.edu.tr', array['itu.edu.tr'], 'TR', 'Turkey', 'active'),
  ('ada', 'ADA University', 'ada.edu.az', array['ada.edu.az'], 'AZ', 'Azerbaijan', 'active'),
  ('baku-state', 'Baku State University', 'bsu.edu.az', array['bsu.edu.az'], 'AZ', 'Azerbaijan', 'active'),
  ('asoiu', 'Azerbaijan State Oil and Industry University', 'asoiu.edu.az', array['asoiu.edu.az'], 'AZ', 'Azerbaijan', 'active')
on conflict (slug) do update
set name = excluded.name,
    university_email_domain = excluded.university_email_domain,
    email_domains = excluded.email_domains,
    country_code = excluded.country_code,
    country_name = excluded.country_name,
    status = excluded.status,
    updated_at = now();

create table if not exists public.university_access_requests (
  id uuid primary key default gen_random_uuid(),
  email text not null,
  email_domain text not null,
  university_name text,
  country text,
  website_url text,
  note text,
  status text not null default 'pending' check (status in ('pending', 'approved', 'rejected')),
  user_id text references public.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists university_access_requests_status_created_idx
  on public.university_access_requests (status, created_at desc);

create index if not exists university_access_requests_email_domain_idx
  on public.university_access_requests (lower(email_domain));

drop trigger if exists set_university_access_requests_updated_at on public.university_access_requests;
create trigger set_university_access_requests_updated_at
before update on public.university_access_requests
for each row execute function public.set_current_updated_at();

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
    cross join lateral unnest(university.email_domains) as domain(value)
    where university.status = 'active'
      and (
        normalized_domain = lower(domain.value)
        or normalized_domain like ('%.' || lower(domain.value))
      )
    order by length(domain.value) desc
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

alter table public.universities enable row level security;
alter table public.university_access_requests enable row level security;

drop policy if exists universities_active_read_authenticated on public.universities;
create policy universities_active_read_authenticated
on public.universities
for select
to authenticated
using (status = 'active');

drop policy if exists university_access_requests_owner_read on public.university_access_requests;
create policy university_access_requests_owner_read
on public.university_access_requests
for select
to authenticated
using (user_id is not null and user_id = (auth.jwt() ->> 'app_user_id'));

revoke all on public.universities from anon, authenticated;
revoke all on public.university_access_requests from anon, authenticated;
grant select on public.universities to authenticated;
