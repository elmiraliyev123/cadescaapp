import "server-only";

import crypto from "node:crypto";

import { rolesWithClubCapability } from "@/lib/clubs/permissions";
import { assertImageAllowed } from "@/lib/server/imageModeration";
import { getCurrentStudentContext } from "@/lib/server/social";
import { getReadyPool } from "@/lib/server/users";
import { getSupabaseAdminClient } from "@/lib/supabase/admin";

const SOCIAL_IMAGE_BUCKET = "social-images";
const MAX_IMAGE_BYTES = 10 * 1024 * 1024;
const MIME_EXTENSIONS: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "image/avif": "avif"
};

export type ClubManagedPost = {
  id: string;
  title: string | null;
  body: string;
  imageUrl: string | null;
  status: "active" | "hidden" | "deleted";
  publicationStatus: "draft" | "published" | "scheduled" | "archived";
  scheduledAt: string | null;
  linkUrl: string | null;
  tags: string[];
  relatedEventId: string | null;
  authorName: string;
  createdAt: string;
  updatedAt: string;
};

export type ClubPostInput = {
  title?: string | null;
  body: string;
  publicationStatus: "draft" | "published" | "scheduled";
  scheduledAt?: string | null;
  linkUrl?: string | null;
  tags?: string[];
  relatedEventId?: string | null;
};

type ClubManagedPostRow = {
  id: string;
  body: string;
  title: string | null;
  image_url: string | null;
  status: ClubManagedPost["status"];
  publication_status: ClubManagedPost["publicationStatus"];
  scheduled_at: Date | string | null;
  link_url: string | null;
  tags: string[];
  related_event_id: string | null;
  author_name: string;
  created_at: Date | string;
  updated_at: Date | string;
};

export class ClubPostError extends Error {
  code: "authentication_required" | "club_access_denied" | "club_not_approved" | "post_invalid" | "upload_failed" | "post_not_found";
  status: number;

  constructor(code: ClubPostError["code"], status: number) {
    super(code);
    this.name = "ClubPostError";
    this.code = code;
    this.status = status;
  }
}

async function currentUser() {
  const user = await getCurrentStudentContext();
  if (!user || user.status !== "active") throw new ClubPostError("authentication_required", 401);
  return user;
}

function normalizedBody(value: string, hasImage: boolean) {
  const body = value.trim();
  if ((!body && !hasImage) || body.length > 1000) throw new ClubPostError("post_invalid", 422);
  return body;
}

function mapClubManagedPost(row: ClubManagedPostRow): ClubManagedPost {
  return {
    id: row.id,
    title: row.title,
    body: row.body,
    imageUrl: row.image_url ? `/media/post/${encodeURIComponent(row.id)}` : null,
    status: row.status,
    publicationStatus: row.publication_status,
    scheduledAt: row.scheduled_at
      ? row.scheduled_at instanceof Date
        ? row.scheduled_at.toISOString()
        : new Date(row.scheduled_at).toISOString()
      : null,
    linkUrl: row.link_url,
    tags: row.tags || [],
    relatedEventId: row.related_event_id,
    authorName: row.author_name,
    createdAt: row.created_at instanceof Date ? row.created_at.toISOString() : new Date(row.created_at).toISOString(),
    updatedAt: row.updated_at instanceof Date ? row.updated_at.toISOString() : new Date(row.updated_at).toISOString()
  };
}

async function uploadClubPostImage(clubId: string, userId: string, file: File) {
  const extension = MIME_EXTENSIONS[file.type.toLowerCase()];
  if (!extension || !file.size || file.size > MAX_IMAGE_BYTES) throw new ClubPostError("post_invalid", 415);
  await assertImageAllowed(file, "post");
  const objectPath = `clubs/${clubId}/${userId}/${crypto.randomUUID()}.${extension}`;
  const { error } = await getSupabaseAdminClient().storage.from(SOCIAL_IMAGE_BUCKET).upload(objectPath, file, {
    cacheControl: "3600",
    contentType: file.type,
    upsert: false
  });
  if (error) throw new ClubPostError("upload_failed", 502);
  return objectPath;
}

