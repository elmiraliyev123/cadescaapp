import "server-only";

import { getAdminSessionFromCookies } from "@/lib/server/adminAuth";
import { getCurrentStudentContext } from "@/lib/server/social";
import { getReadyPool } from "@/lib/server/users";
import { getSupabaseAdminClient } from "@/lib/supabase/admin";

const EVENT_ASSET_BUCKET = "event-assets";
const SAFE_ASSET_PATH = /^[A-Za-z0-9][A-Za-z0-9._/-]*\.(?:avif|jpe?g|png|webp)$/i;

function safePath(value: string | null | undefined): value is string {
  return Boolean(value && !value.startsWith("/") && !value.includes("..") && SAFE_ASSET_PATH.test(value));
}

export async function getPublicEventCoverPath(eventId: string) {
  const pool = await getReadyPool();
  const [viewer, admin] = await Promise.all([
    getCurrentStudentContext().catch(() => null),
    getAdminSessionFromCookies().catch(() => null)
  ]);
  const result = await pool.query<{ cover_image_url: string | null; is_public: boolean }>(
    `select event.cover_image_url,
            (event.status in ('published', 'sold_out', 'cancelled', 'completed') and club.status = 'approved') as is_public
       from public.events event
       join public.student_clubs club on club.id = event.club_id
      where event.id = $1::uuid
        and (
          (event.status in ('published', 'sold_out', 'cancelled', 'completed') and club.status = 'approved')
          or $3::boolean
          or exists (
            select 1
              from public.club_memberships membership
             where membership.club_id = event.club_id
               and membership.user_id = $2::text
               and membership.status in ('active', 'invited')
          )
        )
      limit 1`,
    [eventId, viewer?.id || null, Boolean(admin)]
  );
  const row = result.rows[0];
  return safePath(row?.cover_image_url) ? { path: row.cover_image_url, isPublic: row.is_public } : null;
}

export async function getPublicClubLogoPath(clubId: string) {
  const pool = await getReadyPool();
  const [viewer, admin] = await Promise.all([
    getCurrentStudentContext().catch(() => null),
    getAdminSessionFromCookies().catch(() => null)
  ]);
  const result = await pool.query<{ logo_url: string | null; is_public: boolean }>(
    `select logo_url, (status = 'approved') as is_public
       from public.student_clubs
      where id = $1::uuid
        and (
          status = 'approved'
          or $3::boolean
          or exists (
            select 1
              from public.club_memberships membership
             where membership.club_id = student_clubs.id
               and membership.user_id = $2::text
               and membership.status in ('active', 'invited')
          )
        )
      limit 1`,
    [clubId, viewer?.id || null, Boolean(admin)]
  );
  const row = result.rows[0];
  return safePath(row?.logo_url) ? { path: row.logo_url, isPublic: row.is_public } : null;
}

export async function downloadEventAsset(path: string) {
  if (!safePath(path)) return null;
  const { data, error } = await getSupabaseAdminClient().storage.from(EVENT_ASSET_BUCKET).download(path);
  if (error || !data || !data.type.startsWith("image/")) return null;
  return {
    body: await data.arrayBuffer(),
    contentType: data.type,
    size: data.size
  };
}

export function eventAssetResponse(asset: { body: ArrayBuffer; contentType: string; size: number }, isPublic: boolean) {
  return new Response(asset.body, {
    status: 200,
    headers: {
      "cache-control": isPublic
        ? "public, max-age=300, s-maxage=3600, stale-while-revalidate=86400"
        : "private, no-store",
      "content-length": String(asset.size),
      "content-type": asset.contentType,
      "x-content-type-options": "nosniff",
      ...(isPublic ? {} : { vary: "Cookie" })
    }
  });
}

export function eventAssetNotFoundResponse() {
  return new Response("Not found", {
    status: 404,
    headers: {
      "cache-control": "no-store",
      "content-type": "text/plain; charset=utf-8",
      "x-content-type-options": "nosniff",
      "x-robots-tag": "noindex"
    }
  });
}
