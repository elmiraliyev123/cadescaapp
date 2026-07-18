import type { MetadataRoute } from "next";

import { getPublicUrl } from "@/lib/appConfig";

export default function robots(): MetadataRoute.Robots {
  const publicUrl = getPublicUrl();

  return {
    rules: [{
      userAgent: "*",
      allow: [
        "/",
        "/user/",
        "/post/",
        "/event/",
        "/media/",
        "/privacy",
        "/terms",
        "/safety",
        "/guidelines",
        "/_next/"
      ],
      disallow: [
        "/app/",
        "/api/",
        "/admin/",
        "/merchant/"
      ]
    }],
    sitemap: `${publicUrl}/sitemap.xml`,
    host: publicUrl
  };
}