export async function listClubManagedPosts(clubId: string): Promise<ClubManagedPost[]> {
  const user = await currentUser();
  const pool = await getReadyPool();
  const result = await pool.query<ClubManagedPostRow>(
    `select post.id, post.title, post.body, post.image_url, post.status,
            post.publication_status, post.scheduled_at, post.link_url, post.tags, post.related_event_id,
            coalesce(author.display_name, author.name) as author_name,
            post.created_at, post.updated_at
       from public.university_posts post
       join public.users author on author.id = post.created_by_user_id
      where post.club_id = $1::uuid
        and post.actor_type = 'club'
        and post.status <> 'deleted'
        and exists (
          select 1 from public.club_memberships membership
          join public.student_clubs club on club.id = membership.club_id
          where membership.club_id = post.club_id
            and membership.user_id = $2
            and membership.status = 'active'
            and club.status = 'approved'
        )
      order by post.created_at desc
      limit 100`,
    [clubId, user.id]
  );
  return result.rows.map(mapClubManagedPost);
}

export async function getClubManagedPost(clubId: string, postId: string) {
  if (!/^[0-9a-f-]{36}$/i.test(postId)) throw new ClubPostError("post_not_found", 404);
  const user = await currentUser();
  const pool = await getReadyPool();
  const result = await pool.query<ClubManagedPostRow>(
    `select post.id, post.title, post.body, post.image_url, post.status,
            post.publication_status, post.scheduled_at, post.link_url, post.tags, post.related_event_id,
            coalesce(author.display_name, author.name) as author_name,
            post.created_at, post.updated_at
       from public.university_posts post
       join public.users author on author.id = post.created_by_user_id
      where post.id = $1::uuid
        and post.club_id = $2::uuid
        and post.actor_type = 'club'
        and post.status <> 'deleted'
        and exists (
          select 1 from public.club_memberships membership
          join public.student_clubs club on club.id = membership.club_id
          where membership.club_id = post.club_id
            and membership.user_id = $3
            and membership.status = 'active'
            and club.status = 'approved'
        )
      limit 1`,
    [postId, clubId, user.id]
  );
  if (!result.rows[0]) throw new ClubPostError("post_not_found", 404);
  return mapClubManagedPost(result.rows[0]);
}

export async function createClubPost(clubId: string, input: ClubPostInput, image?: File | null) {
  const user = await currentUser();
  const body = normalizedBody(input.body, Boolean(image?.size));
  const title = input.title?.trim() || null;
  if (title && (title.length < 2 || title.length > 160)) throw new ClubPostError("post_invalid", 422);
  const publicationStatus = input.publicationStatus;
  if (!["draft", "published", "scheduled"].includes(publicationStatus)) throw new ClubPostError("post_invalid", 422);
  const scheduledAt = publicationStatus === "scheduled" && input.scheduledAt ? new Date(input.scheduledAt) : null;
  if (publicationStatus === "scheduled" && (!scheduledAt || !Number.isFinite(scheduledAt.getTime()) || scheduledAt.getTime() <= Date.now())) throw new ClubPostError("post_invalid", 422);
  let linkUrl: string | null = null;
  if (input.linkUrl?.trim()) {
    try {
      const parsed = new URL(input.linkUrl.trim());
      if (!["http:", "https:"].includes(parsed.protocol)) throw new Error("invalid_protocol");
      linkUrl = parsed.toString();
    } catch {
      throw new ClubPostError("post_invalid", 422);
    }
  }
  const tags = Array.from(new Set((input.tags || []).map((tag) => tag.trim().toLowerCase()).filter(Boolean))).slice(0, 12);
  if (tags.some((tag) => tag.length > 40)) throw new ClubPostError("post_invalid", 422);
  const pool = await getReadyPool();
  let objectPath: string | null = null;
  if (image?.size) objectPath = await uploadClubPostImage(clubId, user.id, image);
  const client = await pool.connect();
  try {
    await client.query("begin");
    const clubResult = await client.query<{ university_id: string; status: string }>(
      `select university_id, status from public.student_clubs where id = $1::uuid for share`,
      [clubId]
    );
    const club = clubResult.rows[0];
    if (!club || club.status !== "approved") throw new ClubPostError("club_not_approved", 403);
    const membership = await client.query<{ id: string }>(
      `select id from public.club_memberships
        where club_id = $1::uuid
          and user_id = $2
          and status = 'active'
          and role = any($3::text[])
        limit 1
        for share`,
      [clubId, user.id, rolesWithClubCapability("club.posts.create")]
    );
    if (!membership.rows[0]) throw new ClubPostError("club_access_denied", 403);
    if (input.relatedEventId) {
      const related = await client.query(`select id from public.events where id = $1::uuid and club_id = $2::uuid limit 1`, [input.relatedEventId, clubId]);
      if (!related.rows[0]) throw new ClubPostError("post_invalid", 422);
    }
    const result = await client.query<{ id: string }>(
      `insert into public.university_posts (
         university_id, user_id, title, body, image_url, visibility,
         actor_type, club_id, created_by_user_id, updated_by_user_id,
         publication_status, scheduled_at, related_event_id, tags, link_url, status
       ) values ($1, $2, $3, $4, $5, 'public_preview', 'club', $6, $2, $2,
                 $7, $8, $9::uuid, $10::text[], $11, $12)
       returning id`,
      [
        club.university_id,
        user.id,
        title,
        body,
        objectPath,
        clubId,
        publicationStatus,
        scheduledAt?.toISOString() || null,
        input.relatedEventId || null,
        tags,
        linkUrl,
        publicationStatus === "published" ? "active" : "hidden"
      ]
    );
    const postId = result.rows[0]?.id;
    if (!postId) throw new ClubPostError("post_invalid", 500);
    await client.query(
      `insert into public.event_audit_logs (
         university_id, club_id, actor_user_id, action, metadata
       ) values ($1, $2, $3, 'club_post_created', jsonb_build_object('post_id', $4::text))`,
      [club.university_id, clubId, user.id, postId]
    );
    await client.query(
      `insert into public.club_audit_logs (
         club_id, actor_user_id, action, entity_type, entity_id, after_data, metadata
       ) values ($1::uuid, $2, 'club_post_created', 'post', $3, $4::jsonb, '{}'::jsonb)`,
      [clubId, user.id, postId, JSON.stringify({ publicationStatus })]
    );
    if (objectPath && image) {
      await client.query(
        `insert into public.club_media_assets (club_id, uploaded_by, storage_bucket, object_path, media_kind, mime_type, byte_size)
         values ($1::uuid, $2, 'social-images', $3, 'post', $4, $5)`,
        [clubId, user.id, objectPath, image.type.toLowerCase(), image.size]
      );
    }
    await client.query("commit");
    return postId;
  } catch (error) {
    await client.query("rollback").catch(() => undefined);
    if (objectPath) await getSupabaseAdminClient().storage.from(SOCIAL_IMAGE_BUCKET).remove([objectPath]).catch(() => undefined);
    throw error;
  } finally {
    client.release();
  }
}

