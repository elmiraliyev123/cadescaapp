import "server-only";

import { cache } from "react";

import { getPublicUrl } from "@/lib/appConfig";
import { isPublicPostIndexable } from "@/lib/seo/publicIndexingPolicy";
import { isPublicImageObjectPath } from "@/lib/server/publicAssets";
import { getReadyPool } from "@/lib/server/users";

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

type PublicPostRow = {
  id: string;
  body: string;
  image_url: string | null;
  created_at: Date | string;
  updated_at: Date | string;
  author_display_name: string;
  author_username: string;
  author_avatar_url: string | null;
  university_name: string;
  post_status: string;
  visibility: string;
  author_role: string;
  author_status: string;
  author_student_status: string;
  author_public_profile_enabled: boolean;
  author_suspended_at: Date | string | null;
  author_deleted_at: Date | string | null;
  university_status: string;
  has_open_report: boolean;
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
  authorUsername: string;
  authorAvatarUrl: string | null;
  authorProfileUrl: string;
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

function publicPostImageUrl(postId: string, objectPath: string | null) {
  return isPublicImageObjectPath(objectPath)
    ? `${getPublicUrl()}/media/post/${encodeURIComponent(postId)}`
    : null;
}

function publicAvatarUrl(username: string, objectPath: string | null) {
  return isPublicImageObjectPath(objectPath)
    ? `${getPublicUrl()}/media/avatar/${encodeURIComponent(username)}`
    : null;
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
       university.name as university_name,
       post.status as post_status,
       post.visibility,
       author.role as author_role,
       author.status as author_status,
       author.student_status as author_student_status,
       author.public_profile_enabled as author_public_profile_enabled,
       author.suspended_at as author_suspended_at,
       author.deleted_at as author_deleted_at,
       university.status as university_status,
       exists (
         select 1
         from public.university_post_reports report
         where report.post_id = post.id
           and report.status = 'open'
       ) as has_open_report,
       (
         select count(*)::int
         from public.university_post_likes post_like
         where post_like.post_id = post.id
       ) as like_count,
       (
         select count(*)::int
         from public.university_post_comments comment
         where comment.post_id = post.id
           and comment.status = 'active'
       ) as comment_count
     from public.university_posts post
     join public.users author
       on author.id = post.user_id
      and author.university_id = post.university_id
     join public.universities university
       on university.id = post.university_id
     where post.id = $1::uuid
       and post.status = 'active'
       and post.visibility = 'public_preview'
       and university.status = 'active'
       and author.role = 'user'
       and author.status = 'active'
       and author.student_status = 'verified'
       and author.username is not null
       and author.username ~ '^[a-z0-9_][a-z0-9_.]{1,28}[a-z0-9_]$'
       and position('..' in author.username) = 0
       and author.public_profile_enabled = true
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
  if (!isPublicPostIndexable({
    profile: {
      role: row.author_role,
      status: row.author_status,
      studentStatus: row.author_student_status,
      publicProfileEnabled: row.author_public_profile_enabled,
      suspended: Boolean(row.author_suspended_at),
      deleted: Boolean(row.author_deleted_at),
      universityStatus: row.university_status
    },
    postStatus: row.post_status,
    visibility: row.visibility,
    hasOpenReport: row.has_open_report
  })) {
    return null;
  }

  const authorProfileUrl = `${getPublicUrl()}/user/${encodeURIComponent(row.author_username)}`;

  return {
    id: row.id,
    body: row.body,
    imageUrl: publicPostImageUrl(row.id, row.image_url),
    createdAt: toIso(row.created_at),
    updatedAt: toIso(row.updated_at),
    authorDisplayName: row.author_display_name,
    authorUsername: row.author_username,
    authorAvatarUrl: publicAvatarUrl(row.author_username, row.author_avatar_url),
    authorProfileUrl,
    universityName: row.university_name,
    likeCount: row.like_count,
    commentCount: row.comment_count
  };
}

export const getPublicPostPreview = cache(loadPublicPostPreview);

export async function getPublicPostImageObjectPath(postId: string) {
  if (!UUID_PATTERN.test(postId)) return null;

  const pool = await getReadyPool();
  const result = await pool.query<{ image_url: string | null }>(
    `select post.image_url
     from public.university_posts post
     join public.users author
       on author.id = post.user_id
      and author.university_id = post.university_id
     join public.universities university
       on university.id = post.university_id
     where post.id = $1::uuid
       and post.status = 'active'
       and post.visibility = 'public_preview'
       and university.status = 'active'
       and author.role = 'user'
       and author.status = 'active'
       and author.student_status = 'verified'
       and author.username is not null
       and author.username ~ '^[a-z0-9_][a-z0-9_.]{1,28}[a-z0-9_]$'
       and position('..' in author.username) = 0
       and author.public_profile_enabled = true
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

  const objectPath = result.rows[0]?.image_url;
  return isPublicImageObjectPath(objectPath) ? objectPath : null;
}

export async function countPublicPostSitemapEntries() {
  const pool = await getReadyPool();
  const result = await pool.query<{ count: number }>(
    `select count(*)::int as count
     from public.university_posts post
     join public.users author
       on author.id = post.user_id
      and author.university_id = post.university_id
     join public.universities university
       on university.id = post.university_id
     where post.status = 'active'
       and post.visibility = 'public_preview'
       and university.status = 'active'
       and author.role = 'user'
       and author.status = 'active'
       and author.student_status = 'verified'
       and author.username is not null
       and author.username ~ '^[a-z0-9_][a-z0-9_.]{1,28}[a-z0-9_]$'
       and position('..' in author.username) = 0
       and author.public_profile_enabled = true
       and author.suspended_at is null
       and author.deleted_at is null
       and not exists (
         select 1
         from public.university_post_reports report
         where report.post_id = post.id
           and report.status = 'open'
       )`
  );

  return result.rows[0]?.count || 0;
}

export async function listPublicPostSitemapEntries(input: {
  limit: number;
  offset: number;
}): Promise<PublicPostSitemapEntry[]> {
  const pool = await getReadyPool();
  const result = await pool.query<{ id: string; updated_at: Date | string }>(
    `select post.id::text, post.updated_at
     from public.university_posts post
     join public.users author
       on author.id = post.user_id
      and author.university_id = post.university_id
     join public.universities university
       on university.id = post.university_id
     where post.status = 'active'
       and post.visibility = 'public_preview'
       and university.status = 'active'
       and author.role = 'user'
       and author.status = 'active'
       and author.student_status = 'verified'
       and author.username is not null
       and author.username ~ '^[a-z0-9_][a-z0-9_.]{1,28}[a-z0-9_]$'
       and position('..' in author.username) = 0
       and author.public_profile_enabled = true
       and author.suspended_at is null
       and author.deleted_at is null
       and not exists (
         select 1
         from public.university_post_reports report
         where report.post_id = post.id
           and report.status = 'open'
       )
     order by post.updated_at desc, post.id
     limit $1
     offset $2`,
    [input.limit, input.offset]
  );

  return result.rows.map((row) => ({
    id: row.id,
    updatedAt: toIso(row.updated_at)
  }));
}
