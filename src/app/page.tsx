import type { Metadata } from "next";

import { HomeLandingPage } from "@/components/public/HomeLandingPage";
import { getPublicUrl } from "@/lib/appConfig";
import { parseOfficialSocialUrls } from "@/lib/seo/metadata";
import {
  buildHomepageStructuredData,
  serializeJsonLd
} from "@/lib/seo/structuredData";

const publicUrl = getPublicUrl();
const title = "Cadesca | Verified Student Community";
const description =
  "Cadesca is a verified student community for campus conversations, public profiles, and university life.";

export const metadata: Metadata = {
  title,
  description,
  alternates: {
    canonical: publicUrl
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      "max-image-preview": "large",
      "max-snippet": -1,
      "max-video-preview": -1
    }
  },
  openGraph: {
    type: "website",
    url: publicUrl,
    title,
    description,
    siteName: "Cadesca",
    images: [{
      url: `${publicUrl}/cadesca-logo.png`,
      width: 1290,
      height: 520,
      alt: "Cadesca"
    }]
  },
  twitter: {
    card: "summary_large_image",
    title,
    description,
    images: [`${publicUrl}/cadesca-logo.png`]
  }
};

export default function Home() {
  const structuredData = buildHomepageStructuredData({
    siteUrl: publicUrl,
    logoUrl: `${publicUrl}/cadesca-mark.png`,
    officialSocialUrls: parseOfficialSocialUrls(
      process.env.CADESCA_OFFICIAL_SOCIAL_URLS
    )
  });

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: serializeJsonLd(structuredData)
        }}
      />
      <HomeLandingPage />
    </>
  );
}
