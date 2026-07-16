export const SITEMAP_PAGE_SIZE = 45_000;

export type SitemapUrlEntry = {
  url: string;
  lastModified?: string | null;
  changeFrequency?: "always" | "hourly" | "daily" | "weekly" | "monthly" | "yearly" | "never";
  priority?: number;
};

function escapeXml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

export function sitemapPageCount(totalEntries: number) {
  return Math.ceil(Math.max(0, totalEntries) / SITEMAP_PAGE_SIZE);
}

export function parseSitemapPage(value: string) {
  if (!/^\d+$/.test(value)) return null;
  const page = Number.parseInt(value, 10);
  return Number.isSafeInteger(page) && page >= 0 ? page : null;
}

export function renderSitemapIndex(urls: string[]) {
  const items = urls
    .map((url) => `<sitemap><loc>${escapeXml(url)}</loc></sitemap>`)
    .join("");

  return `<?xml version="1.0" encoding="UTF-8"?><sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">${items}</sitemapindex>`;
}

export function renderSitemapUrlSet(entries: SitemapUrlEntry[]) {
  const items = entries
    .map((entry) => {
      const lastModified = entry.lastModified
        ? `<lastmod>${escapeXml(entry.lastModified)}</lastmod>`
        : "";
      const changeFrequency = entry.changeFrequency
        ? `<changefreq>${entry.changeFrequency}</changefreq>`
        : "";
      const priority = typeof entry.priority === "number"
        ? `<priority>${entry.priority.toFixed(1)}</priority>`
        : "";

      return `<url><loc>${escapeXml(entry.url)}</loc>${lastModified}${changeFrequency}${priority}</url>`;
    })
    .join("");

  return `<?xml version="1.0" encoding="UTF-8"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">${items}</urlset>`;
}

export function sitemapXmlResponse(xml: string) {
  return new Response(xml, {
    status: 200,
    headers: {
      "cache-control": "public, max-age=300, s-maxage=3600, stale-while-revalidate=86400",
      "content-type": "application/xml; charset=utf-8",
      "x-content-type-options": "nosniff"
    }
  });
}
