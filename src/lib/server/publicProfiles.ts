import "server-only";

import { cache } from "react";

import { getPublicUrl } from "@/lib/appConfig";
import { isPublicProfileIndexable } from "@/lib/seo/publicIndexingPolicy";
import { isPublicImageObjectPath } from "@/lib/server/publicAssets";
import { getReadyPool } from "@/lib/server/users";

const USERNAME_PATTERN = /^[a-z0-9_][a-z0-9_.]{1,28}[a-z0-9_]$/;

type PublicProfileRow = {
  internal_id: string;
  internal_university_id: string;
  username: string;
  display_name: string;
  bio: string | null;
  avatar_url: string | null;
  university_name: string;
  role: string;
  status: string;
  student_status: string;
  public_profile_enabled: boolean;
  suspended_at: Date | string | null;
  deleted_at: Date | string | null;
  university_status: string;
  created_at: Date | string;
  updated_at: Date | string;
  latest_post_updated_at: Date | string | null;
  public_post_count: number;
};

type PublicProfilePostRow = {
  id: string;
  body: string;
  image_url: string | null;
  created_at: Date | string;
  updated_at: Date | string;
  like_count: number;
  comment_count: number;
};

export type PublicProfilePostPreview = {
  id: string;
  body: string;
  imageUrl: string | null;
  createdAt: string;
  updatedAt: string;
  likeCount: number;
  commentCount: number;
};

export type SearchPublicProfile = {
  username: string;
  displayName: string;
  bio: string | null;
  avatarUrl: string | null;
  universityName: string;
  publicPostCount: number;
  createdAt: string;
  updatedAt: string;
  posts: PublicProfilePostPreview[];
};

export type PublicProfileSitemapEntry = {
  username: string;
  updatedAt: string;
};

function normalizeUsername(value: string) {
  const username = value.trim().toLowerCase();
  if (
    username.length < 3 ||
    username.length > 30 ||
    !USERNAME_PATTERN.test(username) ||
    username.includes("..")
  ) {
    return null;
  }

  return username;
}

function toIso(value: Date | string) {
  return value instanceof Date ? value.toISOString() : new Date(value).toISOString();
}

function latestIso(primary: Date | string, secondary: Date | string | null) {
  const primaryDate = new Date(primary);
  const secondaryDate = secondary ? new Date(secondary) : primaryDate;
  return (secondaryDate > primaryDate ? secondaryDate : primaryDate).toISOString();
}

function publicAvatarUrl(username: string, objectPath: string | null) {
  return isPublicImageObjectPath(objectPath)
    ? `${getPublicUrl()}/media/avatar/${encodeURIComponent(username)}`
    : null;
}

function publicPostImageUrl(postId: string, objectPath: string | null) {
  return isPublicImageObjectPath(objectPath)
    ? `${getPublicUrl()}/media/post/${encodeURIComponent(postId)}`
    : null;
}

async function loadPublicProfileByUsername(usernameInput: string): Promise<SearchPublicProfile | null> {
  const username = normalizeUsername(usernameInput);
  if (!username) return null;

  const pool = await getReadyPool();
  const profileResult = await pool.query<PublicProfileRow>(
    `select
       app_user.id::text as internal_id,
       app_user.university_id::text as internal_university_id,
       app_user.username,
       coalesce(nullif(btrim(app_user.display_name), ''), app_user.name, 'Cadesca Student') as display_name,
       app_user.bio,
       app_user.avatar_url,
       university.name as university_name,
       app_user.role,
       app_user.status,
       app_user.student_status,
       app_user.public_profile_enabled,
       app_user.suspended_at,
       app_user.deleted_at,
       university.status as university_status,
       app_user.created_at,
       app_user.updated_at,
       (
         select max(post.updated_at)
         from public.university_posts post
         where post.user_id = app_user.id
           and post.university_id = app_user.university_id
           and post.status = 'active'
           and post.visibility = 'public_preview'
           and not exists (
             select 1
             from public.university_post_reports report
             where report.post_id = post.id
               and report.status = 'open'
           )
       ) as latest_post_updated_at,
       (
         select count(*)::int
         from public.university_posts post
         where post.user_id = app_user.id
           and post.university_id = app_user.university_id
           and post.status = 'active'
           and post.visibility = 'public_preview'
           and not exists (
             select 1
             from public.university_post_reports report
             where report.post_id = post.id
               and report.status = 'open'
           )
       ) as public_post_count
     from public.users app_user
     join public.universities university
       on university.id = app_user.university_id
     where app_user.username = $1
       and app_user.role = 'user'
       and app_user.status = 'active'
       and app_user.student_status = 'verified'
       and app_user.public_profile_enabled = true
       and app_user.suspended_at is null
       and app_user.deleted_at is null
       and university.status = 'active'
     limit 1`,
    [username]
  );

  const profile = profileResult.rows[0];
  if (!profile) return null;
  if (!isPublicProfileIndexable({
    role: profile.role,
    status: profile.status,
    studentStatus: profile.student_status,
    publicProfileEnabled: profile.public_profile_enabled,
    suspended: Boolean(profile.suspended_at),
    deleted: Boolean(profile.deleted_at),
    universityStatus: profile.university_status
  })) {
    return null;
  }

  const postsResult = await pool.query<PublicProfilePostRow>(
    `select
       post.id::text,
       post.body,
       post.image_url,
       post.created_at,
       post.updated_at,
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
     where post.user_id = $1
       and post.university_id = $2
       and post.status = 'active'
       and post.visibility = 'public_preview'
       and not exists (
         select 1
         from public.university_post_reports report
         where report.post_id = post.id
           and report.status = 'open'
       )
     order by post.created_at desc
     limit 12`,
    [profile.internal_id, profile.internal_university_id]
  );

  return {
    username: profile.username,
    displayName: profile.display_name,
    bio: profile.bio,
    avatarUrl: publicAvatarUrl(profile.username, profile.avatar_url),
    universityName: profile.university_name,
    publicPostCount: profile.public_post_count,
    createdAt: toIso(profile.created_at),
    updatedAt: latestIso(profile.updated_at, profile.latest_post_updated_at),
    posts: postsResult.rows.map((post) => ({
      id: post.id,
      body: post.body,
      imageUrl: publicPostImageUrl(post.id, post.image_url),
      createdAt: toIso(post.created_at),
      updatedAt: toIso(post.updated_at),
      likeCount: post.like_count,
      commentCount: post.comment_count
    }))
  };
}

