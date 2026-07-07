-- Student ID manual review support.
-- Stores private Supabase Storage object paths on users and creates the
-- private student_ids bucket used by the signup OCR fallback flow.

alter table public.users
  add column if not exists student_id_image_path text;

create index if not exists users_student_status_created_idx
  on public.users (student_status, created_at desc);

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('student_ids', 'student_ids', false, 1048576, array['image/jpeg', 'image/png'])
on conflict (id) do update
  set public = false,
      file_size_limit = 1048576,
      allowed_mime_types = array['image/jpeg', 'image/png'];

grant select on table public.users to service_role;
grant update (student_status, student_menu_access, verified_via, university_name, university_domain, student_id_image_path, updated_at)
  on table public.users to service_role;

grant select on table storage.buckets to service_role;
grant select, insert, update, delete on table storage.objects to service_role;

drop policy if exists "service_role_student_ids_all" on storage.objects;
create policy "service_role_student_ids_all"
on storage.objects
for all
to service_role
using (bucket_id = 'student_ids')
with check (bucket_id = 'student_ids');
