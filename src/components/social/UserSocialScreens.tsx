"use client";

import Link from "next/link";
import { useActionState, useEffect, useId, useRef, useState, useTransition } from "react";
import { useFormStatus } from "react-dom";
import { useRouter } from "next/navigation";

import {
  addPostCommentAction,
  createPostAction,
  deletePostAction,
  reportPostAction,
  toggleFollowAction,
  togglePostLikeAction,
  type SocialFormState
} from "@/app/app/user/social/actions";
import {
  updateLanguagePreference,
  updateProfileSettingsAction,
  type ProfileSettingsFormState
} from "@/app/app/user/profile/actions";
import { ScreenHeader } from "@/components/screens/ScreenHeader";
import { WalletPassSection, type DeviceType } from "@/components/screens/WalletPassSection";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { useLanguage, type Language } from "@/lib/i18n";
import type {
  CurrentStudentContext,
  PublicStudentProfile,
  SocialActivityItem,
  SocialPost,
  StudentProfileStats
} from "@/lib/server/social";
import { cn } from "@/lib/utils";

const EMPTY_FORM_STATE: SocialFormState = { ok: false, message: "" };
const EMPTY_PROFILE_SETTINGS_STATE: ProfileSettingsFormState = { ok: false, message: "" };
const POST_MAX_LENGTH = 1000;
const NATIVE_IMAGE_ACCEPT = "image/*,image/jpeg,image/png,image/webp,image/heic,image/heif,image/avif,image/gif,.jpg,.jpeg,.png,.webp,.heic,.heif,.avif,.gif";

const LANGUAGE_OPTIONS: ReadonlyArray<{ value: Language; label: string }> = [
  { value: "az", label: "Azərbaycan dili" },
  { value: "tr", label: "Türkçe" },
  { value: "en", label: "English" },
  { value: "ru", label: "Русский" }
];

const DATE_LOCALES: Record<Language, string> = {
  az: "az-AZ",
  en: "en-US",
  ru: "ru-RU",
  tr: "tr-TR"
};

function formatDateTime(value: string | null | undefined, language: Language = "en") {
  if (!value) return "-";
  return new Intl.DateTimeFormat(DATE_LOCALES[language], {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit"
  }).format(new Date(value));
}

function campusCommunityName(user: CurrentStudentContext | null | undefined, fallback = "Cadesca campus") {
  const university = user?.universityName || user?.legacyUniversityName;
  if (!university) return fallback;
  return `Cadesca x ${university.replace(/ University$/i, "")}`;
}

function initials(name: string | null | undefined, fallback = "Cadesca Student") {
  const parts = (name || fallback).trim().split(/\s+/).slice(0, 2);
  return parts.map((part) => part[0]?.toUpperCase()).join("") || "CS";
}

function translatedMessage(t: ReturnType<typeof useLanguage>["t"], message: string) {
  return message.startsWith("social.") ? t(message as Parameters<typeof t>[0]) : message;
}

function SocialPageHeader({
  title,
  subtitle,
  action
}: {
  title: string;
  subtitle?: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="mx-auto mb-5 flex w-full max-w-5xl flex-col items-start gap-3 sm:flex-row sm:items-end sm:justify-between">
      <div className="w-full min-w-0 max-w-full sm:flex-1">
        <h1 className="text-headline-md font-semibold text-primary">{title}</h1>
        {subtitle ? <p className="mt-1 break-words text-body-md text-secondary">{subtitle}</p> : null}
      </div>
      {action ? <div className="max-w-full sm:shrink-0">{action}</div> : null}
    </div>
  );
}

function Avatar({
  name,
  src,
  size = "md",
  inverse = false
}: {
  name: string | null | undefined;
  src?: string | null;
  size?: "sm" | "md" | "lg" | "xl";
  inverse?: boolean;
}) {
  const sizes = {
    sm: "h-8 w-8 text-caption",
    md: "h-10 w-10 text-label-md",
    lg: "h-16 w-16 text-title-lg",
    xl: "h-20 w-20 text-headline-md"
  };
  const { t } = useLanguage();

  return (
    <div
      className={cn(
        "flex shrink-0 items-center justify-center overflow-hidden rounded-full border border-outline-variant/30 font-semibold",
        sizes[size],
        inverse ? "bg-primary text-on-primary" : "bg-surface-container-low text-primary"
      )}
    >
      {src ? <img src={src} alt="" className="h-full w-full object-cover" /> : initials(name, t("social.defaultStudentName"))}
    </div>
  );
}

