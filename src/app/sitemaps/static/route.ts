import { getPublicUrl } from "@/lib/appConfig";
import { renderSitemapUrlSet, sitemapXmlResponse } from "@/lib/seo/sitemap";

export const revalidate = 86_400;

export function GET() {
  const publicUrl = getPublicUrl();

  return sitemapXmlResponse(
    renderSitemapUrlSet([
      {
        url: publicUrl,
        changeFrequency: "weekly",
        priority: 1
      },
      {
        url: `${publicUrl}/privacy`,
        changeFrequency: "yearly",
        priority: 0.3
      },
      {
        url: `${publicUrl}/terms`,
        changeFrequency: "yearly",
        priority: 0.3
      },
      {
        url: `${publicUrl}/safety`,
        changeFrequency: "yearly",
        priority: 0.4
      },
      {
        url: `${publicUrl}/guidelines`,
        changeFrequency: "yearly",
        priority: 0.4
      }
    ])
  );
}
