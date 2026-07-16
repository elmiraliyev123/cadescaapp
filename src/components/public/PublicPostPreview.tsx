"use client";

import Image from "next/image";
import Link from "next/link";
import { useState } from "react";

import { AppTopBar } from "@/components/app/AppTopBar";
import { PublicGuestBanner } from "@/components/public/PublicGuestBanner";
import { UserAvatar, VerifiedBadge } from "@/components/social/SocialPrimitives";
import { useLanguage, type Language } from "@/lib/i18n";
import { hostRelativePublicAssetUrl } from "@/lib/publicAssetUrl";
import type { PublicPostPreview as PublicPostPreviewData } from "@/lib/server/publicPosts";

const DATE_LOCALES: Record<Language, string> = {
  az: "az-AZ",
  en: "en-US",
  ru: "ru-RU",
  tr: "tr-TR"
};

function formatPostDate(value: string, language: Language) {
  return new Intl.DateTimeFormat(DATE_LOCALES[language], {
    dateStyle: "medium",
    timeStyle: "short"
  }).format(new Date(value));
}

export function PublicPostPreview({
  post,
  shareUrl,
  signupHref,
  loginHref
}: {
  post: PublicPostPreviewData;
  shareUrl: string;
  signupHref: string;
  loginHref: string;
}) {
  const { language, t } = useLanguage();
  const [shareStatus, setShareStatus] = useState("");
  const authorAvatarUrl = hostRelativePublicAssetUrl(post.authorAvatarUrl);
  const imageUrl = hostRelativePublicAssetUrl(post.imageUrl);

  async function sharePost() {
    try {
      if (navigator.share) {
        await navigator.share({ text: post.body || undefined, url: shareUrl });
      } else {
        await navigator.clipboard.writeText(shareUrl);
      }
      setShareStatus(t("social.linkCopied"));
    } catch {
      setShareStatus("");
    }
  }

  return (
    <div className="min-h-dvh bg-[#f7f7f8] text-black">
      <AppTopBar variant="public" />

      <main className="mx-auto w-full max-w-[720px] px-0 pb-[190px] pt-4 sm:px-6 sm:pb-[132px] sm:pt-8">
        <article className="overflow-hidden border-y border-black/10 bg-white sm:rounded-2xl sm:border">
          <div className="p-4 sm:p-6">
            <div className="flex items-start gap-3">
              <Link
                href={post.authorProfileUrl}
                aria-label={`@${post.authorUsername}`}
                className="rounded-full focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-black"
              >
                <UserAvatar
                  name={post.authorDisplayName}
                  src={authorAvatarUrl}
                  size="md"
                  inverse
                />
              </Link>

              <div className="min-w-0 flex-1">
                <div className="flex min-w-0 items-center">
                  <h1 className="min-w-0 truncate text-[16px] font-semibold leading-6">
                    <Link href={post.authorProfileUrl} className="hover:underline">
                      {post.authorDisplayName}
                    </Link>
                  </h1>
                  <VerifiedBadge className="[--verified-tooltip-bottom:168px]" />
                </div>
                <p className="truncate text-[13px] font-normal leading-5 text-black/55">
                  @{post.authorUsername} ·{" "}
                  {post.universityName}
                </p>
              </div>
            </div>

            {post.body ? (
              <p className="mt-5 whitespace-pre-wrap break-words text-[16px] font-normal leading-6 text-black">
                {post.body}
              </p>
            ) : null}

            {imageUrl ? (
              <div className="mt-4 overflow-hidden rounded-2xl border border-black/10 bg-[#f1f1f1]">
                <Image
                  src={imageUrl}
                  alt={t("social.publicPhotoAlt").replace("{name}", post.authorDisplayName)}
                  width={1200}
                  height={1200}
                  unoptimized
                  className="max-h-[620px] w-full object-contain"
                />
              </div>
            ) : null}

            <time dateTime={post.createdAt} className="mt-5 block text-[13px] font-normal leading-5 text-black/55">
              {formatPostDate(post.createdAt, language)}
            </time>

            <div className="mt-4 flex min-h-11 items-center gap-5 border-t border-black/10 pt-2 text-[13px] font-medium text-black/55">
              <span className="inline-flex min-h-11 items-center gap-1.5">
                <span className="material-symbols-outlined icon-ui" aria-hidden="true">favorite</span>
                {post.likeCount}
                <span className="sr-only">{t("social.publicLikes")}</span>
              </span>
              <span className="inline-flex min-h-11 items-center gap-1.5">
                <span className="material-symbols-outlined icon-ui" aria-hidden="true">mode_comment</span>
                {post.commentCount}
                <span className="sr-only">{t("social.publicComments")}</span>
              </span>
              <button
                type="button"
                className="ml-auto inline-flex min-h-11 items-center gap-2 rounded-xl px-3 text-[14px] font-semibold text-black transition-colors hover:bg-black/5"
                onClick={sharePost}
              >
                <span className="material-symbols-outlined icon-ui" aria-hidden="true">ios_share</span>
                {t("social.share")}
              </button>
              <span className="sr-only" role="status">{shareStatus}</span>
            </div>
          </div>
        </article>
      </main>

      <PublicGuestBanner signupHref={signupHref} loginHref={loginHref} />
    </div>
  );
}