function ImageUploadPicker({
  name,
  currentUrl,
  compact = false,
  capture = "environment",
  helpText
}: {
  name: string;
  currentUrl?: string | null;
  compact?: boolean;
  capture?: "user" | "environment";
  helpText: string;
}) {
  const { t } = useLanguage();
  const libraryInputRef = useRef<HTMLInputElement | null>(null);
  const cameraInputRef = useRef<HTMLInputElement | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(currentUrl || null);
  const [selectedName, setSelectedName] = useState("");

  useEffect(() => {
    setPreviewUrl(currentUrl || null);
  }, [currentUrl]);

  useEffect(() => {
    return () => {
      if (previewUrl?.startsWith("blob:")) URL.revokeObjectURL(previewUrl);
    };
  }, [previewUrl]);

  function setFile(file: File | undefined, otherInput: HTMLInputElement | null) {
    if (!file) return;
    if (otherInput) otherInput.value = "";
    setPreviewUrl((previous) => {
      if (previous?.startsWith("blob:")) URL.revokeObjectURL(previous);
      return URL.createObjectURL(file);
    });
    setSelectedName(file.name || t("social.photoSelected"));
  }

  function clearFile() {
    if (libraryInputRef.current) libraryInputRef.current.value = "";
    if (cameraInputRef.current) cameraInputRef.current.value = "";
    setSelectedName("");
    setPreviewUrl((previous) => {
      if (previous?.startsWith("blob:")) URL.revokeObjectURL(previous);
      return currentUrl || null;
    });
  }

  return (
    <div className={cn("rounded-2xl border border-outline-variant/30 bg-surface-container-lowest p-3", compact && "p-2.5")}>
      <input
        ref={libraryInputRef}
        name={name}
        type="file"
        accept={NATIVE_IMAGE_ACCEPT}
        className="hidden"
        onChange={(event) => setFile(event.target.files?.[0], cameraInputRef.current)}
      />
      <input
        ref={cameraInputRef}
        name={name}
        type="file"
        accept={NATIVE_IMAGE_ACCEPT}
        capture={capture}
        className="hidden"
        onChange={(event) => setFile(event.target.files?.[0], libraryInputRef.current)}
      />

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <div className={cn("flex min-w-0 flex-1 items-center gap-3", compact && "gap-2")}>
          <div className={cn("flex shrink-0 items-center justify-center overflow-hidden rounded-xl border border-outline-variant/20 bg-surface-container-low", compact ? "h-12 w-12" : "h-16 w-16")}>
            {previewUrl ? (
              <img src={previewUrl} alt="" className="h-full w-full object-cover" />
            ) : (
              <span className="material-symbols-outlined text-[22px] text-secondary" aria-hidden="true">add_photo_alternate</span>
            )}
          </div>
          <div className="min-w-0">
            <p className="truncate text-caption font-semibold text-primary">
              {selectedName || (previewUrl ? t("social.profilePhoto") : t("social.addPhoto"))}
            </p>
            <p className="mt-0.5 line-clamp-2 text-caption text-secondary">{helpText}</p>
          </div>
        </div>

        <div className="flex flex-wrap gap-2">
          <Button type="button" size="sm" variant="secondary" icon="upload" onClick={() => libraryInputRef.current?.click()}>
            {previewUrl ? t("social.replacePhoto") : t("social.addPhoto")}
          </Button>
          <Button type="button" size="sm" variant="quiet" icon="photo_camera" onClick={() => cameraInputRef.current?.click()}>
            {t("social.takePhoto")}
          </Button>
          {selectedName ? (
            <Button type="button" size="sm" variant="ghost" icon="close" onClick={clearFile}>
              {t("social.removePhoto")}
            </Button>
          ) : null}
        </div>
      </div>
    </div>
  );
}

function VerifiedBadge() {
  const { t } = useLanguage();
  const [open, setOpen] = useState(false);
  const tooltipId = useId();

  return (
    <span className="relative inline-flex">
      <button
        type="button"
        className="inline-flex h-5 w-5 items-center justify-center rounded-full text-primary transition-colors hover:bg-surface-container-low focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/30"
        aria-label={t("social.verifiedBadgeLabel")}
        aria-describedby={open ? tooltipId : undefined}
        aria-expanded={open}
        onClick={() => setOpen((value) => !value)}
        onFocus={() => setOpen(true)}
        onBlur={() => window.setTimeout(() => setOpen(false), 120)}
        onMouseEnter={() => setOpen(true)}
        onMouseLeave={() => setOpen(false)}
      >
        <span
          className="material-symbols-outlined material-symbols-filled leading-none"
          style={{ fontSize: 16 }}
          aria-hidden="true"
        >
          verified
        </span>
      </button>
      {open ? (
        <span
          id={tooltipId}
          role="tooltip"
          className="absolute left-0 top-7 z-20 w-64 rounded-xl border border-outline-variant/30 bg-surface-container-lowest p-3 text-caption font-semibold text-secondary shadow-soft"
        >
          {t("social.verifiedBadgeTooltip")}
        </span>
      ) : null}
    </span>
  );
}

function isVerifiedStudent(user: CurrentStudentContext | null): user is CurrentStudentContext & { universityId: string } {
  return Boolean(user?.socialReady && user.status === "active" && user.studentStatus === "verified" && user.universityId);
}

function VerificationGate({ user }: { user: CurrentStudentContext | null }) {
  const { t } = useLanguage();
  let title = t("social.studentVerificationRequiredTitle");
  let detail = t("social.studentVerificationRequiredDetail");
  let icon = "verified_user";

  if (!user) {
    title = t("social.signInRequiredTitle");
    detail = t("social.signInRequiredDetail");
  } else if (!user.socialReady) {
    title = t("social.campusAlmostReadyTitle");
    detail = t("social.campusAlmostReadyDetail");
    icon = "hourglass_empty";
  } else if (!user.universityId) {
    title = t("social.campusAlmostReadyTitle");
    detail = t("social.campusWaitingDetail");
    icon = "school";
  }

  return (
    <div className="mx-auto max-w-xl rounded-2xl border border-outline-variant/30 bg-surface-container-lowest p-6 text-center shadow-[0_1px_3px_rgba(0,0,0,0.04)]">
      <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full border border-outline-variant/30 bg-surface-container-low">
        <span className="material-symbols-outlined text-[24px] text-primary" aria-hidden="true">{icon}</span>
      </div>
      <h2 className="mt-4 text-headline-md font-semibold text-primary">{title}</h2>
      <p className="mt-2 text-body-md text-secondary">{detail}</p>
      <div className="mt-5">
        <Link
          href="/app/user/profile"
          className="inline-flex h-10 items-center justify-center rounded-lg border border-primary bg-primary px-4 text-label-md font-semibold text-on-primary"
        >
          {t("social.goToProfile")}
        </Link>
      </div>
    </div>
  );
}

export function SocialUnavailableScreen({ message: _message }: { message?: string }) {
  const { t } = useLanguage();

  return (
    <section>
      <SocialPageHeader title={t("social.homeTitle")} subtitle={t("social.defaultCampus")} />
      <div className="mx-auto max-w-xl rounded-2xl border border-outline-variant/30 bg-surface-container-lowest p-6 text-center shadow-[0_1px_3px_rgba(0,0,0,0.04)]">
        <span className="material-symbols-outlined text-[28px] text-primary" aria-hidden="true">hourglass_empty</span>
        <h2 className="mt-3 text-headline-md font-semibold text-primary">{t("social.campusAlmostReadyTitle")}</h2>
        <p className="mt-2 text-body-md text-secondary">{t("social.campusAlmostReadyDetail")}</p>
      </div>
    </section>
  );
}

