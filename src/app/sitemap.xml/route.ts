import { getPublicUrl } from "@/lib/appConfig";
import { sitemapPageCount, renderSitemapIndex, sitemapXmlResponse } from "@/lib/seo/sitemap";
import { countPublicPostSitemapEntries } from "@/lib/server/publicPosts";
import { countPublicProfileSitemapEntries } from "@/lib/server/publicProfiles";
import { countPublicEventSitemapEntries } from "@/lib/server/events";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

async function sitemapCounts() {
  try {
    const [profileCount, postCount, eventCount] = await Promise.all([
      countPublicProfileSitemapEntries(),
      countPublicPostSitemapEntries(),
      countPublicEventSitemapEntries().catch((error) => {
        console.warn("[sitemap] events_unavailable", {
          reason: error instanceof Error ? error.name : "unknown"
        });
        return 0;
      })
    ]);

    return { profileCount, postCount, eventCount };
  } catch (error) {
    console.error("[sitemap] counts_unavailable", {
      reason: error instanceof Error ? error.message : "unknown"
    });
    return { profileCount: 0, postCount: 0, eventCount: 0 };
  }
}

export async function GET() {
  const publicUrl = getPublicUrl();
  const { profileCount, postCount, eventCount } = await sitemapCounts();
  const urls = [`${publicUrl}/sitemaps/static`];

  for (let page = 0; page < sitemapPageCount(profileCount); page += 1) {
    urls.push(`${publicUrl}/sitemaps/profiles/${page}`);
  }

  for (let page = 0; page < sitemapPageCount(postCount); page += 1) {
    urls.push(`${publicUrl}/sitemaps/posts/${page}`);
  }

  for (let page = 0; page < sitemapPageCount(eventCount); page += 1) {
    urls.push(`${publicUrl}/sitemaps/events/${page}`);
  }

  return sitemapXmlResponse(renderSitemapIndex(urls));
}
