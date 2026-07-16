import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { PublicPostPreview } from "@/components/public/PublicPostPreview";
import { getAuthUrl, getPublicUrl } from "@/lib/appConfig";
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

function metadataDescription(body: string) {
  const compact = body.replace(/\s+/g, " ").trim();
  if (!compact) return "A public post from a verified university student on Cadesca.";
  return compact.length > 150 ? `${compact.slice(0, 147)}...` : compact;
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
  const title = `Post by ${post.authorDisplayName} on Cadesca`;
  const description = metadataDescription(post.body);
  const images = post.imageUrl ? [{ url: post.imageUrl, alt: title }] : undefined;

  return {
    title,
    description,
    alternates: { canonical },
    robots: { index: true, follow: true },
    openGraph: {
      type: "article",
      url: canonical,
      title,
      description,
      siteName: "Cadesca",
      publishedTime: post.createdAt,
      modifiedTime: post.updatedAt,
      authors: [post.authorDisplayName],
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
  const structuredData = {
    "@context": "https://schema.org",
    "@type": "SocialMediaPosting",
    headline: `Post by ${post.authorDisplayName} on Cadesca`,
    articleBody: post.body || undefined,
    datePublished: post.createdAt,
    dateModified: post.updatedAt,
    image: post.imageUrl || undefined,
    mainEntityOfPage: canonical,
    author: {
      "@type": "Person",
      name: post.authorDisplayName,
      url: post.authorUsername ? `${getPublicUrl()}/user/${encodeURIComponent(post.authorUsername)}` : undefined
    },
    publisher: {
      "@type": "Organization",
      name: "Cadesca",
      url: getPublicUrl()
    }
  };

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify(structuredData).replace(/</g, "\\u003c")
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
