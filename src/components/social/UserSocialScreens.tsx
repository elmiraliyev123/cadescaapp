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

function formatCompactTime(value: string | null | undefined, language: Language = "en") {
  if (!value) return "";
  const date = new Date(value);
  const diffMs = Math.max(0, Date.now() - date.getTime());
  const minutes = Math.floor(diffMs / 60000);
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);

  if (minutes < 1) return "1m";
  if (minutes < 60) return `${minutes}m`;
  if (hours < 24) return `${hours}h`;
  if (days < 7) return `${days}d`;

  return new Intl.DateTimeFormat(DATE_LOCALES[language], { month: "short", day: "numeric" }).format(date);
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
    <div className="mx-auto mb-4 flex w-full max-w-4xl items-center justify-between gap-2 border-b border-outline-variant/20 pb-3">
      <div className="w-full min-w-0 max-w-full sm:flex-1">
        <h1 className="text-title-lg font-semibold tracking-[-0.01em] text-primary sm:text-headline-md">{title}</h1>
        {subtitle ? <p className="mt-0.5 break-words text-caption font-semibold text-secondary sm:text-body-sm">{subtitle}</p> : null}
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
      {src ? <img src={src} alt={name || t("social.defaultStudentName")} className="h-full w-full object-cover" /> : initials(name, t("social.defaultStudentName"))}
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
              <img src={previewUrl} alt={selectedName || t("social.photoSelected")} className="h-full w-full object-cover" />
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
        className="-my-3 inline-flex h-11 w-11 items-center justify-center rounded-full text-primary transition-colors hover:bg-surface-container-low focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/30"
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
          className="absolute left-0 top-9 z-20 w-64 rounded-xl border border-outline-variant/30 bg-surface-container-lowest p-3 text-caption font-semibold text-secondary shadow-soft"
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

function CompactComposer({ user }: { user: CurrentStudentContext }) {
  const { t } = useLanguage();
  const authorName = user.displayName || user.name;

  return (
    <Link
      href="/app/user/create"
      className="group flex min-h-16 items-center gap-3 border-b border-outline-variant/30 px-1 py-3 transition-colors hover:bg-surface-container-low/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/30"
      aria-label={t("social.createPost")}
    >
      <Avatar name={authorName} src={user.avatarUrl} inverse />
      <span className="min-w-0 flex-1 truncate text-body-sm text-secondary group-hover:text-primary">
        {t("social.postCompactPlaceholder")}
      </span>
      <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-secondary transition-colors group-hover:bg-surface-container-low group-hover:text-primary">
        <span className="material-symbols-outlined text-[20px]" aria-hidden="true">image</span>
      </span>
    </Link>
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
    <form action={formAction} className="rounded-xl border border-outline-variant/30 bg-surface-container-lowest p-3 sm:p-4">
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
            rows={compact ? 2 : 6}
            maxLength={POST_MAX_LENGTH}
            value={body}
            onChange={(event) => setBody(event.target.value)}
            placeholder={placeholder}
            className={cn(
              "w-full resize-none rounded-xl border border-transparent bg-surface-container-low px-3.5 py-3 text-body-md text-primary outline-none transition placeholder:text-secondary focus:border-primary",
              compact ? "min-h-16" : "min-h-40"
            )}
          />
          <div className="mt-3">
            <ImageUploadPicker name="imageFile" compact={compact} helpText={t("social.postPhotoHelp")} />
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
        "inline-flex h-11 items-center justify-center gap-1.5 rounded-full border border-transparent px-3 text-caption font-semibold transition-colors disabled:cursor-wait disabled:opacity-60",
        !children && "w-11 px-0",
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
        className="h-11 min-w-0 flex-1 rounded-lg border border-outline-variant/30 bg-surface-container-lowest px-3 text-label-md text-primary outline-none transition focus:border-primary"
      />
      <Button type="submit" size="sm" variant="secondary" icon="chat_bubble" disabled={isPending}>
        {isPending ? t("social.sending") : t("social.reply")}
      </Button>
      {state.message ? <p className="sr-only" role="status">{translatedMessage(t, state.message)}</p> : null}
    </form>
  );
}