export async function deleteClubPost(clubId: string, postId: string) {
  const user = await currentUser();
  const pool = await getReadyPool();
  const client = await pool.connect();
  let objectPath: string | null = null;
  try {
    await client.query("begin");
    const membership = await client.query<{ university_id: string }>(
      `select club.university_id
         from public.club_memberships membership
         join public.student_clubs club on club.id = membership.club_id
        where membership.club_id = $1::uuid
          and membership.user_id = $2
          and membership.status = 'active'
          and membership.role = any($3::text[])
          and club.status = 'approved'
        limit 1
        for share`,
      [clubId, user.id, rolesWithClubCapability("club.posts.delete")]
    );
    if (!membership.rows[0]) throw new ClubPostError("club_access_denied", 403);
    const deleted = await client.query<{ id: string; image_url: string | null }>(
      `update public.university_posts
          set status = 'deleted', publication_status = 'archived', archived_at = now(), updated_by_user_id = $3, updated_at = now()
        where id = $1::uuid
          and club_id = $2::uuid
          and actor_type = 'club'
          and status <> 'deleted'
        returning id, image_url`,
      [postId, clubId, user.id]
    );
    if (!deleted.rows[0]) throw new ClubPostError("post_not_found", 404);
    objectPath = deleted.rows[0].image_url;
    await client.query(
      `insert into public.event_audit_logs (
         university_id, club_id, actor_user_id, action, metadata
       ) values ($1, $2, $3, 'club_post_deleted', jsonb_build_object('post_id', $4::text))`,
      [membership.rows[0].university_id, clubId, user.id, postId]
    );
    await client.query(
      `insert into public.club_audit_logs (
         club_id, actor_user_id, action, entity_type, entity_id, before_data, after_data, metadata
       ) values ($1::uuid, $2, 'club_post_deleted', 'post', $3, $4::jsonb, $5::jsonb, '{}'::jsonb)`,
      [clubId, user.id, postId, JSON.stringify({ status: "active" }), JSON.stringify({ status: "deleted" })]
    );
    if (objectPath) {
      await client.query(
        `update public.club_media_assets set deleted_at = now(), deleted_by = $2 where object_path = $1 and club_id = $3::uuid and deleted_at is null`,
        [objectPath, user.id, clubId]
      );
    }
    await client.query("commit");
  } catch (error) {
    await client.query("rollback").catch(() => undefined);
    throw error;
  } finally {
    client.release();
  }
  if (objectPath && !objectPath.includes("..") && !objectPath.startsWith("/")) {
    await getSupabaseAdminClient().storage.from(SOCIAL_IMAGE_BUCKET).remove([objectPath]).catch(() => undefined);
  }
}

