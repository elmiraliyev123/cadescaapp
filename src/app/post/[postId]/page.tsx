import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { PublicPostPreview } from "@/components/public/PublicPostPreview";
import { getAuthUrl, getPublicUrl } from "@/lib/appConfig";
import {
  publicPostDescription,
  publicPostTitle
} from "@/lib/seo/metadata";
import {
  buildDiscussionForumPostingStructuredData,
  serializeJsonLd
} from "@/lib/seo/structuredData";
import { getPublicPostPreview } from "@/lib/server/publicPosts";

type PublicPostPageProps = {
  params: Promise<{ postId: string }>;
};

function postUrl(postId: string) {
  return `${getPublicUrl()}/post/${encodeURIComponent(postId)}`;
}

function authLink(pathname: "/signup" | "/login", next?: string) {
  const url = new URL(pathname, getAuthUrl());
  if (next) url.searchParams.set("next", next);
  return url.toString();
}

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: PublicPostPageProps): Promise<Metadata> {
  const { postId } = await params;
  const post = await getPublicPostPreview(postId);

  if (!post) {
    return {
      title: "Post unavailable | Cadesca",
      robots: { index: false, follow: false }
    };
  }

  const canonical = postUrl(post.id);
  const title = publicPostTitle(post.authorDisplayName, post.body);
  const description = publicPostDescription(post.body);
  const images = post.imageUrl ? [{ url: post.imageUrl, alt: title }] : undefined;

  return {
    title,
    description,
    alternates: { canonical },
    authors: [{
      name: post.authorDisplayName,
      url: post.authorProfileUrl
    }],
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
      type: "article",
      url: canonical,
      title,
      description,
      siteName: "Cadesca",
      publishedTime: post.createdAt,
      modifiedTime: post.updatedAt,
      authors: [post.authorProfileUrl],
      images
    },
    twitter: {
      card: post.imageUrl ? "summary_large_image" : "summary",
      title,
      description,
      images: post.imageUrl ? [post.imageUrl] : undefined
    }
  };
}

export default async function PublicPostPage({ params }: PublicPostPageProps) {
  const { postId } = await params;
  const post = await getPublicPostPreview(postId);

  if (!post) notFound();

  const canonical = postUrl(post.id);
  const structuredData = buildDiscussionForumPostingStructuredData({
    canonicalUrl: canonical,
    siteUrl: getPublicUrl(),
    body: post.body,
    imageUrl: post.imageUrl,
    createdAt: post.createdAt,
    updatedAt: post.updatedAt,
    likeCount: post.likeCount,
    commentCount: post.commentCount,
    author: {
      displayName: post.authorDisplayName,
      username: post.authorUsername,
      profileUrl: post.authorProfileUrl
    }
  });

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: serializeJsonLd(structuredData)
        }}
      />
      <PublicPostPreview
        post={post}
        shareUrl={canonical}
        signupHref={authLink("/signup", canonical)}
        loginHref={authLink("/login", canonical)}
      />
    </>
  );
}
