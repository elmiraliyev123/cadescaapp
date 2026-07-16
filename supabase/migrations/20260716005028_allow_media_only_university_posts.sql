set local lock_timeout = '5s';

alter table public.university_posts
  drop constraint if exists university_posts_body_check;

alter table public.university_posts
  add constraint university_posts_body_check
  check (
    char_length(body) <= 1000
    and (char_length(btrim(body)) >= 1 or image_url is not null)
  );