function PostComposer({
  compact = false,
  redirectAfterPost = false,
  user
}: {
  compact?: boolean;
  redirectAfterPost?: boolean;
  user: CurrentStudentContext;
}) {
  const { t } = useLanguage();
  const [state, formAction, isPending] = useActionState(createPostAction, EMPTY_FORM_STATE);
  const [body, setBody] = useState("");
  const authorName = user.displayName || user.name;
  const placeholder = compact ? t("social.postCompactPlaceholder") : t("social.postPlaceholder");
  const community = campusCommunityName(user, t("social.defaultCampus"));
  const statusMessage = state.message ? translatedMessage(t, state.message) : `${t("social.visibleToVerified")} ${community}.`;

  return (
    <form action={formAction} className="rounded-2xl border border-outline-variant/30 bg-surface-container-lowest p-4 shadow-[0_1px_3px_rgba(0,0,0,0.04)]">
      {redirectAfterPost ? <input type="hidden" name="redirectToHome" value="true" /> : null}
      <div className="flex gap-3">
        <div className="mt-1">
          <Avatar name={authorName} src={user.avatarUrl} inverse />
        </div>
        <div className="min-w-0 flex-1">
          {!compact ? (
            <div className="mb-3">
              <p className="text-label-md font-semibold text-primary">{authorName}</p>
              <p className="text-caption font-semibold text-secondary">{community}</p>
            </div>
          ) : null}
          <textarea
            name="body"
            rows={compact ? 3 : 5}
            maxLength={POST_MAX_LENGTH}
            value={body}
            onChange={(event) => setBody(event.target.value)}
            placeholder={placeholder}
            className={cn(
              "w-full resize-none rounded-2xl border border-transparent bg-surface-container-low px-4 py-3 text-body-md text-primary outline-none transition placeholder:text-secondary focus:border-primary",
              compact ? "min-h-20" : "min-h-36"
            )}
          />
          <div className="mt-3">
            <ImageUploadPicker name="imageFile" compact helpText={t("social.postPhotoHelp")} />
          </div>
          <div className="mt-3 flex flex-col gap-3 sm:flex-row sm:items-center">
            <label className="flex min-w-0 flex-1 items-center gap-2 rounded-full border border-outline-variant/30 bg-surface-container-lowest px-3 py-2">
              <span className="material-symbols-outlined text-[18px] text-secondary" aria-hidden="true">image</span>
              <span className="sr-only">{t("social.imageUrlLabel")}</span>
              <input
                name="imageUrl"
                type="url"
                placeholder={t("social.imageUrlPlaceholder")}
                className="h-6 min-w-0 flex-1 bg-transparent text-caption font-semibold text-primary outline-none placeholder:text-secondary"
              />
            </label>
            <div className="flex shrink-0 items-center justify-between gap-3 sm:justify-end">
              <span className="text-caption font-semibold text-secondary">{body.length}/{POST_MAX_LENGTH}</span>
              <Button type="submit" icon="send" disabled={isPending}>
                {isPending ? t("social.posting") : t("social.post")}
              </Button>
            </div>
          </div>
          <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
            <p className={cn("text-caption font-semibold", state.message ? (state.ok ? "text-primary" : "text-secondary") : "text-secondary")}>
              {statusMessage}
            </p>
          </div>
        </div>
      </div>
    </form>
  );
}

function ActionIconButton({
  icon,
  children,
  active,
  title
}: {
  icon: string;
  children?: React.ReactNode;
  active?: boolean;
  title: string;
}) {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      title={title}
      aria-label={title}
      disabled={pending}
      className={cn(
        "inline-flex h-9 items-center justify-center gap-1.5 rounded-full border border-transparent px-3 text-caption font-semibold transition-colors disabled:cursor-wait disabled:opacity-60",
        !children && "w-9 px-0",
        active ? "bg-primary text-on-primary" : "text-secondary hover:bg-surface-container-low hover:text-primary"
      )}
    >
      <span className={cn("material-symbols-outlined text-[18px]", active && "material-symbols-filled")} aria-hidden="true">{icon}</span>
      {children ? <span>{children}</span> : <span className="sr-only">{title}</span>}
    </button>
  );
}

function CommentForm({ postId }: { postId: string }) {
  const { t } = useLanguage();
  const [state, formAction, isPending] = useActionState(addPostCommentAction, EMPTY_FORM_STATE);

  return (
    <form action={formAction} className="mt-3 flex gap-2">
      <input type="hidden" name="postId" value={postId} />
      <input
        name="body"
        maxLength={500}
        placeholder={t("social.writeComment")}
        className="h-10 min-w-0 flex-1 rounded-lg border border-outline-variant/30 bg-surface-container-lowest px-3 text-label-md text-primary outline-none transition focus:border-primary"
      />
      <Button type="submit" size="sm" variant="secondary" icon="chat_bubble" disabled={isPending}>
        {isPending ? t("social.sending") : t("social.reply")}
      </Button>
      {state.message ? <p className="sr-only" role="status">{translatedMessage(t, state.message)}</p> : null}
    </form>
  );
}