export async function updateClubPost(clubId: string, postId: string, input: ClubPostInput, image?: File | null) {
  const user = await currentUser();
  const body = input.body.trim();
  if (body.length > 1000) throw new ClubPostError("post_invalid", 422);
  const title = input.title?.trim() || null;
  if (title && (title.length < 2 || title.length > 160)) throw new ClubPostError("post_invalid", 422);
  const publicationStatus = input.publicationStatus;
  if (!["draft", "published", "scheduled"].includes(publicationStatus)) throw new ClubPostError("post_invalid", 422);
  const scheduledAt = publicationStatus === "scheduled" && input.scheduledAt ? new Date(input.scheduledAt) : null;
  if (publicationStatus === "scheduled" && (!scheduledAt || !Number.isFinite(scheduledAt.getTime()) || scheduledAt.getTime() <= Date.now())) throw new ClubPostError("post_invalid", 422);
  let linkUrl: string | null = null;
  if (input.linkUrl?.trim()) {
    try {
      const parsed = new URL(input.linkUrl.trim());
      if (!["http:", "https:"].includes(parsed.protocol)) throw new Error("invalid_protocol");
      linkUrl = parsed.toString();
    } catch { throw new ClubPostError("post_invalid", 422); }
  }
  const tags = Array.from(new Set((input.tags || []).map((tag) => tag.trim().toLowerCase()).filter(Boolean))).slice(0, 12);
  if (tags.some((tag) => tag.length > 40)) throw new ClubPostError("post_invalid", 422);
  const pool = await getReadyPool();
  const allowed = await pool.query(
    `select 1 from public.club_memberships membership
      join public.student_clubs club on club.id = membership.club_id
     where membership.club_id = $1::uuid and membership.user_id = $2 and membership.status = 'active'
       and membership.role = any($3::text[]) and club.status = 'approved' limit 1`,
    [clubId, user.id, rolesWithClubCapability("club.posts.update")]
  );
  if (!allowed.rows[0]) throw new ClubPostError("club_access_denied", 403);
  let replacementPath: string | null = null;
  if (image?.size) replacementPath = await uploadClubPostImage(clubId, user.id, image);
  const client = await pool.connect();
  let previousPath: string | null = null;
  try {
    await client.query("begin");
    if (input.relatedEventId) {
      const related = await client.query(`select 1 from public.events where id = $1::uuid and club_id = $2::uuid limit 1`, [input.relatedEventId, clubId]);
      if (!related.rows[0]) throw new ClubPostError("post_invalid", 422);
    }
    const original = await client.query<{ image_url: string | null }>(
      `select image_url from public.university_posts
        where id = $1::uuid and club_id = $2::uuid and actor_type = 'club' and status <> 'deleted'
        for update`,
      [postId, clubId]
    );
    if (!original.rows[0]) throw new ClubPostError("post_not_found", 404);
    if (!body && !replacementPath && !original.rows[0].image_url) throw new ClubPostError("post_invalid", 422);
    previousPath = original.rows[0].image_url;
    const updated = await client.query<{ image_url: string | null }>(
      `update public.university_posts post
          set title = $4, body = $5, image_url = coalesce($6, post.image_url), publication_status = $7,
              scheduled_at = $8, related_event_id = $9::uuid, tags = $10::text[], link_url = $11,
              status = case when $7 = 'published' then 'active' else 'hidden' end,
              archived_at = null, updated_by_user_id = $3, updated_at = now()
        where post.id = $1::uuid and post.club_id = $2::uuid and post.actor_type = 'club' and post.status <> 'deleted'
        returning image_url`,
      [postId, clubId, user.id, title, body, replacementPath, publicationStatus, scheduledAt?.toISOString() || null, input.relatedEventId || null, tags, linkUrl]
    );
    if (!updated.rows[0]) throw new ClubPostError("post_not_found", 404);
    if (replacementPath && image) {
      await client.query(
        `insert into public.club_media_assets (club_id, uploaded_by, storage_bucket, object_path, media_kind, mime_type, byte_size)
         values ($1::uuid, $2, 'social-images', $3, 'post', $4, $5)`,
        [clubId, user.id, replacementPath, image.type.toLowerCase(), image.size]
      );
      if (previousPath) {
        await client.query(
          `update public.club_media_assets set deleted_at = now(), deleted_by = $2
            where club_id = $1::uuid and storage_bucket = 'social-images' and object_path = $3 and deleted_at is null`,
          [clubId, user.id, previousPath]
        );
      }
    }
    await client.query(
      `insert into public.club_audit_logs (club_id, actor_user_id, action, entity_type, entity_id, after_data, metadata)
       values ($1::uuid, $2, 'club_post_updated', 'post', $3, jsonb_build_object('publication_status', $4::text), '{}'::jsonb)`,
      [clubId, user.id, postId, publicationStatus]
    );
    await client.query("commit");
  } catch (error) {
    await client.query("rollback").catch(() => undefined);
    if (replacementPath) await getSupabaseAdminClient().storage.from(SOCIAL_IMAGE_BUCKET).remove([replacementPath]).catch(() => undefined);
    throw error;
  } finally { client.release(); }
  if (replacementPath && previousPath && previousPath !== replacementPath && !previousPath.includes("..") && !previousPath.startsWith("/")) {
    await getSupabaseAdminClient().storage.from(SOCIAL_IMAGE_BUCKET).remove([previousPath]).catch(() => undefined);
  }
}

