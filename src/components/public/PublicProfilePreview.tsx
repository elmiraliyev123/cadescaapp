"use client";

import Image from "next/image";
import Link from "next/link";

import { AppTopBar } from "@/components/app/AppTopBar";
import { PublicGuestBanner } from "@/components/public/PublicGuestBanner";
import { UserAvatar, VerifiedBadge } from "@/components/social/SocialPrimitives";
import { useLanguage, type Language } from "@/lib/i18n";
import { hostRelativePublicAssetUrl } from "@/lib/publicAssetUrl";
import type {
  PublicProfilePostPreview,
  SearchPublicProfile
} from "@/lib/server/publicProfiles";

const DATE_LOCALES: Record<Language, string> = {
  az: "az-AZ",
  en: "en-US",
  ru: "ru-RU",
  tr: "tr-TR"
};

function formatPostDate(value: string, language: Language) {
  return new Intl.DateTimeFormat(DATE_LOCALES[language], {
    dateStyle: "medium"
  }).format(new Date(value));
}

function PublicProfilePostCard({
  post,
  profile
}: {
  post: PublicProfilePostPreview;
  profile: SearchPublicProfile;
}) {
  const { language, t } = useLanguage();
  const imageUrl = hostRelativePublicAssetUrl(post.imageUrl);

  return (
    <article className="overflow-hidden border-y border-black/10 bg-white sm:rounded-2xl sm:border">
      <Link
        href={`/post/${encodeURIComponent(post.id)}`}
        className="block p-4 transition-colors hover:bg-black/[0.015] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-black sm:p-5"
      >
        {post.body ? (
          <p className="whitespace-pre-wrap break-words text-[15px] font-normal leading-6 text-black">
            {post.body}
          </p>
        ) : null}

        {imageUrl ? (
          <div className="mt-4 overflow-hidden rounded-2xl border border-black/10 bg-[#f1f1f1]">
            <Image
              src={imageUrl}
              alt={t("social.publicPhotoAlt").replace("{name}", profile.displayName)}
              width={1200}
              height={1200}
              unoptimized
              loading="lazy"
              className="max-h-[520px] w-full object-contain"
            />
          </div>
        ) : null}

        <div className="mt-4 flex items-center gap-4 border-t border-black/10 pt-3 text-[13px] font-medium text-black/55">
          <time dateTime={post.createdAt}>
            {formatPostDate(post.createdAt, language)}
          </time>
          <span className="ml-auto inline-flex items-center gap-1">
            <span className="material-symbols-outlined icon-ui" aria-hidden="true">favorite</span>
            {post.likeCount}
            <span className="sr-only">{t("social.publicLikes")}</span>
          </span>
          <span className="inline-flex items-center gap-1">
            <span className="material-symbols-outlined icon-ui" aria-hidden="true">mode_comment</span>
            {post.commentCount}
            <span className="sr-only">{t("social.publicComments")}</span>
          </span>
        </div>
      </Link>
    </article>
  );
}

type PublicProfilePreviewProps = {
  profile: SearchPublicProfile;
  signupHref: string;
  loginHref: string;
};

export function PublicProfilePreview({
  profile,
  signupHref,
  loginHref
}: PublicProfilePreviewProps) {
  const { t } = useLanguage();
  const avatarUrl = hostRelativePublicAssetUrl(profile.avatarUrl);

  return (
    <div className="min-h-dvh bg-[#f7f7f8] text-black">
      <AppTopBar variant="public" />

      <main className="mx-auto w-full max-w-[760px] px-0 pb-[210px] pt-4 sm:px-6 sm:pb-[140px] sm:pt-8">
        <section className="border-y border-black/10 bg-white p-5 sm:rounded-2xl sm:border sm:p-7">
          <div className="flex items-start gap-4 sm:gap-5">
            <UserAvatar
              name={profile.displayName}
              src={avatarUrl}
              size="xl"
              inverse
              className="h-20 w-20 sm:h-24 sm:w-24"
            />

            <div className="min-w-0 flex-1">
              <div className="flex min-w-0 items-center">
                <h1 className="min-w-0 break-words text-[22px] font-semibold leading-7 sm:text-[26px] sm:leading-8">
                  {profile.displayName}
                </h1>
                <VerifiedBadge className="[--verified-tooltip-bottom:168px]" />
              </div>
              <p className="mt-1 break-words text-[14px] leading-5 text-black/55">
                @{profile.username}
              </p>
              <p className="mt-2 text-[14px] font-semibold leading-5 text-black">
                {profile.universityName}
              </p>
              <p className="mt-3 inline-flex min-h-9 items-center rounded-full bg-black/[0.05] px-3 text-[13px] font-semibold text-black/70">
                {profile.publicPostCount} {t("social.posts")}
              </p>
            </div>
          </div>

          {profile.bio ? (
            <p className="mt-5 whitespace-pre-wrap break-words border-t border-black/10 pt-5 text-[15px] leading-6 text-black">
              {profile.bio}
            </p>
          ) : null}
        </section>

        <section className="mt-6" aria-labelledby="public-profile-posts">
          <h2
            id="public-profile-posts"
            className="px-4 text-[18px] font-semibold leading-6 text-black sm:px-0"
          >
            {t("social.posts")}
          </h2>

          <div className="mt-3 space-y-4">
            {profile.posts.length ? (
              profile.posts.map((post) => (
                <PublicProfilePostCard key={post.id} post={post} profile={profile} />
              ))
            ) : (
              <div className="border-y border-black/10 bg-white px-5 py-10 text-center sm:rounded-2xl sm:border">
                <p className="text-[15px] leading-6 text-black/55">
                  {t("social.noPostsYet")}
                </p>
              </div>
            )}
          </div>
        </section>
      </main>

      <PublicGuestBanner signupHref={signupHref} loginHref={loginHref} />
    </div>
  );
}
