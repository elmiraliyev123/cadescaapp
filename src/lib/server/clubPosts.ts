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
  body: string;
  imageUrl: string | null;
  status: "active" | "hidden" | "deleted";
  createdAt: string;
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
  const result = await pool.query<{
    id: string;
    body: string;
    image_url: string | null;
    status: ClubManagedPost["status"];
    created_at: Date | string;
  }>(
    `select post.id, post.body, post.image_url, post.status, post.created_at
       from public.university_posts post
      where post.club_id = $1::uuid
        and post.actor_type = 'club'
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
  return result.rows.map((row) => ({
    id: row.id,
    body: row.body,
    imageUrl: row.image_url ? `/media/post/${encodeURIComponent(row.id)}` : null,
    status: row.status,
    createdAt: row.created_at instanceof Date ? row.created_at.toISOString() : new Date(row.created_at).toISOString()
  }));
}

export async function createClubPost(clubId: string, bodyInput: string, image?: File | null) {
  const user = await currentUser();
  const body = normalizedBody(bodyInput, Boolean(image?.size));
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
    const result = await client.query<{ id: string }>(
      `insert into public.university_posts (
         university_id, user_id, body, image_url, visibility,
         actor_type, club_id, created_by_user_id
       ) values ($1, $2, $3, $4, 'public_preview', 'club', $5, $2)
       returning id`,
      [club.university_id, user.id, body, objectPath, clubId]
    );
    const postId = result.rows[0]?.id;
    if (!postId) throw new ClubPostError("post_invalid", 500);
    await client.query(
      `insert into public.event_audit_logs (
         university_id, club_id, actor_user_id, action, metadata
       ) values ($1, $2, $3, 'club_post_created', jsonb_build_object('post_id', $4::text))`,
      [club.university_id, clubId, user.id, postId]
    );
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
          set status = 'deleted', updated_at = now()
        where id = $1::uuid
          and club_id = $2::uuid
          and actor_type = 'club'
          and status <> 'deleted'
        returning id, image_url`,
      [postId, clubId]
    );
    if (!deleted.rows[0]) throw new ClubPostError("post_not_found", 404);
    objectPath = deleted.rows[0].image_url;
    await client.query(
      `insert into public.event_audit_logs (
         university_id, club_id, actor_user_id, action, metadata
       ) values ($1, $2, $3, 'club_post_deleted', jsonb_build_object('post_id', $4::text))`,
      [membership.rows[0].university_id, clubId, user.id, postId]
    );
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
