-- Expand social image support for profile photos and post media.
-- The app uploads through server-side service-role storage after moderation,
-- then serves private bucket objects through short-lived signed URLs.

do $$
declare
  image_mime_types text[] := array[
    'image/jpeg',
    'image/jpg',
    'image/png',
    'image/webp',
    'image/heic',
    'image/heif',
    'image/avif',
    'image/gif'
  ];
begin
  if to_regclass('storage.buckets') is not null then
    insert into storage.buckets (id, name, "public", file_size_limit, allowed_mime_types)
    values (
      'avatars',
      'avatars',
      false,
      8388608,
      image_mime_types
    )
    on conflict (id) do update
    set "public" = false,
        file_size_limit = excluded.file_size_limit,
        allowed_mime_types = excluded.allowed_mime_types;

    insert into storage.buckets (id, name, "public", file_size_limit, allowed_mime_types)
    values (
      'social-images',
      'social-images',
      false,
      10485760,
      image_mime_types
    )
    on conflict (id) do update
    set "public" = false,
        file_size_limit = excluded.file_size_limit,
        allowed_mime_types = excluded.allowed_mime_types;
  end if;
end;
$$;

alter table public.university_posts
  drop constraint if exists university_posts_image_url_check;

alter table public.university_posts
  add constraint university_posts_image_url_check
  check (
    image_url is null
    or image_url ~* '^https?://'
    or image_url ~ '^[A-Za-z0-9][A-Za-z0-9._/-]*$'
  );

grant select on table storage.buckets to service_role;
grant select, insert, update, delete on table storage.objects to service_role;

drop policy if exists "service_role_social_images_all" on storage.objects;
create policy "service_role_social_images_all"
on storage.objects
for all
to service_role
using (bucket_id = 'social-images')
with check (bucket_id = 'social-images');
