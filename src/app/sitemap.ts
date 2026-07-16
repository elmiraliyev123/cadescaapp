import type { MetadataRoute } from "next";

import { getPublicUrl } from "@/lib/appConfig";
import { listPublicPostSitemapEntries } from "@/lib/server/publicPosts";

export const revalidate = 3600;

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const publicUrl = getPublicUrl();

  try {
    const posts = await listPublicPostSitemapEntries();
    return posts.map((post) => ({
      url: `${publicUrl}/post/${encodeURIComponent(post.id)}`,
      lastModified: post.updatedAt,
      changeFrequency: "weekly",
      priority: 0.7
    }));
  } catch (error) {
    console.error("[sitemap] public_posts_unavailable", {
      reason: error instanceof Error ? error.message : "unknown"
    });
    return [];
  }
}
