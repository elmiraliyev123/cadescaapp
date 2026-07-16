"use client";

import { useState } from "react";

import { AppTopBar } from "@/components/app/AppTopBar";
import { UserAvatar, VerifiedBadge } from "@/components/social/SocialPrimitives";
import { useLanguage, type Language } from "@/lib/i18n";
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

function JoinCadescaBanner({
  signupHref,
  loginHref
}: {
  signupHref: string;
  loginHref: string;
}) {
  const { t } = useLanguage();

  return (
    <aside
      aria-labelledby="join-cadesca-title"
      className="public-maple-banner fixed inset-x-0 bottom-0 z-50 w-full border-t border-white/30 px-4 pb-[calc(12px+env(safe-area-inset-bottom))] pt-3 shadow-[0_-8px_32px_rgba(62,31,20,0.22)] sm:px-6 sm:py-4"
    >
      <div className="relative z-10 mx-auto flex w-full max-w-[960px] flex-col gap-3 sm:flex-row sm:items-center sm:justify-between sm:gap-6">
        <div className="min-w-0">
          <h2 id="join-cadesca-title" className="text-[18px] font-semibold leading-6 text-white sm:text-[20px]">
            {t("social.publicJoinTitle")}
          </h2>
          <p className="mt-0.5 max-w-[500px] text-[13px] font-normal leading-5 text-white/85">
            {t("social.publicJoinDescription")}
          </p>
        </div>

        <div className="grid shrink-0 grid-cols-2 gap-2 sm:flex sm:w-auto">
          <a
            href={signupHref}
            className="inline-flex min-h-11 min-w-[112px] items-center justify-center rounded-xl border border-black bg-black px-5 text-[15px] font-semibold text-white transition-transform duration-200 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white active:scale-[0.98]"
          >
            {t("social.publicSignUp")}
          </a>
          <a
            href={loginHref}
            className="inline-flex min-h-11 min-w-[112px] items-center justify-center rounded-xl border border-black/35 bg-white/95 px-5 text-[15px] font-semibold text-black transition-transform duration-200 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white active:scale-[0.98]"
          >
            {t("social.publicLogIn")}
          </a>
        </div>
      </div>
    </aside>
  );
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
              <UserAvatar
                name={post.authorDisplayName}
                src={post.authorAvatarUrl}
                size="md"
                inverse
              />

              <div className="min-w-0 flex-1">
                <div className="flex min-w-0 items-center">
                  <h1 className="min-w-0 truncate text-[16px] font-semibold leading-6">
                    {post.authorDisplayName}
                  </h1>
                  <VerifiedBadge className="[--verified-tooltip-bottom:168px]" />
                </div>
                <p className="truncate text-[13px] font-normal leading-5 text-black/55">
                  {post.authorUsername ? `@${post.authorUsername} · ` : ""}
                  {post.universityName}
                </p>
              </div>
            </div>

            {post.body ? (
              <p className="mt-5 whitespace-pre-wrap break-words text-[16px] font-normal leading-6 text-black">
                {post.body}
              </p>
            ) : null}

            {post.imageUrl ? (
              <div className="mt-4 overflow-hidden rounded-2xl border border-black/10 bg-[#f1f1f1]">
                <img
                  src={post.imageUrl}
                  alt={t("social.publicPhotoAlt").replace("{name}", post.authorDisplayName)}
                  width={1200}
                  height={1200}
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

      <JoinCadescaBanner signupHref={signupHref} loginHref={loginHref} />
    </div>
  );
}
