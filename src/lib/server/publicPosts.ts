import "server-only";

import { cache } from "react";

import { getReadyPool } from "@/lib/server/users";
import { getSupabaseAdminClient } from "@/lib/supabase/admin";

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const AVATAR_BUCKET = "avatars";
const SOCIAL_IMAGE_BUCKET = "social-images";
const SIGNED_URL_TTL_SECONDS = 60 * 60;

type PublicPostRow = {
  id: string;
  body: string;
  image_url: string | null;
  created_at: Date | string;
  updated_at: Date | string;
  author_display_name: string;
  author_username: string | null;
  author_avatar_url: string | null;
  university_name: string;
  like_count: number;
  comment_count: number;
};

export type PublicPostPreview = {
  id: string;
  body: string;
  imageUrl: string | null;
  createdAt: string;
  updatedAt: string;
  authorDisplayName: string;
  authorUsername: string | null;
  authorAvatarUrl: string | null;
  universityName: string;
  likeCount: number;
  commentCount: number;
};

export type PublicPostSitemapEntry = {
  id: string;
  updatedAt: string;
};

function toIso(value: Date | string) {
  return value instanceof Date ? value.toISOString() : new Date(value).toISOString();
}

function isHttpUrl(value: string) {
  return /^https?:\/\//i.test(value);
}

async function resolvePublicAssetUrl(bucket: string, value: string | null) {
  if (!value || isHttpUrl(value)) return value;

  try {
    const { data, error } = await getSupabaseAdminClient()
      .storage
      .from(bucket)
      .createSignedUrl(value, SIGNED_URL_TTL_SECONDS);

    if (error) throw error;
    return data.signedUrl || null;
  } catch (error) {
    console.error("[public_post] signed_asset_unavailable", {
      bucket,
      reason: error instanceof Error ? error.message : "unknown"
    });
    return null;
  }
}

async function loadPublicPostPreview(postId: string): Promise<PublicPostPreview | null> {
  if (!UUID_PATTERN.test(postId)) return null;

  const pool = await getReadyPool();
  const result = await pool.query<PublicPostRow>(
    `select
       post.id::text,
       post.body,
       post.image_url,
       post.created_at,
       post.updated_at,
       coalesce(nullif(btrim(author.display_name), ''), author.name, 'Cadesca Student') as author_display_name,
       author.username as author_username,
       author.avatar_url as author_avatar_url,
       coalesce(university.name, 'Cadesca') as university_name,
       (select count(*)::int
          from public.university_post_likes post_like
         where post_like.post_id = post.id) as like_count,
       (select count(*)::int
          from public.university_post_comments comment
         where comment.post_id = post.id
           and comment.status = 'active') as comment_count
     from public.university_posts post
     join public.users author
       on author.id = post.user_id
     join public.universities university
       on university.id = post.university_id
     where post.id = $1::uuid
       and post.status = 'active'
       and post.visibility = 'public_preview'
       and university.status = 'active'
       and author.status = 'active'
       and author.student_status = 'verified'
       and author.suspended_at is null
       and author.deleted_at is null
       and not exists (
         select 1
         from public.university_post_reports report
         where report.post_id = post.id
           and report.status = 'open'
       )
     limit 1`,
    [postId]
  );

  const row = result.rows[0];
  if (!row) return null;

  const [authorAvatarUrl, imageUrl] = await Promise.all([
    resolvePublicAssetUrl(AVATAR_BUCKET, row.author_avatar_url),
    resolvePublicAssetUrl(SOCIAL_IMAGE_BUCKET, row.image_url)
  ]);

  return {
    id: row.id,
    body: row.body,
    imageUrl,
    createdAt: toIso(row.created_at),
    updatedAt: toIso(row.updated_at),
    authorDisplayName: row.author_display_name,
    authorUsername: row.author_username,
    authorAvatarUrl,
    universityName: row.university_name,
    likeCount: row.like_count,
    commentCount: row.comment_count
  };
}

export const getPublicPostPreview = cache(loadPublicPostPreview);

export async function listPublicPostSitemapEntries(limit = 50000): Promise<PublicPostSitemapEntry[]> {
  const pool = await getReadyPool();
  const result = await pool.query<{ id: string; updated_at: Date | string }>(
    `select post.id::text, post.updated_at
     from public.university_posts post
     join public.users author
       on author.id = post.user_id
     where post.status = 'active'
       and post.visibility = 'public_preview'
       and exists (
         select 1
         from public.universities university
         where university.id = post.university_id
           and university.status = 'active'
       )
       and author.status = 'active'
       and author.student_status = 'verified'
       and author.suspended_at is null
       and author.deleted_at is null
       and not exists (
         select 1
         from public.university_post_reports report
         where report.post_id = post.id
           and report.status = 'open'
       )
     order by post.updated_at desc
     limit $1`,
    [limit]
  );

  return result.rows.map((row) => ({
    id: row.id,
    updatedAt: toIso(row.updated_at)
  }));
}