export const getSearchPublicProfileByUsername = cache(loadPublicProfileByUsername);

export async function getPublicProfileAvatarObjectPath(usernameInput: string) {
  const username = normalizeUsername(usernameInput);
  if (!username) return null;

  const pool = await getReadyPool();
  const result = await pool.query<{ avatar_url: string | null }>(
    `select app_user.avatar_url
     from public.users app_user
     join public.universities university
       on university.id = app_user.university_id
     where app_user.username = $1
       and app_user.role = 'user'
       and app_user.status = 'active'
       and app_user.student_status = 'verified'
       and app_user.public_profile_enabled = true
       and app_user.suspended_at is null
       and app_user.deleted_at is null
       and university.status = 'active'
     limit 1`,
    [username]
  );

  const objectPath = result.rows[0]?.avatar_url;
  return isPublicImageObjectPath(objectPath) ? objectPath : null;
}

export async function countPublicProfileSitemapEntries() {
  const pool = await getReadyPool();
  const result = await pool.query<{ count: number }>(
    `select count(*)::int as count
     from public.users app_user
     join public.universities university
       on university.id = app_user.university_id
     where app_user.role = 'user'
       and app_user.status = 'active'
       and app_user.student_status = 'verified'
       and app_user.username is not null
       and app_user.username ~ '^[a-z0-9_][a-z0-9_.]{1,28}[a-z0-9_]$'
       and position('..' in app_user.username) = 0
       and app_user.public_profile_enabled = true
       and app_user.suspended_at is null
       and app_user.deleted_at is null
       and university.status = 'active'`
  );

  return result.rows[0]?.count || 0;
}

export async function listPublicProfileSitemapEntries(input: {
  limit: number;
  offset: number;
}): Promise<PublicProfileSitemapEntry[]> {
  const pool = await getReadyPool();
  const result = await pool.query<{
    username: string;
    updated_at: Date | string;
  }>(
    `select
       app_user.username,
       greatest(
         app_user.updated_at,
         coalesce(
           (
             select max(post.updated_at)
             from public.university_posts post
             where post.user_id = app_user.id
               and post.university_id = app_user.university_id
               and post.status = 'active'
               and post.visibility = 'public_preview'
               and not exists (
                 select 1
                 from public.university_post_reports report
                 where report.post_id = post.id
                   and report.status = 'open'
               )
           ),
           app_user.updated_at
         )
       ) as updated_at
     from public.users app_user
     join public.universities university
       on university.id = app_user.university_id
     where app_user.role = 'user'
       and app_user.status = 'active'
       and app_user.student_status = 'verified'
       and app_user.username is not null
       and app_user.username ~ '^[a-z0-9_][a-z0-9_.]{1,28}[a-z0-9_]$'
       and position('..' in app_user.username) = 0
       and app_user.public_profile_enabled = true
       and app_user.suspended_at is null
       and app_user.deleted_at is null
       and university.status = 'active'
     order by app_user.username
     limit $1
     offset $2`,
    [input.limit, input.offset]
  );

  return result.rows.map((row) => ({
    username: row.username,
    updatedAt: toIso(row.updated_at)
  }));
}
