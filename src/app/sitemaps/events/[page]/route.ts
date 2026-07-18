import { getPublicUrl } from "@/lib/appConfig";
import {
  parseSitemapPage,
  renderSitemapUrlSet,
  SITEMAP_PAGE_SIZE,
  sitemapXmlResponse
} from "@/lib/seo/sitemap";
import { listPublicEventSitemapEntries } from "@/lib/server/events";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(_request: Request, { params }: { params: Promise<{ page: string }> }) {
  const { page: pageValue } = await params;
  const page = parseSitemapPage(pageValue);
  if (page === null) return new Response("Not found", { status: 404 });
  const publicUrl = getPublicUrl();
  const events = await listPublicEventSitemapEntries({
    limit: SITEMAP_PAGE_SIZE,
    offset: page * SITEMAP_PAGE_SIZE
  });
  return sitemapXmlResponse(
    renderSitemapUrlSet(
      events.map((event) => ({
        url: `${publicUrl}/event/${encodeURIComponent(event.slug)}`,
        lastModified: event.updatedAt,
        changeFrequency: "daily",
        priority: 0.8
      }))
    )
  );
}