function SocialPostCard({ post }: { post: SocialPost }) {
  const { language, t } = useLanguage();
  const [commentsOpen, setCommentsOpen] = useState(post.comments.length > 0);

  return (
    <article className="overflow-hidden rounded-2xl border border-outline-variant/30 bg-surface-container-lowest shadow-[0_1px_3px_rgba(0,0,0,0.04)]">
      <div className="px-4 py-3">
        <div className="flex items-start justify-between gap-3">
          <div className="flex min-w-0 gap-3">
            <Avatar name={post.authorName} src={post.authorAvatarUrl} />
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                {post.authorUsername ? (
                  <Link href={`/user/${post.authorUsername}`} className="truncate text-label-md font-semibold text-primary hover:underline">
                    {post.authorName}
                  </Link>
                ) : (
                  <h2 className="truncate text-label-md font-semibold text-primary">{post.authorName}</h2>
                )}
                <VerifiedBadge />
              </div>
              <p className="mt-0.5 text-caption font-medium text-secondary">
                {post.authorUsername ? `@${post.authorUsername} · ` : ""}
                {post.universityName} · {formatDateTime(post.createdAt, language)}
              </p>
            </div>
          </div>
          {post.ownPost ? (
            <form action={deletePostAction}>
              <input type="hidden" name="postId" value={post.id} />
              <ActionIconButton icon="delete" title={t("social.deletePost")} />
            </form>
          ) : (
            <form action={reportPostAction}>
              <input type="hidden" name="postId" value={post.id} />
              <input type="hidden" name="reason" value={t("social.reportedFromFeed")} />
              <ActionIconButton icon="flag" title={t("social.reportPost")}>
                {t("social.report")}
              </ActionIconButton>
            </form>
          )}
        </div>

        <p className="mt-2.5 whitespace-pre-wrap break-words text-body-md text-primary">{post.body}</p>

        {post.imageUrl ? (
          <div className="mt-3 overflow-hidden rounded-2xl border border-outline-variant/20 bg-surface-container-low">
            <img src={post.imageUrl} alt="" className="max-h-[520px] w-full object-cover" />
          </div>
        ) : null}

        <div className="mt-3 flex flex-wrap items-center gap-1 border-t border-outline-variant/20 pt-2">
          <form action={togglePostLikeAction}>
            <input type="hidden" name="postId" value={post.id} />
            <ActionIconButton icon="favorite" active={post.likedByCurrentUser} title={t("social.likePost")}>
              {post.likeCount}
            </ActionIconButton>
          </form>
          <button
            type="button"
            onClick={() => setCommentsOpen((open) => !open)}
            className="inline-flex h-9 items-center gap-1.5 rounded-full border border-transparent px-3 text-caption font-semibold text-secondary transition-colors hover:bg-surface-container-low hover:text-primary"
          >
            <span className="material-symbols-outlined text-[18px]" aria-hidden="true">mode_comment</span>
            <span>{post.commentCount}</span>
          </button>
          <button
            type="button"
            className="inline-flex h-9 items-center gap-1.5 rounded-full border border-transparent px-3 text-caption font-semibold text-secondary transition-colors hover:bg-surface-container-low hover:text-primary"
            title={t("social.share")}
          >
            <span className="material-symbols-outlined text-[18px]" aria-hidden="true">ios_share</span>
            <span>{t("social.share")}</span>
          </button>
        </div>

        {commentsOpen ? (
          <div className="mt-3 border-t border-outline-variant/20 pt-3">
            <div className="space-y-3">
              {post.comments.map((comment) => (
                <div key={comment.id} className="rounded-2xl bg-surface-container-low px-3 py-2">
                  <div className="flex gap-2">
                    <Avatar name={comment.authorName} src={comment.authorAvatarUrl} size="sm" />
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        {comment.authorUsername ? (
                          <Link href={`/user/${comment.authorUsername}`} className="text-caption font-semibold text-primary hover:underline">
                            {comment.authorName}
                          </Link>
                        ) : (
                          <p className="text-caption font-semibold text-primary">{comment.authorName}</p>
                        )}
                        <p className="text-caption text-secondary">
                          {comment.authorUsername ? `@${comment.authorUsername} · ` : ""}
                          {formatDateTime(comment.createdAt, language)}
                        </p>
                      </div>
                      <p className="mt-1 whitespace-pre-wrap break-words text-label-md text-primary">{comment.body}</p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
            <CommentForm postId={post.id} />
          </div>
        ) : null}
      </div>
    </article>
  );
}

function FeedList({
  posts,
  emptyTitle,
  emptyDescription,
  showCreateAction = false
}: {
  posts: SocialPost[];
  emptyTitle?: string;
  emptyDescription?: string;
  showCreateAction?: boolean;
}) {
  const { t } = useLanguage();
  const title = emptyTitle || t("social.emptyFirstPostTitle");
  const description = emptyDescription || t("social.emptyFirstPostDescription");

  if (!posts.length) {
    return (
      <div className="rounded-2xl border border-outline-variant/30 bg-surface-container-lowest p-6 text-center shadow-[0_1px_3px_rgba(0,0,0,0.04)]">
        <span className="material-symbols-outlined text-[28px] text-primary" aria-hidden="true">forum</span>
        <h2 className="mt-3 text-headline-md font-semibold text-primary">{title}</h2>
        <p className="mt-2 text-body-md text-secondary">{description}</p>
        {showCreateAction ? (
          <Link
            href="/app/user/create"
            className="mt-5 inline-flex h-10 items-center justify-center gap-2 rounded-lg border border-primary bg-primary px-4 text-label-md font-semibold text-on-primary"
          >
            <span className="material-symbols-outlined text-[18px]" aria-hidden="true">add</span>
            {t("social.createPost")}
          </Link>
        ) : null}
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {posts.map((post) => (
        <SocialPostCard key={post.id} post={post} />
      ))}
    </div>
  );
}

export function HomeFeedScreen({ user, posts }: { user: CurrentStudentContext | null; posts: SocialPost[] }) {
  const { t } = useLanguage();
  const universityLabel = campusCommunityName(user, t("social.defaultCampus"));

  return (
    <section>
      <SocialPageHeader
        title={t("social.homeTitle")}
        subtitle={universityLabel}
      />
      {isVerifiedStudent(user) ? (
        <div className="mx-auto grid max-w-xl gap-3">
          <PostComposer compact user={user} />
          <FeedList
            posts={posts}
            emptyTitle={t("social.emptyFirstPostTitle")}
            emptyDescription={t("social.emptyHomeDescription")}
            showCreateAction
          />
        </div>
      ) : (
        <VerificationGate user={user} />
      )}
    </section>
  );
}

const exploreFeatureCards: ReadonlyArray<{
  icon: string;
  titleKey: Parameters<ReturnType<typeof useLanguage>["t"]>[0];
  descriptionKey: Parameters<ReturnType<typeof useLanguage>["t"]>[0];
  imageUrl: string;
}> = [
  {
    icon: "home_work",
    titleKey: "social.featureRoommateTitle",
    descriptionKey: "social.featureRoommateDescription",
    imageUrl: "https://images.unsplash.com/photo-1522202176988-66273c2fd55f?auto=format&fit=crop&w=1400&q=82"
  },
  {
    icon: "favorite",
    titleKey: "social.featureMatchTitle",
    descriptionKey: "social.featureMatchDescription",
    imageUrl: "https://images.unsplash.com/photo-1529333166437-7750a6dd5a70?auto=format&fit=crop&w=1400&q=82"
  },
  {
    icon: "event_available",
    titleKey: "social.featureEventsTitle",
    descriptionKey: "social.featureEventsDescription",
    imageUrl: "https://images.unsplash.com/photo-1470229722913-7c0e2dbbafd3?auto=format&fit=crop&w=1400&q=82"
  },
  {
    icon: "local_mall",
    titleKey: "social.featureMarketplaceTitle",
    descriptionKey: "social.featureMarketplaceDescription",
    imageUrl: "https://images.unsplash.com/photo-1523275335684-37898b6baf30?auto=format&fit=crop&w=1400&q=82"
  }
];

function ExploreFeatureCard({
  icon,
  titleKey,
  descriptionKey,
  imageUrl
}: {
  icon: string;
  titleKey: Parameters<ReturnType<typeof useLanguage>["t"]>[0];
  descriptionKey: Parameters<ReturnType<typeof useLanguage>["t"]>[0];
  imageUrl: string;
}) {
  const { t } = useLanguage();
  const title = t(titleKey);
  const description = t(descriptionKey);

  return (
    <article className="group relative h-36 overflow-hidden rounded-[1.65rem] bg-primary text-on-primary shadow-[0_8px_24px_rgba(0,0,0,0.16)] sm:h-[220px]">
      <img
        src={imageUrl}
        alt=""
        className="absolute inset-0 h-full w-full object-cover transition duration-500 group-hover:scale-[1.03]"
        loading="lazy"
      />
      <div className="absolute inset-0 bg-[linear-gradient(90deg,rgba(0,0,0,0.78)_0%,rgba(0,0,0,0.48)_38%,rgba(0,0,0,0.08)_100%)]" />
      <div className="absolute inset-x-0 bottom-0 h-2/3 bg-gradient-to-t from-black/70 via-black/30 to-transparent" />

      <div className="relative flex h-full flex-col justify-between p-5 sm:p-6">
        <span className="flex h-14 w-14 items-center justify-center rounded-full bg-white text-primary shadow-[0_8px_20px_rgba(0,0,0,0.16)] sm:h-[76px] sm:w-[76px]">
          <span className="material-symbols-outlined text-[29px] sm:text-[38px]" aria-hidden="true">{icon}</span>
        </span>

        <div className="min-w-0 pr-20 sm:pr-28">
          <h2 className="whitespace-nowrap text-[24px] font-bold leading-[1.05] tracking-normal text-white sm:text-[32px] sm:leading-[1.08]">{title}</h2>
          <p className="mt-1.5 max-w-[16rem] text-[16px] font-semibold leading-[1.18] text-white sm:mt-2 sm:text-[18px] sm:leading-[1.25]">
            {description}
          </p>
        </div>
        <span className="absolute bottom-5 right-5 inline-flex h-10 items-center justify-center rounded-2xl border border-white/60 bg-white/90 px-5 text-label-md font-bold text-primary shadow-[inset_0_0_0_1px_rgba(0,0,0,0.12),0_8px_18px_rgba(0,0,0,0.20)] backdrop-blur sm:h-11 sm:px-6 sm:text-label-lg">
          {t("social.soon")}
        </span>
      </div>
    </article>
  );
}

export function ExploreScreen({ user, posts }: { user: CurrentStudentContext | null; posts: SocialPost[] }) {
  const { t } = useLanguage();

  return (
    <section>
      <SocialPageHeader title={t("social.exploreTitle")} subtitle={`${campusCommunityName(user, t("social.defaultCampus"))} ${t("social.launchpad")}`} />
      {isVerifiedStudent(user) ? (
        <div className="mx-auto max-w-3xl space-y-6">
          <div className="grid gap-3 sm:gap-4">
            {exploreFeatureCards.map((card) => (
              <ExploreFeatureCard key={card.titleKey} {...card} />
            ))}
          </div>
          <div>
            <div className="mb-3 flex items-center justify-between gap-3">
              <h2 className="text-headline-md font-semibold text-primary">{t("social.campusPosts")}</h2>
              <Badge tone="muted">{posts.length} {t("social.postsCount")}</Badge>
            </div>
            <FeedList
              posts={posts}
              emptyTitle={t("social.noTrendsTitle")}
              emptyDescription={t("social.noTrendsDescription")}
            />
          </div>
        </div>
      ) : (
        <VerificationGate user={user} />
      )}
    </section>
  );
}

export function CreatePostScreen({ user }: { user: CurrentStudentContext | null }) {
  const { t } = useLanguage();

  return (
    <section>
      <SocialPageHeader title={t("social.createPostTitle")} subtitle={`${t("social.shareWith")} ${campusCommunityName(user, t("social.defaultCampus"))}`} />
      {isVerifiedStudent(user) ? (
        <div className="mx-auto max-w-2xl">
          <PostComposer user={user} redirectAfterPost />
        </div>
      ) : (
        <VerificationGate user={user} />
      )}
    </section>
  );
}

export function ActivityScreen({
  user,
  items
}: {
  user: CurrentStudentContext | null;
  items: SocialActivityItem[];
}) {
  const { language, t } = useLanguage();

  return (
    <section>
      <SocialPageHeader title={t("social.activityTitle")} subtitle={t("social.activitySubtitle")} />
      {isVerifiedStudent(user) ? (
        <div className="mx-auto max-w-3xl space-y-3">
          {items.length ? items.map((item) => (
            <div key={item.id} className="rounded-2xl border border-outline-variant/30 bg-surface-container-lowest px-4 py-3 shadow-[0_1px_3px_rgba(0,0,0,0.04)]">
              <div className="flex gap-3">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-outline-variant/30 bg-surface-container-low">
                  <span className="material-symbols-outlined text-[20px] text-primary" aria-hidden="true">
                    {item.type === "like" ? "favorite" : item.type === "follow" ? "person_add" : "mode_comment"}
                  </span>
                </div>
                <div className="min-w-0">
                  <p className="text-label-md font-semibold text-primary">
                    {item.actorName} {item.type === "like" ? t("social.likedYourPost") : item.type === "follow" ? t("social.followedYou") : t("social.commentedOnPost")}
                  </p>
                  {item.actorUsername && item.type === "follow" ? (
                    <p className="mt-1 text-body-sm font-semibold text-secondary">@{item.actorUsername}</p>
                  ) : null}
                  {item.type !== "follow" ? (
                    <p className="mt-1 break-words text-body-sm text-secondary">
                      {item.commentBody || item.postPreview}
                    </p>
                  ) : null}
                  <p className="mt-2 text-caption text-secondary">{formatDateTime(item.createdAt, language)}</p>
                </div>
              </div>
            </div>
          )) : (
            <div className="rounded-2xl border border-outline-variant/30 bg-surface-container-lowest p-6 text-center shadow-[0_1px_3px_rgba(0,0,0,0.04)]">
              <span className="material-symbols-outlined text-[28px] text-primary" aria-hidden="true">notifications</span>
              <h2 className="mt-3 text-headline-md font-semibold text-primary">{t("social.noActivityTitle")}</h2>
              <p className="mt-2 text-body-md text-secondary">{t("social.noActivityDescription")}</p>
            </div>
          )}
        </div>
      ) : (
        <VerificationGate user={user} />
      )}
    </section>
  );
}

function LanguageSettings() {
  const router = useRouter();
  const { language, setLanguage, t } = useLanguage();
  const [selectedLanguage, setSelectedLanguage] = useState(language);
  const [message, setMessage] = useState("");
  const [isPending, startTransition] = useTransition();

  useEffect(() => {
    setSelectedLanguage(language);
  }, [language]);

  function changeLanguage(locale: Language) {
    const previousLanguage = language;
    setMessage("");
    setSelectedLanguage(locale);
    setLanguage(locale);

    startTransition(async () => {
      try {
        await updateLanguagePreference(locale);
        setMessage(t("social.languageSaved"));
        router.refresh();
      } catch {
        setSelectedLanguage(previousLanguage);
        setLanguage(previousLanguage);
        setMessage(t("social.languageFailed"));
      }
    });
  }

  return (
    <div className="premium-card p-5">
      <label className="block text-label-lg font-semibold text-primary" htmlFor="profile-language">
        {t("common.language")}
      </label>
      <select
        id="profile-language"
        value={selectedLanguage}
        disabled={isPending}
        onChange={(event) => changeLanguage(event.target.value as Language)}
        className="mt-4 h-11 w-full rounded-lg border border-outline-variant/30 bg-surface-container-lowest px-3 text-label-md text-primary outline-none transition focus:border-primary disabled:cursor-wait disabled:opacity-60"
      >
        {LANGUAGE_OPTIONS.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
      {message ? <p className="mt-3 text-caption font-semibold text-secondary" role="status">{message}</p> : null}
    </div>
  );
}

function LogoutCard({ className }: { className?: string }) {
  const router = useRouter();
  const { t } = useLanguage();
  const [pending, startTransition] = useTransition();

  function logout() {
    startTransition(async () => {
      await fetch("/api/auth/logout", { method: "POST" }).catch(() => undefined);
      router.push("/login");
    });
  }

  return (
    <div className={cn("premium-card p-5", className)}>
      <div className="flex items-center justify-between gap-4">
        <div>
          <h2 className="text-label-lg font-semibold text-primary">{t("social.account")}</h2>
          <p className="mt-1 text-body-sm text-secondary">{t("social.session")}</p>
        </div>
        <Button variant="secondary" icon="logout" disabled={pending} onClick={logout}>
          {pending ? t("social.loggingOut") : t("social.logOut")}
        </Button>
      </div>
    </div>
  );
}

function AccountDetailsCard({ user }: { user: CurrentStudentContext }) {
  const { t } = useLanguage();

  return (
    <div className="premium-card p-5">
      <h2 className="text-label-lg font-semibold text-primary">{t("social.accountDetails")}</h2>
      <div className="mt-4 space-y-3 text-label-md">
        <div className="flex items-center justify-between gap-3">
          <span className="text-secondary">{t("common.email")}</span>
          <span className="min-w-0 break-words text-right font-semibold text-primary">{user.email}</span>
        </div>
        <div className="flex items-center justify-between gap-3">
          <span className="text-secondary">{t("social.university")}</span>
          <span className="text-right font-semibold text-primary">{user.universityName || user.legacyUniversityName || t("social.notAssigned")}</span>
        </div>
      </div>
    </div>
  );
}

function SettingsSaveButton() {
  const { t } = useLanguage();
  const { pending } = useFormStatus();
  return (
    <Button type="submit" icon="check" disabled={pending}>
      {pending ? t("social.saving") : t("social.saveChanges")}
    </Button>
  );
}

export function ProfileSettingsScreen({ user }: { user: CurrentStudentContext | null }) {
  const { t } = useLanguage();
  const [state, formAction] = useActionState(updateProfileSettingsAction, EMPTY_PROFILE_SETTINGS_STATE);
  const profileName = user?.displayName || user?.name || t("social.defaultStudentName");
  const formMessage = state.message ? translatedMessage(t, state.message) : t("social.changesApply");

  return (
    <section>
      <ScreenHeader title={t("social.settingsTitle")} description={t("social.settingsDescription")} />
      {user ? (
        <div className="mx-auto grid max-w-5xl gap-5 xl:grid-cols-[minmax(0,1fr)_340px]">
          <form action={formAction} encType="multipart/form-data" className="premium-card overflow-hidden p-0">
            <div className="border-b border-outline-variant/20 p-5">
              <div className="flex flex-wrap items-center gap-4">
                <Avatar name={profileName} src={user.avatarUrl} size="xl" inverse />
                <div className="min-w-0">
                  <p className="text-caption font-semibold uppercase text-secondary">{t("social.profilePhoto")}</p>
                  <h2 className="mt-1 break-words text-headline-md font-semibold text-primary">{profileName}</h2>
                  <p className="mt-1 text-body-md font-semibold text-secondary">
                    {user.username ? `@${user.username}` : t("social.usernamePending")}
                  </p>
                </div>
              </div>
              <div className="mt-4">
                <ImageUploadPicker name="avatar" currentUrl={user.avatarUrl} capture="user" helpText={t("social.avatarPhotoHelp")} />
              </div>
            </div>

            <div className="grid gap-4 p-5">
              <label className="block">
                <span className="mb-2 block text-caption font-semibold uppercase text-secondary">{t("social.displayName")}</span>
                <input
                  name="displayName"
                  defaultValue={user.displayName || user.name}
                  maxLength={80}
                  className="h-11 w-full rounded-lg border border-outline-variant/30 bg-surface-container-lowest px-4 text-label-md text-primary outline-none transition focus:border-primary"
                />
              </label>

              <label className="block">
                <span className="mb-2 block text-caption font-semibold uppercase text-secondary">{t("social.username")}</span>
                <div className="flex h-11 items-center rounded-lg border border-outline-variant/30 bg-surface-container-lowest focus-within:border-primary">
                  <span className="pl-4 text-label-md font-semibold text-secondary">@</span>
                  <input
                    name="username"
                    defaultValue={user.username || ""}
                    required
                    minLength={3}
                    maxLength={30}
                    pattern="[a-z0-9_][a-z0-9_.]*[a-z0-9_]"
                    className="h-full min-w-0 flex-1 bg-transparent px-1 pr-4 text-label-md text-primary outline-none"
                  />
                </div>
              </label>

              <label className="block">
                <span className="mb-2 block text-caption font-semibold uppercase text-secondary">{t("social.bio")}</span>
                <textarea
                  name="bio"
                  defaultValue={user.bio || ""}
                  rows={4}
                  maxLength={240}
                  className="min-h-28 w-full resize-none rounded-lg border border-outline-variant/30 bg-surface-container-lowest px-4 py-3 text-label-md text-primary outline-none transition focus:border-primary"
                />
              </label>

              <div className="flex flex-wrap items-center justify-between gap-3 border-t border-outline-variant/20 pt-4">
                <p className={cn("text-caption font-semibold", state.message ? (state.ok ? "text-primary" : "text-secondary") : "text-secondary")}>
                  {formMessage}
                </p>
                <SettingsSaveButton />
              </div>
            </div>
          </form>

          <aside className="space-y-5">
            <AccountDetailsCard user={user} />
            <LanguageSettings />
            <LogoutCard className="md:hidden" />
          </aside>
        </div>
      ) : (
        <VerificationGate user={user} />
      )}
    </section>
  );
}

function FollowSubmitButton({ isFollowing }: { isFollowing: boolean }) {
  const { t } = useLanguage();
  const { pending } = useFormStatus();
  return (
    <Button type="submit" variant={isFollowing ? "secondary" : "primary"} icon={isFollowing ? "person_remove" : "person_add"} disabled={pending}>
      {pending ? t("social.updating") : isFollowing ? t("social.unfollow") : t("social.follow")}
    </Button>
  );
}

export function PublicProfileScreen({ profile }: { profile: PublicStudentProfile }) {
  const { t } = useLanguage();

  return (
    <section className="mx-auto min-h-dvh max-w-4xl px-margin-mobile py-6 md:px-margin-tablet">
      <ScreenHeader
        title={profile.displayName}
        description={`@${profile.username}`}
        action={
          <Link
            href="/app/user/home"
            className="inline-flex h-10 items-center justify-center gap-2 rounded-lg border border-outline-variant/30 bg-surface-container-lowest px-4 text-label-md font-semibold text-primary transition-colors hover:bg-surface-container-low"
          >
            <span className="material-symbols-outlined text-[18px]" aria-hidden="true">arrow_back</span>
            {t("social.homeTitle")}
          </Link>
        }
      />

      <div className="space-y-5">
        <div className="premium-card p-5">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div className="flex min-w-0 gap-4">
              <Avatar name={profile.displayName} src={profile.avatarUrl} size="xl" inverse />
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <h1 className="break-words text-headline-md font-semibold text-primary">{profile.displayName}</h1>
                  <VerifiedBadge />
                </div>
                <p className="mt-1 break-words text-body-md font-semibold text-secondary">@{profile.username}</p>
                <p className="mt-2 text-label-md font-semibold text-primary">{profile.universityName}</p>
                {profile.bio ? <p className="mt-3 max-w-2xl whitespace-pre-wrap break-words text-body-md text-primary">{profile.bio}</p> : null}
              </div>
            </div>

            {!profile.isOwnProfile ? (
              <form action={toggleFollowAction}>
                <input type="hidden" name="username" value={profile.username} />
                <FollowSubmitButton isFollowing={profile.isFollowing} />
              </form>
            ) : (
              <Link
                href="/app/user/settings"
                className="inline-flex h-11 items-center justify-center gap-2 rounded-lg border border-outline-variant/30 bg-surface-container-lowest px-4 text-label-md font-semibold text-primary transition-colors hover:bg-surface-container-low"
              >
                <span className="material-symbols-outlined text-[18px]" aria-hidden="true">settings</span>
                {t("social.settingsTitle")}
              </Link>
            )}
          </div>
        </div>

        <div className="grid gap-3 sm:grid-cols-3">
          <div className="premium-card p-4">
            <p className="text-caption font-semibold uppercase text-secondary">{t("social.posts")}</p>
            <p className="mt-2 text-headline-md font-semibold text-primary">{profile.postsCount}</p>
          </div>
          <div className="premium-card p-4">
            <p className="text-caption font-semibold uppercase text-secondary">{t("social.followers")}</p>
            <p className="mt-2 text-headline-md font-semibold text-primary">{profile.followerCount}</p>
          </div>
          <div className="premium-card p-4">
            <p className="text-caption font-semibold uppercase text-secondary">{t("social.following")}</p>
            <p className="mt-2 text-headline-md font-semibold text-primary">{profile.followingCount}</p>
          </div>
        </div>

        <div>
          <div className="mb-3 flex items-center justify-between gap-3">
            <h2 className="text-headline-md font-semibold text-primary">{t("social.posts")}</h2>
            <Badge tone="muted">{profile.universitySlug || t("social.defaultCampus")}</Badge>
          </div>
          <FeedList
            posts={profile.posts}
            emptyTitle={t("social.noPostsYet")}
            emptyDescription={t("social.studentPostsEmpty")}
            showCreateAction={false}
          />
        </div>
      </div>
    </section>
  );
}

export function ProfileScreen({
  user,
  stats,
  device,
  posts
}: {
  user: CurrentStudentContext | null;
  stats: StudentProfileStats;
  device: DeviceType;
  posts: SocialPost[];
}) {
  const { t } = useLanguage();
  const verificationLabel = user?.studentStatus === "verified" ? t("social.verifiedStudent") : user?.studentStatus || t("social.notVerified");
  const profileName = user?.displayName || user?.name || t("social.defaultStudentName");
  const universityLabel = user?.universityName || user?.legacyUniversityName || t("social.universityNotAssigned");

  if (!user) {
    return (
      <section>
        <SocialPageHeader title={t("social.profileTitle")} subtitle={t("social.defaultCampus")} />
        <VerificationGate user={user} />
      </section>
    );
  }

  return (
    <section>
      <SocialPageHeader
        title={t("social.profileTitle")}
        subtitle={campusCommunityName(user, t("social.defaultCampus"))}
        action={
          <Link
            href="/app/user/settings"
            className="inline-flex h-10 items-center justify-center gap-2 rounded-lg border border-outline-variant/30 bg-surface-container-lowest px-4 text-label-md font-semibold text-primary transition-colors hover:bg-surface-container-low"
          >
            <span className="material-symbols-outlined text-[18px]" aria-hidden="true">settings</span>
            {t("social.settingsTitle")}
          </Link>
        }
      />
      <div className="mx-auto grid w-full max-w-5xl gap-5 xl:grid-cols-[minmax(0,1fr)_340px]">
        <div className="space-y-5">
          <div className="rounded-2xl border border-outline-variant/30 bg-surface-container-lowest p-5 shadow-[0_1px_3px_rgba(0,0,0,0.04)]">
            <div className="flex flex-col items-start gap-4 sm:flex-row">
              <Avatar name={profileName} src={user?.avatarUrl} size="xl" inverse />
              <div className="w-full min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <h2 className="break-words text-title-lg font-semibold text-primary sm:text-headline-md">{profileName}</h2>
                  {user.studentStatus === "verified" ? <VerifiedBadge /> : <Badge tone="warning">{verificationLabel}</Badge>}
                </div>
                <p className="mt-1 break-words text-body-md font-semibold text-secondary">
                  {user?.username ? `@${user.username}` : t("social.usernamePending")}
                </p>
                <p className="mt-2 text-label-md font-semibold text-primary">{universityLabel}</p>
                {user?.bio ? <p className="mt-3 max-w-2xl whitespace-pre-wrap break-words text-body-md text-primary">{user.bio}</p> : null}
                <div className="mt-5 grid w-full max-w-md grid-cols-3 gap-2 border-y border-outline-variant/20 py-3 text-center sm:gap-4">
                  <div>
                    <p className="text-title-md font-semibold text-primary">{stats.postsCount}</p>
                    <p className="mt-0.5 text-caption font-semibold text-secondary">{t("social.posts")}</p>
                  </div>
                  <div>
                    <p className="text-title-md font-semibold text-primary">{stats.followerCount}</p>
                    <p className="mt-0.5 text-caption font-semibold text-secondary">{t("social.followers")}</p>
                  </div>
                  <div>
                    <p className="text-title-md font-semibold text-primary">{stats.followingCount}</p>
                    <p className="mt-0.5 text-caption font-semibold text-secondary">{t("social.following")}</p>
                  </div>
                </div>
                {user?.username ? (
                  <Link href={`/user/${user.username}`} className="mt-4 inline-flex h-9 items-center justify-center rounded-lg border border-outline-variant/30 px-3 text-caption font-semibold text-primary transition-colors hover:bg-surface-container-low">
                    {t("social.viewPublicProfile")}
                  </Link>
                ) : null}
              </div>
            </div>
          </div>

          <nav className="flex gap-2 overflow-x-auto rounded-full border border-outline-variant/30 bg-surface-container-lowest p-1 shadow-[0_1px_3px_rgba(0,0,0,0.04)]" aria-label={t("social.profileSections")}>
            {[
              { href: "#posts", icon: "forum", label: t("social.posts") },
              { href: "#student-pass", icon: "qr_code_2", label: t("social.studentPass") }
            ].map((item) => (
              <Link
                key={item.label}
                href={item.href}
                className="inline-flex h-9 shrink-0 items-center justify-center gap-2 rounded-full px-3 text-caption font-semibold text-primary transition-colors hover:bg-surface-container-low"
              >
                <span className="material-symbols-outlined text-[18px]" aria-hidden="true">{item.icon}</span>
                {item.label}
              </Link>
            ))}
          </nav>

          <section id="posts" className="scroll-mt-24">
            <div className="mb-3 flex items-center justify-between gap-3">
              <h2 className="text-headline-md font-semibold text-primary">{t("social.posts")}</h2>
              {user?.universitySlug ? <Badge tone="muted">{user.universitySlug}</Badge> : null}
            </div>
            <FeedList
              posts={posts}
              emptyTitle={t("social.noPostsYet")}
              emptyDescription={t("social.ownPostsEmpty")}
              showCreateAction={false}
            />
          </section>

          <section id="student-pass" className="scroll-mt-24 space-y-3">
            <div>
              <h2 className="text-headline-md font-semibold text-primary">{t("social.studentPass")}</h2>
              <p className="mt-1 text-body-sm text-secondary">{t("social.studentPassDescription")}</p>
            </div>
            <WalletPassSection device={device} showHeader={false} />
          </section>
        </div>

        <aside className="space-y-5">
          <div className="rounded-2xl border border-outline-variant/30 bg-surface-container-lowest p-5 shadow-[0_1px_3px_rgba(0,0,0,0.04)]">
            <h2 className="text-label-lg font-semibold text-primary">{t("social.campusVerification")}</h2>
            <p className="mt-1 text-body-sm text-secondary">{t("social.campusVerificationDetail")}</p>
            <div className="mt-4 space-y-3 text-label-md">
              <div className="flex items-center justify-between gap-3">
                <span className="text-secondary">{t("social.university")}</span>
                <span className="text-right font-semibold text-primary">{universityLabel}</span>
              </div>
              <div className="flex items-center justify-between gap-3">
                <span className="text-secondary">{t("social.status")}</span>
                <span className="font-semibold text-primary">{user.studentStatus === "verified" ? t("social.verified") : verificationLabel}</span>
              </div>
            </div>
          </div>
          <LogoutCard className="md:hidden" />
        </aside>
      </div>
    </section>
  );
}