function PostOverflowMenu({ post }: { post: SocialPost }) {
  const { t } = useLanguage();
  const [open, setOpen] = useState(false);

  return (
    <div className="relative shrink-0">
      <button
        type="button"
        className="flex h-11 w-11 items-center justify-center rounded-full text-secondary transition-colors hover:bg-surface-container-low hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/30"
        aria-label={t("common.actions")}
        aria-expanded={open}
        onClick={() => setOpen((value) => !value)}
      >
        <span className="material-symbols-outlined text-[20px]" aria-hidden="true">more_horiz</span>
      </button>
      {open ? (
        <div className="absolute right-0 top-12 z-20 min-w-36 overflow-hidden rounded-xl border border-outline-variant/40 bg-surface-container-lowest p-1 shadow-md">
          {post.ownPost ? (
            <form action={deletePostAction} onSubmit={() => setOpen(false)}>
              <input type="hidden" name="postId" value={post.id} />
              <button type="submit" className="flex min-h-11 w-full items-center gap-2 rounded-lg px-3 text-left text-label-md font-semibold text-primary transition-colors hover:bg-surface-container-low">
                <span className="material-symbols-outlined text-[18px]" aria-hidden="true">delete</span>
                {t("social.deletePost")}
              </button>
            </form>
          ) : (
            <form action={reportPostAction} onSubmit={() => setOpen(false)}>
              <input type="hidden" name="postId" value={post.id} />
              <input type="hidden" name="reason" value={t("social.reportedFromFeed")} />
              <button type="submit" className="flex min-h-11 w-full items-center gap-2 rounded-lg px-3 text-left text-label-md font-semibold text-primary transition-colors hover:bg-surface-container-low">
                <span className="material-symbols-outlined text-[18px]" aria-hidden="true">flag</span>
                {t("social.report")}
              </button>
            </form>
          )}
        </div>
      ) : null}
    </div>
  );
}

