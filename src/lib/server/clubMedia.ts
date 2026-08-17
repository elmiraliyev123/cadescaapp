import "server-only";

import crypto from "node:crypto";

import { hasClubCapability, rolesWithClubCapability } from "@/lib/clubs/permissions";
import { assertImageAllowed } from "@/lib/server/imageModeration";
import { getCurrentStudentContext } from "@/lib/server/social";
import { getReadyPool } from "@/lib/server/users";
import { getSupabaseAdminClient } from "@/lib/supabase/admin";

const BUCKET = "event-assets";
const MAX_BYTES = 10 * 1024 * 1024;
const EXTENSIONS: Record<string, string> = { "image/jpeg": "jpg", "image/png": "png", "image/webp": "webp", "image/avif": "avif" };

export class ClubMediaError extends Error {
  constructor(public code: "authentication_required" | "access_denied" | "invalid_media" | "media_in_use" | "not_found", public status: number) { super(code); this.name = "ClubMediaError"; }
}

async function principal(clubId: string, capability: "club.posts.view" | "club.posts.create" | "club.posts.delete") {
  const user = await getCurrentStudentContext();
  if (!user || user.status !== "active") throw new ClubMediaError("authentication_required", 401);
  const pool = await getReadyPool();
  const roles = await pool.query<{ role: Parameters<typeof hasClubCapability>[0][number] }>(
    `select membership.role
       from public.club_memberships membership
       join public.student_clubs club on club.id = membership.club_id
      where membership.club_id = $1::uuid
        and membership.user_id = $2
        and membership.status = 'active'
        and club.status = 'approved'`,
    [clubId, user.id]
  );
  if (!hasClubCapability(roles.rows.map((row) => row.role), capability)) throw new ClubMediaError("access_denied", 403);
  return user;
}

export type ClubMediaAsset = { id: string; kind: string; mimeType: string; byteSize: number; altText: string | null; createdAt: string; url: string };

export async function listClubMediaAssets(clubId: string): Promise<ClubMediaAsset[]> {
  await principal(clubId, "club.posts.view");
  const pool = await getReadyPool();
  const result = await pool.query<{ id: string; media_kind: string; mime_type: string; byte_size: number; alt_text: string | null; created_at: Date | string }>(
    `select id, media_kind, mime_type, byte_size, alt_text, created_at from public.club_media_assets where club_id = $1::uuid and deleted_at is null order by created_at desc limit 200`,
    [clubId]
  );
  return result.rows.map((row) => ({ id: row.id, kind: row.media_kind, mimeType: row.mime_type, byteSize: Number(row.byte_size), altText: row.alt_text, createdAt: new Date(row.created_at).toISOString(), url: `/media/club-asset/${row.id}` }));
}

export async function uploadClubMediaAsset(clubId: string, file: File, altText?: string | null) {
  const user = await principal(clubId, "club.posts.create");
  const extension = EXTENSIONS[file.type.toLowerCase()];
  if (!extension || !file.size || file.size > MAX_BYTES) throw new ClubMediaError("invalid_media", 422);
  await assertImageAllowed(file, "post");
  const path = `clubs/${clubId}/media/${crypto.randomUUID()}.${extension}`;
  const { error } = await getSupabaseAdminClient().storage.from(BUCKET).upload(path, file, { contentType: file.type, cacheControl: "31536000", upsert: false });
  if (error) throw new ClubMediaError("invalid_media", 502);
  try {
    const pool = await getReadyPool();
    const result = await pool.query<{ id: string }>(
      `insert into public.club_media_assets (club_id, uploaded_by, object_path, media_kind, mime_type, byte_size, alt_text) values ($1::uuid, $2, $3, 'gallery', $4, $5, $6) returning id`,
      [clubId, user.id, path, file.type.toLowerCase(), file.size, altText?.trim().slice(0, 240) || null]
    );
    return result.rows[0]?.id;
  } catch (caught) {
    await getSupabaseAdminClient().storage.from(BUCKET).remove([path]).catch(() => undefined);
    throw caught;
  }
}

export async function deleteClubMediaAsset(clubId: string, assetId: string) {
  const user = await principal(clubId, "club.posts.delete");
  const pool = await getReadyPool();
  const client = await pool.connect();
  let objectPath = "";
  let storageBucket = BUCKET;
  try {
    await client.query("begin");
    const asset = await client.query<{ object_path: string; storage_bucket: string }>(`select object_path, storage_bucket from public.club_media_assets where id = $1::uuid and club_id = $2::uuid and deleted_at is null for update`, [assetId, clubId]);
    if (!asset.rows[0]) throw new ClubMediaError("not_found", 404);
    objectPath = asset.rows[0].object_path;
    storageBucket = asset.rows[0].storage_bucket;
    const used = await client.query<{ used: boolean }>(
      `select exists (
         select 1 from public.student_clubs where id = $1::uuid and (logo_url = $2 or cover_image_url = $2)
         union all select 1 from public.events where club_id = $1::uuid and cover_image_url = $2
         union all select 1 from public.event_images image join public.events event on event.id = image.event_id where event.club_id = $1::uuid and image.object_path = $2
         union all select 1 from public.university_posts where club_id = $1::uuid and image_url = $2 and status <> 'deleted'
       ) as used`,
      [clubId, objectPath]
    );
    if (used.rows[0]?.used) throw new ClubMediaError("media_in_use", 409);
    await client.query(`update public.club_media_assets set deleted_at = now(), deleted_by = $3 where id = $1::uuid and club_id = $2::uuid`, [assetId, clubId, user.id]);
    await client.query("commit");
  } catch (error) {
    await client.query("rollback").catch(() => undefined);
    throw error;
  } finally { client.release(); }
  if (objectPath && !objectPath.includes("..") && !objectPath.startsWith("/")) await getSupabaseAdminClient().storage.from(storageBucket).remove([objectPath]).catch(() => undefined);
}

export async function downloadCurrentClubMediaAsset(assetId: string) {
  const user = await getCurrentStudentContext();
  if (!user || user.status !== "active") return null;
  const pool = await getReadyPool();
  const result = await pool.query<{ object_path: string; storage_bucket: string; mime_type: string }>(
    `select asset.object_path, asset.storage_bucket, asset.mime_type
       from public.club_media_assets asset
       join public.student_clubs club on club.id = asset.club_id
      where asset.id = $1::uuid
        and asset.deleted_at is null
        and club.status = 'approved'
        and exists (
          select 1 from public.club_memberships membership
           where membership.club_id = asset.club_id
             and membership.user_id = $2
             and membership.status = 'active'
             and membership.role = any($3::text[])
        )
      limit 1`,
    [assetId, user.id, rolesWithClubCapability("club.posts.view")]
  );
  if (!result.rows[0]) return null;
  const { data, error } = await getSupabaseAdminClient().storage.from(result.rows[0].storage_bucket).download(result.rows[0].object_path);
  return error ? null : { bytes: await data.arrayBuffer(), contentType: result.rows[0].mime_type === "application/octet-stream" ? data.type || "image/jpeg" : result.rows[0].mime_type };
}
