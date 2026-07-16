import "server-only";

import { getSupabaseAdminClient } from "@/lib/supabase/admin";

export type PublicAssetBucket = "avatars" | "social-images";

const PUBLIC_IMAGE_PATH_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._/-]*\.(?:avif|gif|jpe?g|png|webp)$/i;

export function isPublicImageObjectPath(value: string | null | undefined): value is string {
  return Boolean(
    value &&
      !value.includes("..") &&
      !value.startsWith("/") &&
      PUBLIC_IMAGE_PATH_PATTERN.test(value)
  );
}

export async function downloadPublicImage(bucket: PublicAssetBucket, objectPath: string) {
  if (!isPublicImageObjectPath(objectPath)) return null;

  try {
    const { data, error } = await getSupabaseAdminClient()
      .storage
      .from(bucket)
      .download(objectPath);

    if (error) throw error;
    if (!data.type.startsWith("image/")) return null;

    return {
      body: await data.arrayBuffer(),
      contentType: data.type,
      size: data.size
    };
  } catch (error) {
    console.error("[public_asset] unavailable", {
      bucket,
      reason: error instanceof Error ? error.message : "unknown"
    });
    return null;
  }
}

export function publicImageResponse(asset: {
  body: ArrayBuffer;
  contentType: string;
  size: number;
}) {
  return new Response(asset.body, {
    status: 200,
    headers: {
      "cache-control": "no-store",
      "content-length": String(asset.size),
      "content-type": asset.contentType,
      "x-content-type-options": "nosniff"
    }
  });
}

export function publicImageNotFoundResponse() {
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
