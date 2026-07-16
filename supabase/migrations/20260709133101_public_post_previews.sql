alter table public.university_posts
  add column if not exists visibility text;

update public.university_posts
set visibility = 'university_only'
where visibility is null;

alter table public.university_posts
  alter column visibility set default 'university_only',
  alter column visibility set not null;

alter table public.university_posts
  drop constraint if exists university_posts_visibility_check;

alter table public.university_posts
  add constraint university_posts_visibility_check
  check (visibility in ('public_preview', 'university_only'));

create index if not exists university_posts_public_preview_idx
  on public.university_posts (updated_at desc, id)
  where status = 'active' and visibility = 'public_preview';

comment on column public.university_posts.visibility is
  'Controls whether a limited post preview may be rendered outside the authenticated university community.';

revoke all on table public.university_posts from anon;
