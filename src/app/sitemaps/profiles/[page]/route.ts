import { getPublicUrl } from "@/lib/appConfig";
import {
  parseSitemapPage,
  renderSitemapUrlSet,
  SITEMAP_PAGE_SIZE,
  sitemapXmlResponse
} from "@/lib/seo/sitemap";
import { listPublicProfileSitemapEntries } from "@/lib/server/publicProfiles";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ page: string }> }
) {
  const { page: pageValue } = await params;
  const page = parseSitemapPage(pageValue);
  if (page === null) return new Response("Not found", { status: 404 });

  const publicUrl = getPublicUrl();
  const profiles = await listPublicProfileSitemapEntries({
    limit: SITEMAP_PAGE_SIZE,
    offset: page * SITEMAP_PAGE_SIZE
  });

  return sitemapXmlResponse(
    renderSitemapUrlSet(
      profiles.map((profile) => ({
        url: `${publicUrl}/user/${encodeURIComponent(profile.username)}`,
        lastModified: profile.updatedAt,
        changeFrequency: "weekly",
        priority: 0.8
      }))
    )
  );
}