function SocialPostCard({ post }: { post: SocialPost }) {
  const { language, t } = useLanguage();
  const [commentsOpen, setCommentsOpen] = useState(false);

  return (
    <article className="overflow-hidden border-b border-outline-variant/30 bg-surface-container-lowest px-1 py-4 first:border-t sm:px-2">
      <div>
        <div className="flex items-start justify-between gap-3">
          <div className="flex min-w-0 gap-3">
            <Avatar name={post.authorName} src={post.authorAvatarUrl} size="sm" />
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                {post.authorUsername ? (
                  <Link href={`/user/${post.authorUsername}`} className="max-w-full break-words text-label-md font-semibold text-primary hover:underline">
                    {post.authorName}
                  </Link>
                ) : (
                  <h2 className="max-w-full break-words text-label-md font-semibold text-primary">{post.authorName}</h2>
                )}
                <VerifiedBadge />
              </div>
              <p className="mt-0.5 text-caption font-medium text-secondary">
                {post.authorUsername ? `@${post.authorUsername} · ` : ""}
                {post.universityName} · {formatCompactTime(post.createdAt, language)}
              </p>
            </div>
          </div>
          <PostOverflowMenu post={post} />
        </div>

        <p className="mt-3 whitespace-pre-wrap break-words text-body-md leading-6 text-primary">{post.body}</p>

        {post.imageUrl ? (
          <div className="mt-3 overflow-hidden rounded-xl border border-outline-variant/20 bg-surface-container-low">
            <img src={post.imageUrl} alt={post.body.slice(0, 120)} className="max-h-[520px] w-full object-contain" />
          </div>
        ) : null}

        <div className="mt-2 flex items-center gap-1 border-t border-outline-variant/20 pt-2">
          <form action={togglePostLikeAction}>
            <input type="hidden" name="postId" value={post.id} />
            <ActionIconButton icon="favorite" active={post.likedByCurrentUser} title={t("social.likePost")}>
              {post.likeCount}
            </ActionIconButton>
          </form>
          <button
            type="button"
            onClick={() => setCommentsOpen((open) => !open)}
            className="inline-flex h-11 items-center gap-1.5 rounded-full border border-transparent px-3 text-caption font-semibold text-secondary transition-colors hover:bg-surface-container-low hover:text-primary"
            aria-expanded={commentsOpen}
          >
            <span className="material-symbols-outlined text-[18px]" aria-hidden="true">mode_comment</span>
            <span>{post.commentCount}</span>
          </button>
          <button
            type="button"
            className="inline-flex h-11 items-center gap-1.5 rounded-full border border-transparent px-3 text-caption font-semibold text-secondary transition-colors hover:bg-surface-container-low hover:text-primary"
            title={t("social.share")}
            aria-label={t("social.share")}
          >
            <span className="material-symbols-outlined text-[18px]" aria-hidden="true">ios_share</span>
            <span className="hidden sm:inline">{t("social.share")}</span>
          </button>
        </div>

        {commentsOpen ? (
          <div className="mt-3 border-t border-outline-variant/20 pt-3">
            <div className="space-y-3">
              {post.comments.slice(0, 2).map((comment) => (
                <div key={comment.id} className="rounded-lg bg-surface-container-low px-3 py-2">
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
            {post.commentCount > post.comments.length || post.comments.length > 2 ? (
              <p className="mt-3 text-caption font-semibold text-secondary">{t("social.viewAllComments")}</p>
            ) : null}
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
      <div className="border-y border-outline-variant/30 bg-surface-container-lowest px-5 py-10 text-center">
        <span className="material-symbols-outlined text-[28px] text-primary" aria-hidden="true">forum</span>
        <h2 className="mt-3 text-title-lg font-semibold text-primary">{title}</h2>
        <p className="mx-auto mt-1.5 max-w-sm text-body-sm text-secondary">{description}</p>
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
    <div className="overflow-hidden bg-surface-container-lowest">
      {posts.map((post) => (
        <SocialPostCard key={post.id} post={post} />
      ))}
    </div>
  );
}

function SocialRightRail({ user, postCount }: { user: CurrentStudentContext; postCount?: number }) {
  const { t } = useLanguage();
  const community = campusCommunityName(user, t("social.defaultCampus"));

  return (
    <aside className="hidden space-y-4 xl:block">
      <div className="rounded-xl border border-outline-variant/30 bg-surface-container-lowest p-4">
        <div className="flex items-center justify-between gap-3">
          <h2 className="text-label-lg font-semibold text-primary">{t("social.campusSnapshot")}</h2>
          <span className="material-symbols-outlined text-[18px] text-secondary" aria-hidden="true">public</span>
        </div>
        <p className="mt-1 text-body-sm text-secondary">{community}</p>
        {typeof postCount === "number" ? (
          <p className="mt-4 text-caption font-semibold text-secondary">{postCount} {t("social.postsCount")}</p>
        ) : null}
      </div>
      <div className="rounded-xl border border-outline-variant/30 bg-surface-container-lowest p-4">
        <div className="flex items-center justify-between gap-3">
          <h2 className="text-label-lg font-semibold text-primary">{t("social.campusFeatures")}</h2>
          <span className="material-symbols-outlined text-[18px] text-secondary" aria-hidden="true">auto_awesome</span>
        </div>
        <div className="mt-3 space-y-3">
          {[
            ["home_work", t("social.featureRoommateTitle")],
            ["event_available", t("social.featureEventsTitle")],
            ["local_mall", t("social.featureMarketplaceTitle")]
          ].map(([icon, label]) => (
            <div key={label} className="flex items-center gap-2.5 text-body-sm font-semibold text-primary">
              <span className="material-symbols-outlined text-[18px] text-secondary" aria-hidden="true">{icon}</span>
              <span className="min-w-0 truncate">{label}</span>
            </div>
          ))}
        </div>
      </div>
    </aside>
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
        <div className="mx-auto grid w-full max-w-4xl gap-8 xl:grid-cols-[minmax(0,680px)_260px]">
          <div className="min-w-0">
            <CompactComposer user={user} />
            <FeedList
              posts={posts}
              emptyTitle={t("social.emptyFirstPostTitle")}
              emptyDescription={t("social.emptyHomeDescription")}
              showCreateAction
            />
          </div>
          <SocialRightRail user={user} postCount={posts.length} />
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
    <article className="group relative h-36 min-w-0 overflow-hidden rounded-xl bg-primary text-on-primary sm:h-40">
      <img
        src={imageUrl}
        alt=""
        className="absolute inset-0 h-full w-full object-cover transition duration-500 group-hover:scale-[1.03]"
        loading="lazy"
      />
      <div className="absolute inset-0 bg-[linear-gradient(90deg,rgba(0,0,0,0.82)_0%,rgba(0,0,0,0.42)_56%,rgba(0,0,0,0.08)_100%)]" />
      <div className="absolute inset-x-0 bottom-0 h-2/3 bg-gradient-to-t from-black/70 via-black/30 to-transparent" />

      <div className="relative flex h-full flex-col justify-between p-4">
        <span className="flex h-9 w-9 items-center justify-center rounded-full bg-white text-primary">
          <span className="material-symbols-outlined text-[20px]" aria-hidden="true">{icon}</span>
        </span>

        <div className="min-w-0 pr-16">
          <h2 className="truncate text-title-lg font-semibold leading-tight text-white">{title}</h2>
          <p className="mt-1 line-clamp-2 max-w-[16rem] text-caption font-semibold leading-4 text-white/90">
            {description}
          </p>
        </div>
        <span className="absolute bottom-4 right-4 inline-flex h-8 items-center justify-center rounded-lg border border-white/60 bg-white/90 px-3 text-caption font-semibold text-primary backdrop-blur">
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
        <div className="mx-auto grid w-full max-w-4xl gap-8 xl:grid-cols-[minmax(0,680px)_260px]">
          <div className="min-w-0 space-y-5">
            <div className="grid auto-cols-[minmax(220px,1fr)] grid-flow-col gap-3 overflow-x-auto pb-1 sm:auto-cols-[minmax(250px,1fr)]">
              {exploreFeatureCards.map((card) => (
                <ExploreFeatureCard key={card.titleKey} {...card} />
              ))}
            </div>
            <div>
              <div className="mb-2 flex items-center justify-between gap-3">
                <h2 className="text-title-lg font-semibold text-primary">{t("social.campusPosts")}</h2>
                <Badge tone="muted">{posts.length} {t("social.postsCount")}</Badge>
              </div>
              <FeedList
                posts={posts}
                emptyTitle={t("social.noTrendsTitle")}
                emptyDescription={t("social.noTrendsDescription")}
              />
            </div>
          </div>
          <SocialRightRail user={user} postCount={posts.length} />
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
      <SocialPageHeader
        title={t("social.createPostTitle")}
        subtitle={`${t("social.shareWith")} ${campusCommunityName(user, t("social.defaultCampus"))}`}
        action={
          <Link
            href="/app/user/home"
            className="inline-flex h-11 w-11 items-center justify-center rounded-full text-secondary transition-colors hover:bg-surface-container-low hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/30"
            aria-label={t("common.close")}
          >
            <span className="material-symbols-outlined text-[20px]" aria-hidden="true">close</span>
          </Link>
        }
      />
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

function activityGroup(createdAt: string) {
  const days = Math.floor(Math.max(0, Date.now() - new Date(createdAt).getTime()) / 86400000);
  if (days < 1) return "today" as const;
  if (days < 7) return "week" as const;
  return "earlier" as const;
}

export function ActivityScreen({
  user,
  items
}: {
  user: CurrentStudentContext | null;
  items: SocialActivityItem[];
}) {
  const { language, t } = useLanguage();
  const [readItems, setReadItems] = useState<Set<string>>(() => new Set());
  const unreadCount = Math.max(0, items.length - readItems.size);
  const groupedItems = items.reduce<Record<"today" | "week" | "earlier", SocialActivityItem[]>>((groups, item) => {
    groups[activityGroup(item.createdAt)].push(item);
    return groups;
  }, { today: [], week: [], earlier: [] });

  function markAsRead(id: string) {
    setReadItems((current) => new Set(current).add(id));
  }

  return (
    <section>
      <SocialPageHeader
        title={t("social.activityTitle")}
        subtitle={t("social.activitySubtitle")}
        action={unreadCount ? (
          <button
            type="button"
            className="inline-flex h-11 w-11 items-center justify-center gap-2 rounded-full text-caption font-semibold text-secondary transition-colors hover:bg-surface-container-low hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/30 sm:w-auto sm:rounded-lg sm:px-3"
            onClick={() => setReadItems(new Set(items.map((item) => item.id)))}
            aria-label={t("social.markAllRead")}
          >
            <span className="material-symbols-outlined text-[19px]" aria-hidden="true">done_all</span>
            <span className="hidden sm:inline">{t("social.markAllRead")}</span>
          </button>
        ) : null}
      />
      {isVerifiedStudent(user) ? (
        <div className="mx-auto max-w-3xl overflow-hidden border-y border-outline-variant/30 bg-surface-container-lowest">
          {items.length ? (Object.entries(groupedItems) as Array<["today" | "week" | "earlier", SocialActivityItem[]]>).map(([group, groupItems]) => groupItems.length ? (
            <section key={group} aria-labelledby={`activity-${group}`}>
              <h2 id={`activity-${group}`} className="border-b border-outline-variant/20 bg-surface-container-low px-3 py-2 text-caption font-semibold uppercase tracking-[0.08em] text-secondary sm:px-4">
                {group === "today" ? t("common.today") : group === "week" ? t("social.activityThisWeek") : t("social.activityEarlier")}
              </h2>
              {groupItems.map((item) => {
                const unread = !readItems.has(item.id);
                return (
                  <button
                    key={item.id}
                    type="button"
                    className={cn("flex min-h-[72px] w-full items-center gap-3 border-b border-outline-variant/20 px-3 py-3 text-left transition-colors last:border-b-0 hover:bg-surface-container-low/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-primary/30 sm:px-4", unread && "bg-surface-container-low/50")}
                    onClick={() => markAsRead(item.id)}
                  >
                    <div className="relative flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-full border border-outline-variant/30 bg-surface-container-low">
                      <Avatar name={item.actorName} size="sm" />
                      <span className="absolute bottom-0 right-0 flex h-4 w-4 items-center justify-center rounded-full border border-surface-container-lowest bg-primary text-on-primary">
                        <span className="material-symbols-outlined text-[10px]" aria-hidden="true">
                          {item.type === "like" ? "favorite" : item.type === "follow" ? "person_add" : "mode_comment"}
                        </span>
                      </span>
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-label-md font-semibold text-primary">
                        {item.actorName} {item.type === "like" ? t("social.likedYourPost") : item.type === "follow" ? t("social.followedYou") : t("social.commentedOnPost")}
                      </p>
                      {item.type !== "follow" ? (
                        <p className="mt-0.5 truncate text-body-sm text-secondary">{item.commentBody || item.postPreview}</p>
                      ) : null}
                    </div>
                    <span className="shrink-0 text-caption text-secondary">{formatCompactTime(item.createdAt, language)}</span>
                    {unread ? <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-primary" aria-label={t("social.unreadActivity")} /> : null}
                  </button>
                );
              })}
            </section>
          ) : null) : (
            <div className="px-6 py-12 text-center">
              <span className="material-symbols-outlined text-[28px] text-primary" aria-hidden="true">notifications</span>
              <h2 className="mt-3 text-title-lg font-semibold text-primary">{t("social.noActivityTitle")}</h2>
              <p className="mx-auto mt-1.5 max-w-sm text-body-sm text-secondary">{t("social.noActivityDescription")}</p>
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
        action={
          <Link
            href="/app/user/settings"
            className="inline-flex h-11 w-11 items-center justify-center rounded-full text-secondary transition-colors hover:bg-surface-container-low hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/30"
            aria-label={t("social.settingsTitle")}
          >
            <span className="material-symbols-outlined text-[20px]" aria-hidden="true">settings</span>
          </Link>
        }
      />
      <div className="mx-auto grid w-full max-w-4xl gap-8 xl:grid-cols-[minmax(0,680px)_260px]">
        <div className="min-w-0">
          <div className="border-b border-outline-variant/30 pb-5">
            <div className="flex items-start gap-4 sm:gap-6">
              <Avatar name={profileName} src={user.avatarUrl} size="lg" inverse />
              <div className="min-w-0 flex-1">
                <div className="grid grid-cols-3 gap-2 text-center sm:max-w-sm sm:gap-5">
                  <Link href={user.username ? `/user/${user.username}#posts` : "#posts"} className="rounded-lg py-1 transition-colors hover:bg-surface-container-low focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/30">
                    <p className="text-title-md font-semibold text-primary">{stats.postsCount}</p>
                    <p className="mt-0.5 text-caption text-secondary">{t("social.posts")}</p>
                  </Link>
                  <Link href={user.username ? `/user/${user.username}#followers` : "#followers"} className="rounded-lg py-1 transition-colors hover:bg-surface-container-low focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/30">
                    <p className="text-title-md font-semibold text-primary">{stats.followerCount}</p>
                    <p className="mt-0.5 text-caption text-secondary">{t("social.followers")}</p>
                  </Link>
                  <Link href={user.username ? `/user/${user.username}#following` : "#following"} className="rounded-lg py-1 transition-colors hover:bg-surface-container-low focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/30">
                    <p className="text-title-md font-semibold text-primary">{stats.followingCount}</p>
                    <p className="mt-0.5 text-caption text-secondary">{t("social.following")}</p>
                  </Link>
                </div>
              </div>
            </div>
            <div className="mt-4 min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <h2 className="break-words text-title-lg font-semibold text-primary">{profileName}</h2>
                {user.studentStatus === "verified" ? <VerifiedBadge /> : <Badge tone="warning">{verificationLabel}</Badge>}
              </div>
              <p className="mt-0.5 break-words text-body-sm font-semibold text-secondary">
                {user.username ? `@${user.username}` : t("social.usernamePending")}
              </p>
              <p className="mt-2 text-body-sm font-semibold text-primary">{universityLabel}</p>
              {user.bio ? <p className="mt-2 max-w-2xl whitespace-pre-wrap break-words text-body-sm text-primary">{user.bio}</p> : null}
              <div className="mt-4 flex flex-wrap gap-2">
                <Link href="/app/user/settings" className="inline-flex h-11 items-center justify-center gap-2 rounded-lg bg-primary px-3 text-caption font-semibold text-on-primary transition-opacity hover:opacity-85 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/30">
                  <span className="material-symbols-outlined text-[17px]" aria-hidden="true">edit</span>
                  {t("social.editProfile")}
                </Link>
                {user.username ? (
                  <Link href={`/user/${user.username}`} className="inline-flex h-11 items-center justify-center gap-2 rounded-lg border border-outline-variant/50 px-3 text-caption font-semibold text-primary transition-colors hover:bg-surface-container-low focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/30">
                    <span className="material-symbols-outlined text-[17px]" aria-hidden="true">ios_share</span>
                    {t("social.shareProfile")}
                  </Link>
                ) : null}
                <Link href="/app/user/pass" className="inline-flex h-11 items-center justify-center gap-2 rounded-lg border border-outline-variant/50 px-3 text-caption font-semibold text-primary transition-colors hover:bg-surface-container-low focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/30">
                  <span className="material-symbols-outlined text-[17px]" aria-hidden="true">qr_code_2</span>
                  {t("social.studentPass")}
                </Link>
              </div>
            </div>
          </div>

          <nav className="mt-3 flex border-b border-outline-variant/30" aria-label={t("social.profileSections")}>
            <Link href="#posts" className="inline-flex h-11 flex-1 items-center justify-center border-b-2 border-primary px-3 text-caption font-semibold text-primary">
              {t("social.posts")}
            </Link>
            <Link href="#student-pass" className="inline-flex h-11 flex-1 items-center justify-center border-b-2 border-transparent px-3 text-caption font-semibold text-secondary transition-colors hover:border-outline hover:text-primary">
              {t("social.studentPass")}
            </Link>
          </nav>

          <section id="posts" className="scroll-mt-24 pt-4">
            <div className="mb-2 flex items-center justify-between gap-3">
              <h2 className="text-title-lg font-semibold text-primary">{t("social.posts")}</h2>
              {user.universitySlug ? <Badge tone="muted">{user.universitySlug}</Badge> : null}
            </div>
            <FeedList
              posts={posts}
              emptyTitle={t("social.noPostsYet")}
              emptyDescription={t("social.ownPostsEmpty")}
              showCreateAction={false}
            />
          </section>

          <section id="student-pass" className="scroll-mt-24 border-t border-outline-variant/30 pt-5">
            <div className="mb-3">
              <h2 className="text-title-lg font-semibold text-primary">{t("social.studentPass")}</h2>
              <p className="mt-1 text-body-sm text-secondary">{t("social.studentPassDescription")}</p>
            </div>
            <WalletPassSection device={device} user={user} showHeader={false} />
          </section>
        </div>

        <aside className="hidden space-y-4 xl:block">
          <div className="rounded-xl border border-outline-variant/30 bg-surface-container-lowest p-4">
            <h2 className="text-label-lg font-semibold text-primary">{t("social.campusVerification")}</h2>
            <p className="mt-1 text-body-sm text-secondary">{t("social.campusVerificationDetail")}</p>
            <div className="mt-4 space-y-3 text-label-md">
              <div className="flex items-start justify-between gap-3">
                <span className="text-secondary">{t("social.university")}</span>
                <span className="max-w-[150px] text-right font-semibold text-primary">{universityLabel}</span>
              </div>
              <div className="flex items-center justify-between gap-3">
                <span className="text-secondary">{t("social.status")}</span>
                <span className="font-semibold text-primary">{user.studentStatus === "verified" ? t("social.verified") : verificationLabel}</span>
              </div>
            </div>
          </div>
        </aside>
      </div>
    </section>
  );
}
