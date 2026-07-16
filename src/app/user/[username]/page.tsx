import type { Metadata } from "next";
import { headers } from "next/headers";
import { notFound } from "next/navigation";

import { PublicProfilePreview } from "@/components/public/PublicProfilePreview";
import { PublicProfileScreen } from "@/components/social/UserSocialScreens";
import { getAuthUrl, getPublicUrl } from "@/lib/appConfig";
import { publicProfileDescription } from "@/lib/seo/metadata";
import {
  buildProfilePageStructuredData,
  serializeJsonLd
} from "@/lib/seo/structuredData";
import {
  getSearchPublicProfileByUsername,
  type SearchPublicProfile
} from "@/lib/server/publicProfiles";
import {
  getPublicProfileByUsername as getAuthenticatedProfileByUsername,
  type PublicStudentProfile
} from "@/lib/server/social";

type PublicUserProfilePageProps = {
  params: Promise<{ username: string }>;
};

export const dynamic = "force-dynamic";

function profileUrl(username: string) {
  return `${getPublicUrl()}/user/${encodeURIComponent(username)}`;
}

function authLink(pathname: "/signup" | "/login", next: string) {
  const url = new URL(pathname, getAuthUrl());
  url.searchParams.set("next", next);
  return url.toString();
}

async function requestHost() {
  const requestHeaders = await headers();
  return (requestHeaders.get("host") || "").split(":")[0].toLowerCase();
}

function isAuthenticatedAppHost(host: string) {
  return host === "app.cadesca.com" || host === "cadesca-app.vercel.app";
}

function unavailableMetadata(): Metadata {
  return {
    title: "Profile unavailable | Cadesca",
    robots: {
      index: false,
      follow: false
    }
  };
}

function profileMetadata(
  profile: SearchPublicProfile,
  canonical: string,
  indexable: boolean
): Metadata {
  const title = `${profile.displayName} (@${profile.username}) | Cadesca`;
  const description = publicProfileDescription(profile);
  const images = profile.avatarUrl
    ? [{ url: profile.avatarUrl, alt: `${profile.displayName} on Cadesca` }]
    : [{
        url: `${getPublicUrl()}/cadesca-logo.png`,
        alt: "Cadesca"
      }];

  return {
    title,
    description,
    alternates: { canonical },
    robots: indexable
      ? {
          index: true,
          follow: true,
          googleBot: {
            index: true,
            follow: true,
            "max-image-preview": "large",
            "max-snippet": -1,
            "max-video-preview": -1
          }
        }
      : {
          index: false,
          follow: false
        },
    openGraph: {
      type: "profile",
      url: canonical,
      title,
      description,
      siteName: "Cadesca",
      images
    },
    twitter: {
      card: profile.avatarUrl ? "summary_large_image" : "summary",
      title,
      description,
      images: images.map((image) => image.url)
    }
  };
}

export async function generateMetadata({
  params
}: PublicUserProfilePageProps): Promise<Metadata> {
  const [{ username }, host] = await Promise.all([params, requestHost()]);
  const profile = await getSearchPublicProfileByUsername(username);
  if (!profile) return unavailableMetadata();

  return profileMetadata(
    profile,
    profileUrl(profile.username),
    !isAuthenticatedAppHost(host)
  );
}

export default async function PublicUserProfileRoute({
  params
}: PublicUserProfilePageProps) {
  const [{ username }, host] = await Promise.all([params, requestHost()]);

  if (isAuthenticatedAppHost(host)) {
    const authenticatedProfile: PublicStudentProfile | null =
      await getAuthenticatedProfileByUsername(username);
    if (!authenticatedProfile) notFound();

    return <PublicProfileScreen profile={authenticatedProfile} />;
  }

  const profile = await getSearchPublicProfileByUsername(username);
  if (!profile) notFound();

  const canonical = profileUrl(profile.username);
  const structuredData = buildProfilePageStructuredData({
    canonicalUrl: canonical,
    displayName: profile.displayName,
    username: profile.username,
    universityName: profile.universityName,
    bio: profile.bio,
    avatarUrl: profile.avatarUrl,
    publicPostCount: profile.publicPostCount,
    createdAt: profile.createdAt,
    updatedAt: profile.updatedAt
  });

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: serializeJsonLd(structuredData)
        }}
      />
      <PublicProfilePreview
        profile={profile}
        signupHref={authLink("/signup", canonical)}
        loginHref={authLink("/login", canonical)}
      />
    </>
  );
}
