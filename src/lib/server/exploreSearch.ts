import "server-only";

import type { ExploreSearchResult } from "@/lib/search/types";
import { getCurrentStudentContext, isVerifiedUniversityStudent } from "@/lib/server/social";
import { getReadyPool } from "@/lib/server/users";

const MAX_QUERY_LENGTH = 80;
const RESULTS_PER_TYPE = 5;

export class ExploreSearchError extends Error {
  code: "authentication_required" | "query_too_short";
  status: number;

  constructor(code: ExploreSearchError["code"], status: number) {
    super(code);
    this.name = "ExploreSearchError";
    this.code = code;
    this.status = status;
  }
}

function normalizeQuery(value: string) {
  return value.trim().replace(/\s+/g, " ").slice(0, MAX_QUERY_LENGTH);
}

function escapedLike(value: string) {
  return `%${value.replace(/[\\%_]/g, "\\$&")}%`;
}

function iso(value: Date | string) {
  return value instanceof Date ? value.toISOString() : new Date(value).toISOString();
}

export async function searchExplore(rawQuery: string): Promise<ExploreSearchResult[]> {
  const query = normalizeQuery(rawQuery);
  if (query.length < 2) throw new ExploreSearchError("query_too_short", 400);

  const user = await getCurrentStudentContext();
  if (!isVerifiedUniversityStudent(user)) {
    throw new ExploreSearchError("authentication_required", 401);
  }

  const pool = await getReadyPool();
  const pattern = escapedLike(query);
  const [people, posts, clubs, events] = await Promise.all([
    pool.query<{
      id: string;
      username: string;
      display_name: string;
      avatar_url: string | null;
      student_status: string;
      university_name: string;
    }>(
      `select app_user.id,
              app_user.username,
              coalesce(app_user.display_name, app_user.name) as display_name,
              app_user.avatar_url,
              app_user.student_status,
              university.name as university_name
         from public.users app_user
         join public.universities university on university.id = app_user.university_id
        where app_user.university_id = $1::uuid
          and app_user.status = 'active'
          and app_user.deleted_at is null
          and app_user.student_status = 'verified'
          and app_user.public_profile_enabled = true
          and (app_user.username ilike $2 escape '\\' or coalesce(app_user.display_name, app_user.name) ilike $2 escape '\\')
        order by
          (lower(app_user.username) = lower($3)) desc,
          (lower(coalesce(app_user.display_name, app_user.name)) = lower($3)) desc,
          app_user.created_at desc
        limit $4`,
      [user.universityId, pattern, query, RESULTS_PER_TYPE]
    ),
    pool.query<{
      id: string;
      body: string;
      created_at: Date | string;
      author_name: string;
    }>(
      `select post.id,
              post.body,
              post.created_at,
              case when post.actor_type = 'club' then club.name else coalesce(author.display_name, author.name) end as author_name
         from public.university_posts post
         join public.users author on author.id = post.user_id
         left join public.student_clubs club on club.id = post.club_id and club.status = 'approved'
        where post.university_id = $1::uuid
          and post.status = 'active'
          and post.visibility = 'public_preview'
          and (post.actor_type = 'user' or club.id is not null)
          and post.body ilike $2 escape '\\'
        order by
          (lower(post.body) = lower($3)) desc,
          post.created_at desc
        limit $4`,
      [user.universityId, pattern, query, RESULTS_PER_TYPE]
    ),
    pool.query<{
      id: string;
      slug: string;
      name: string;
      description: string;
    }>(
      `select club.id, club.slug, club.name, club.description
         from public.student_clubs club
        where club.university_id = $1::uuid
          and club.status = 'approved'
          and (club.name ilike $2 escape '\\' or club.description ilike $2 escape '\\')
        order by (lower(club.name) = lower($3)) desc, club.name asc
        limit $4`,
      [user.universityId, pattern, query, RESULTS_PER_TYPE]
    ),
    pool.query<{
      id: string;
      slug: string;
      title: string;
      description: string;
      location: string;
      club_name: string;
      starts_at: Date | string;
      status: "published" | "sold_out";
    }>(
      `select event.id,
              event.slug,
              event.title,
              event.description,
              event.location,
              club.name as club_name,
              event.start_at as starts_at,
              event.status
         from public.events event
         join public.student_clubs club on club.id = event.club_id
         join public.universities university on university.id = event.university_id
        where event.university_id = $1::uuid
          and event.status in ('published', 'sold_out')
          and event.moderation_status = 'active'
          and event.visibility in ('public', 'university')
          and club.status = 'approved'
          and event.end_at > now()
          and (
            event.title ilike $2 escape '\\'
            or event.description ilike $2 escape '\\'
            or event.location ilike $2 escape '\\'
            or coalesce(event.venue_name, '') ilike $2 escape '\\'
            or coalesce(event.venue_address, '') ilike $2 escape '\\'
            or club.name ilike $2 escape '\\'
            or university.name ilike $2 escape '\\'
            or exists (select 1 from unnest(event.tags) tag where tag ilike $2 escape '\\')
          )
        order by
          (lower(event.title) = lower($3)) desc,
          (event.featured_status = 'approved') desc,
          event.start_at asc
        limit $4`,
      [user.universityId, pattern, query, RESULTS_PER_TYPE]
    )
  ]);

  return [
    ...people.rows.map((row): ExploreSearchResult => ({
      id: row.id,
      type: "person",
      title: row.display_name,
      subtitle: `@${row.username} · ${row.university_name}`,
      imageUrl: `/media/avatar/${encodeURIComponent(row.username)}`,
      href: `/user/${encodeURIComponent(row.username)}`,
      username: row.username,
      verified: row.student_status === "verified"
    })),
    ...events.rows.map((row): ExploreSearchResult => ({
      id: row.id,
      type: "event",
      title: row.title,
      subtitle: `${row.club_name} · ${row.location}`,
      imageUrl: `/media/event/${encodeURIComponent(row.id)}`,
      href: `/app/user/events/${encodeURIComponent(row.slug)}`,
      slug: row.slug,
      startsAt: iso(row.starts_at),
      status: row.status
    })),
    ...clubs.rows.map((row): ExploreSearchResult => ({
      id: row.id,
      type: "club",
      title: row.name,
      subtitle: row.description,
      imageUrl: `/media/club/${encodeURIComponent(row.id)}`,
      href: `/app/user/clubs/${encodeURIComponent(row.slug)}`,
      slug: row.slug,
      official: true
    })),
    ...posts.rows.map((row): ExploreSearchResult => ({
      id: row.id,
      type: "post",
      title: row.author_name,
      subtitle: row.body.slice(0, 140),
      imageUrl: null,
      href: `/post/${encodeURIComponent(row.id)}`,
      excerpt: row.body.slice(0, 240),
      createdAt: iso(row.created_at)
    }))
  ];
}