export async function archiveClubPost(clubId: string, postId: string) {
  const user = await currentUser();
  const pool = await getReadyPool();
  const result = await pool.query(
    `with archived as (
       update public.university_posts post
        set publication_status = 'archived', status = 'hidden', archived_at = now(), updated_by_user_id = $3, updated_at = now()
      where post.id = $1::uuid and post.club_id = $2::uuid and post.actor_type = 'club' and post.status <> 'deleted'
        and exists (
          select 1 from public.club_memberships membership
           where membership.club_id = post.club_id and membership.user_id = $3 and membership.status = 'active'
             and membership.role = any($4::text[])
        )
       returning post.id
     )
     insert into public.club_audit_logs (club_id, actor_user_id, action, entity_type, entity_id, after_data, metadata)
     select $2::uuid, $3, 'club_post_archived', 'post', archived.id::text,
            jsonb_build_object('publication_status', 'archived'), '{}'::jsonb
       from archived
     returning entity_id`,
    [postId, clubId, user.id, rolesWithClubCapability("club.posts.update")]
  );
  if (result.rowCount !== 1) throw new ClubPostError("post_not_found", 404);
}

export async function duplicateClubPost(clubId: string, postId: string) {
  const user = await currentUser();
  const pool = await getReadyPool();
  const result = await pool.query<{ id: string }>(
    `insert into public.university_posts (
       university_id, user_id, title, body, visibility, actor_type, club_id,
       created_by_user_id, updated_by_user_id, publication_status, related_event_id,
       tags, link_url, status
     )
     select post.university_id, $3, post.title, post.body, post.visibility, 'club', post.club_id,
            $3, $3, 'draft', post.related_event_id, post.tags, post.link_url, 'hidden'
       from public.university_posts post
      where post.id = $1::uuid and post.club_id = $2::uuid and post.actor_type = 'club'
        and exists (
          select 1 from public.club_memberships membership
           where membership.club_id = post.club_id and membership.user_id = $3 and membership.status = 'active'
             and membership.role = any($4::text[])
        )
     returning id`,
    [postId, clubId, user.id, rolesWithClubCapability("club.posts.create")]
  );
  if (!result.rows[0]) throw new ClubPostError("post_not_found", 404);
  await pool.query(
    `insert into public.club_audit_logs (club_id, actor_user_id, action, entity_type, entity_id, after_data, metadata)
     values ($1::uuid, $2, 'club_post_duplicated', 'post', $3, jsonb_build_object('publication_status', 'draft'), jsonb_build_object('source_post_id', $4::text))`,
    [clubId, user.id, result.rows[0].id, postId]
  );
  return result.rows[0].id;
}

export async function publishScheduledClubPosts() {
  const pool = await getReadyPool();
  const result = await pool.query<{ entity_id: string }>(
    `with published as (
       update public.university_posts
          set publication_status = 'published', status = 'active', updated_at = now()
        where actor_type = 'club'
          and publication_status = 'scheduled'
          and status = 'hidden'
          and scheduled_at <= now()
          and exists (
            select 1
              from public.student_clubs club
             where club.id = university_posts.club_id
               and club.status = 'approved'
          )
        returning id, club_id, updated_by_user_id
     )
     insert into public.club_audit_logs (club_id, actor_user_id, action, entity_type, entity_id, after_data, metadata)
     select published.club_id, published.updated_by_user_id, 'club_post_scheduled_publish', 'post', published.id::text,
            jsonb_build_object('publication_status', 'published'), '{}'::jsonb
       from published
     returning entity_id`
  );
  return result.rowCount || 0;
}
