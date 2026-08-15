import "server-only";

import { getCurrentStudentContext, isVerifiedUniversityStudent } from "@/lib/server/social";
import { getReadyPool } from "@/lib/server/users";

export type DiscoverableClubProfile = {
  id: string;
  name: string;
  slug: string;
  description: string;
  universityName: string;
  logoUrl: string | null;
  websiteUrl: string | null;
  instagramUrl: string | null;
  events: Array<{ id: string; slug: string; title: string; location: string; startsAt: string; status: "published" | "sold_out" }>;
  posts: Array<{ id: string; body: string; hasImage: boolean; createdAt: string }>;
};

function toIso(value: Date | string) {
  return value instanceof Date ? value.toISOString() : new Date(value).toISOString();
}

export async function getDiscoverableClubProfile(slugInput: string): Promise<DiscoverableClubProfile | null> {
  const user = await getCurrentStudentContext();
  if (!isVerifiedUniversityStudent(user)) return null;
  const slug = decodeURIComponent(slugInput).trim().toLowerCase();
  if (!slug || slug.length > 100) return null;

  const pool = await getReadyPool();
  const clubResult = await pool.query<{
    id: string;
    name: string;
    slug: string;
    description: string;
    university_name: string;
    logo_url: string | null;
    website_url: string | null;
    instagram_url: string | null;
  }>(
    `select club.id, club.name, club.slug, club.description, club.logo_url,
            club.website_url, club.instagram_url, university.name as university_name
       from public.student_clubs club
       join public.universities university on university.id = club.university_id
      where club.slug = $1
        and club.university_id = $2::uuid
        and club.status = 'approved'
      limit 1`,
    [slug, user.universityId]
  );
  const club = clubResult.rows[0];
  if (!club) return null;

  const [eventsResult, postsResult] = await Promise.all([
    pool.query<{
      id: string;
      slug: string;
      title: string;
      location: string;
      start_at: Date | string;
      status: "published" | "sold_out";
    }>(
      `select id, slug, title, location, start_at, status
         from public.events
        where club_id = $1::uuid
          and status in ('published', 'sold_out')
          and moderation_status = 'active'
          and visibility in ('public', 'university')
          and end_at > now()
        order by start_at asc
        limit 6`,
      [club.id]
    ),
    pool.query<{ id: string; body: string; image_url: string | null; created_at: Date | string }>(
      `select id, body, image_url, created_at
         from public.university_posts
        where club_id = $1::uuid
          and actor_type = 'club'
          and status = 'active'
        order by created_at desc
        limit 10`,
      [club.id]
    )
  ]);

  return {
    id: club.id,
    name: club.name,
    slug: club.slug,
    description: club.description,
    universityName: club.university_name,
    logoUrl: club.logo_url ? `/media/club/${encodeURIComponent(club.id)}` : null,
    websiteUrl: club.website_url,
    instagramUrl: club.instagram_url,
    events: eventsResult.rows.map((event) => ({
      id: event.id,
      slug: event.slug,
      title: event.title,
      location: event.location,
      startsAt: toIso(event.start_at),
      status: event.status
    })),
    posts: postsResult.rows.map((post) => ({
      id: post.id,
      body: post.body,
      hasImage: Boolean(post.image_url),
      createdAt: toIso(post.created_at)
    }))
  };
}
