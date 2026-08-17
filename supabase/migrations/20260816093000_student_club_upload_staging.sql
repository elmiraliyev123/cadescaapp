-- Private, short-lived landing area for direct browser uploads. Application
-- submission downloads, validates, moderates, and moves accepted files into
-- their canonical bucket paths before removing these staging objects.
insert into storage.buckets (id, name, "public", file_size_limit, allowed_mime_types)
values (
  'club-application-staging',
  'club-application-staging',
  false,
  10485760,
  array[
    'application/pdf',
    'image/heic',
    'image/heif',
    'image/jpeg',
    'image/png',
    'image/webp'
  ]::text[]
)
on conflict (id) do update
set "public" = excluded."public",
    file_size_limit = excluded.file_size_limit,
    allowed_mime_types = excluded.allowed_mime_types;

grant select on table storage.buckets to service_role;

