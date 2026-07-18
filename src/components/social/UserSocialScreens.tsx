"use client";

import Link from "next/link";
import { useActionState, useEffect, useRef, useState, useTransition } from "react";
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
import type { DeviceType } from "@/components/screens/WalletPassSection";
import {
  FeatureBanner,
  NotificationRow,
  PostActionRow,
  PostAuthorRow,
  ProfileStats,
  SocialPageHeader,
  UserAvatar,
  VerifiedBadge
} from "@/components/social/SocialPrimitives";
import { Badge } from "@/components/ui/Badge";
import { Button, ButtonLink, IconButton, IconLink } from "@/components/ui/Button";
import { InlineError } from "@/components/ui/InlineError";
import { publicUrl } from "@/lib/appConfig";
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
const NOTIFICATION_READ_STORAGE_KEY = "cadesca:read-notifications";
const NOTIFICATION_COUNT_STORAGE_KEY = "cadesca:unread-notification-count";
const NOTIFICATION_COUNT_EVENT = "cadesca:notification-count";

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

function formatCompactTime(value: string | null | undefined, language: Language = "en") {
  if (!value) return "";
  const date = new Date(value);
  const diffMs = Math.max(0, Date.now() - date.getTime());
  const minutes = Math.floor(diffMs / 60000);
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);

  const units = {
    az: { minute: "dəq", hour: "saat", day: "gün" },
    en: { minute: "m", hour: "h", day: "d" },
    ru: { minute: "мин", hour: "ч", day: "д" },
    tr: { minute: "dk", hour: "sa", day: "g" }
  }[language];

  if (minutes < 1) return `1 ${units.minute}`;
  if (minutes < 60) return `${minutes} ${units.minute}`;
  if (hours < 24) return `${hours} ${units.hour}`;
  if (days < 7) return `${days} ${units.day}`;

  return new Intl.DateTimeFormat(DATE_LOCALES[language], { month: "short", day: "numeric" }).format(date);
}

function campusCommunityName(user: CurrentStudentContext | null | undefined, fallback = "Campus") {
  const university = user?.universityName || user?.legacyUniversityName;
  if (!university) return fallback;
  return university.replace(/ University$/i, "");
}

function translatedMessage(t: ReturnType<typeof useLanguage>["t"], message: string) {
  return message.startsWith("social.") ? t(message as Parameters<typeof t>[0]) : message;
}

function ImageUploadPicker({
  name,
  currentUrl,
  capture = "environment"
}: {
  name: string;
  currentUrl?: string | null;
  capture?: "user" | "environment";
}) {
  const { t } = useLanguage();
  const libraryInputRef = useRef<HTMLInputElement | null>(null);
  const cameraInputRef = useRef<HTMLInputElement | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(currentUrl || null);
  const [hasSelection, setHasSelection] = useState(false);

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
    setHasSelection(true);
  }

  function clearFile() {
    if (libraryInputRef.current) libraryInputRef.current.value = "";
    if (cameraInputRef.current) cameraInputRef.current.value = "";
    setHasSelection(false);
    setPreviewUrl((previous) => {
      if (previous?.startsWith("blob:")) URL.revokeObjectURL(previous);
      return currentUrl || null;
    });
  }

  return (
    <div className="flex flex-wrap items-center gap-3 border-t border-outline-variant/25 pt-4">
      <input
        ref={libraryInputRef}
        name={name}
        type="file"
        accept={NATIVE_IMAGE_ACCEPT}
        className="hidden"
        aria-label={t("social.addPhoto")}
        onChange={(event) => setFile(event.target.files?.[0], cameraInputRef.current)}
      />
      <input
        ref={cameraInputRef}
        name={name}
        type="file"
        accept={NATIVE_IMAGE_ACCEPT}
        capture={capture}
        className="hidden"
        aria-label={t("social.takePhoto")}
        onChange={(event) => setFile(event.target.files?.[0], libraryInputRef.current)}
      />

      <div className="flex min-w-0 flex-1 items-center gap-3">
          <div className="flex h-16 w-16 shrink-0 items-center justify-center overflow-hidden rounded-full border border-outline-variant/25 bg-surface-container-low">
            {previewUrl ? (
              <img src={previewUrl} alt={t("social.photoSelected")} className="h-full w-full object-cover" />
            ) : (
              <span className="material-symbols-outlined icon-media text-secondary" aria-hidden="true">add_photo_alternate</span>
            )}
          </div>
          <p className="min-w-0 truncate text-[14px] font-medium leading-5 text-primary">
            {previewUrl ? t("social.profilePhoto") : t("social.addPhoto")}
          </p>
      </div>

      <div className="flex flex-wrap gap-2">
          <Button type="button" size="sm" variant="secondary" icon="image" onClick={() => libraryInputRef.current?.click()}>
            {previewUrl ? t("social.replacePhoto") : t("social.addPhoto")}
          </Button>
          <Button type="button" size="sm" variant="ghost" icon="photo_camera" onClick={() => cameraInputRef.current?.click()}>
            {t("social.takePhoto")}
          </Button>
          {hasSelection ? (
            <Button type="button" size="sm" variant="ghost" icon="close" onClick={clearFile}>
              {t("social.removePhoto")}
            </Button>
          ) : null}
      </div>
    </div>
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
    <div className="mx-auto max-w-xl border-y border-outline-variant/30 bg-surface-container-lowest px-5 py-8 text-center">
      <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full border border-outline-variant/30 bg-surface-container-low">
        <span className="material-symbols-outlined icon-nav text-primary" aria-hidden="true">{icon}</span>
      </div>
      <h2 className="mt-4 text-social-section text-primary">{title}</h2>
      <p className="mx-auto mt-2 max-w-md text-[15px] font-normal leading-6 text-secondary">{detail}</p>
      <ButtonLink href="/app/user/profile" size="sm" className="mt-5">
        {t("social.goToProfile")}
      </ButtonLink>
    </div>
  );
}

export function SocialUnavailableScreen() {
  const { t } = useLanguage();

  return (
    <section>
      <SocialPageHeader title={t("social.pageUnavailableTitle")} />
      <div className="mx-auto max-w-xl border-y border-outline-variant/30 bg-surface-container-lowest px-5 py-8 text-center">
        <span className="material-symbols-outlined icon-empty text-primary" aria-hidden="true">error</span>
        <p className="mt-3 text-[15px] font-normal leading-6 text-secondary">{t("social.tryAgainLater")}</p>
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
      className="group flex h-[72px] items-center gap-3 border-b border-outline-variant/30 px-1 transition-colors hover:bg-surface-container-low/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/30 sm:px-3"
      aria-label={t("social.createPost")}
    >
      <UserAvatar name={authorName} src={user.avatarUrl} inverse />
      <span className="min-w-0 flex-1 truncate text-[15px] font-normal leading-5 text-secondary group-hover:text-primary">
        {t("social.postCompactPlaceholder")}
      </span>
      <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-secondary transition-colors group-hover:bg-surface-container-low group-hover:text-primary">
        <span className="material-symbols-outlined icon-action" aria-hidden="true">image</span>
      </span>
    </Link>
  );
}

function CreatePostComposer({ user }: { user: CurrentStudentContext }) {
  const { t } = useLanguage();
  const [state, formAction, isPending] = useActionState(createPostAction, EMPTY_FORM_STATE);
  const [body, setBody] = useState("");
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const libraryInputRef = useRef<HTMLInputElement | null>(null);
  const cameraInputRef = useRef<HTMLInputElement | null>(null);
  const authorName = user.displayName || user.name;
  const community = campusCommunityName(user, t("social.defaultCampus"));
  const canSubmit = Boolean(body.trim() || previewUrl);

  useEffect(() => () => {
    if (previewUrl?.startsWith("blob:")) URL.revokeObjectURL(previewUrl);
  }, [previewUrl]);

  function setFile(file: File | undefined, otherInput: HTMLInputElement | null) {
    if (!file) return;
    if (otherInput) otherInput.value = "";
    setPreviewUrl((previous) => {
      if (previous?.startsWith("blob:")) URL.revokeObjectURL(previous);
      return URL.createObjectURL(file);
    });
  }

  function removeFile() {
    if (libraryInputRef.current) libraryInputRef.current.value = "";
    if (cameraInputRef.current) cameraInputRef.current.value = "";
    setPreviewUrl((previous) => {
      if (previous?.startsWith("blob:")) URL.revokeObjectURL(previous);
      return null;
    });
  }

  return (
    <>
      <SocialPageHeader
        title={t("social.createPostTitle")}
        centered
        leadingAction={
          <IconLink
            href="/app/user/home"
            icon="arrow_back"
            label={t("common.close")}
          />
        }
        action={
          <Button
            type="submit"
            form="create-post-form"
            size="sm"
            disabled={!canSubmit || isPending}
            className="min-w-[72px]"
          >
            {isPending ? <span className="material-symbols-outlined icon-inline animate-spin" aria-hidden="true">progress_activity</span> : t("social.post")}
          </Button>
        }
      />

      <form id="create-post-form" action={formAction} className="mx-auto max-w-[680px] bg-surface-container-lowest">
        <input type="hidden" name="redirectToHome" value="true" />
        <input
          ref={libraryInputRef}
          name="imageFile"
          type="file"
          accept={NATIVE_IMAGE_ACCEPT}
          className="hidden"
          aria-label={t("social.addPhoto")}
          onChange={(event) => setFile(event.target.files?.[0], cameraInputRef.current)}
        />
        <input
          ref={cameraInputRef}
          name="imageFile"
          type="file"
          accept={NATIVE_IMAGE_ACCEPT}
          capture="environment"
          className="hidden"
          aria-label={t("social.takePhoto")}
          onChange={(event) => setFile(event.target.files?.[0], libraryInputRef.current)}
        />

        <div className="flex gap-3 px-1 py-3 sm:px-3">
          <UserAvatar name={authorName} src={user.avatarUrl} inverse />
          <div className="min-w-0 flex-1">
            <div className="flex min-w-0 items-center">
              <p className="truncate text-[15px] font-semibold leading-5 text-primary">{authorName}</p>
              {user.studentStatus === "verified" ? <VerifiedBadge /> : null}
            </div>
            <p className="mt-0.5 truncate text-[13px] font-normal leading-5 text-secondary">{community}</p>
            <textarea
              name="body"
              rows={7}
              maxLength={POST_MAX_LENGTH}
              value={body}
              onChange={(event) => setBody(event.target.value)}
              placeholder={t("social.postPlaceholder")}
              className="mt-3 min-h-44 w-full resize-none rounded-lg border-0 bg-transparent p-0 text-[17px] font-normal leading-6 text-primary outline-none transition-colors placeholder:text-secondary focus-visible:bg-surface-container-low/45 focus-visible:outline-none"
            />

            {previewUrl ? (
              <div className="relative mt-3 overflow-hidden rounded-xl border border-outline-variant/25 bg-surface-container-low">
                <img src={previewUrl} alt={t("social.photoSelected")} className="max-h-[520px] w-full object-contain" />
                <div className="absolute right-2 top-2 flex gap-1 rounded-lg bg-black/70 p-1 backdrop-blur">
                  <button type="button" className="inline-flex h-11 items-center gap-1 rounded-md px-3 text-[13px] font-semibold text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/70" onClick={() => libraryInputRef.current?.click()}>
                    <span className="material-symbols-outlined icon-inline" aria-hidden="true">edit</span>
                    {t("social.replacePhoto")}
                  </button>
                  <button type="button" className="inline-flex h-11 w-11 items-center justify-center rounded-md text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/70" onClick={removeFile} aria-label={t("social.removePhoto")}>
                    <span className="material-symbols-outlined icon-ui" aria-hidden="true">close</span>
                  </button>
                </div>
                {isPending ? (
                  <div className="absolute inset-0 flex items-center justify-center gap-2 bg-black/45 text-[14px] font-semibold text-white backdrop-blur-[1px]" role="status">
                    <span className="material-symbols-outlined icon-ui animate-spin" aria-hidden="true">progress_activity</span>
                    {t("social.posting")}
                  </div>
                ) : null}
              </div>
            ) : null}

            <InlineError message={state.message && !state.ok ? translatedMessage(t, state.message) : undefined} className="mt-3" />
          </div>
        </div>

        <div className="sticky bottom-[calc(76px+env(safe-area-inset-bottom))] flex min-h-14 items-center justify-between border-t border-outline-variant/25 bg-surface-container-lowest/95 px-1 backdrop-blur sm:px-3 md:bottom-0">
          <div className="flex items-center">
            <IconButton icon="image" label={t("social.addPhoto")} onClick={() => libraryInputRef.current?.click()} />
            <IconButton icon="photo_camera" label={t("social.takePhoto")} onClick={() => cameraInputRef.current?.click()} />
          </div>
          {body.length >= POST_MAX_LENGTH - 100 ? (
            <span className="text-[12px] font-normal leading-4 text-secondary">{body.length}/{POST_MAX_LENGTH}</span>
          ) : null}
        </div>
      </form>
    </>
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
        "inline-flex h-11 items-center justify-center gap-1.5 rounded-full border border-transparent px-2.5 text-[13px] font-normal leading-5 transition-colors disabled:cursor-wait disabled:opacity-60",
        !children && "w-11 px-0",
        active ? "text-primary" : "text-secondary hover:bg-surface-container-low hover:text-primary"
      )}
    >
      <span className={cn("material-symbols-outlined icon-action", active && "material-symbols-filled")} aria-hidden="true">{icon}</span>
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
        aria-label={t("social.writeComment")}
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
    <div
      className="relative shrink-0"
      onBlur={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget)) setOpen(false);
      }}
      onKeyDown={(event) => {
        if (event.key === "Escape") {
          setOpen(false);
          event.currentTarget.querySelector<HTMLButtonElement>("button")?.focus();
        }
      }}
    >
      <IconButton
        icon="more_horiz"
        label={t("common.actions")}
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={() => setOpen((value) => !value)}
      />
      {open ? (
        <div className="absolute right-0 top-12 z-20 min-w-36 overflow-hidden rounded-xl border border-outline-variant/40 bg-surface-container-lowest p-1 shadow-md" role="menu">
          {post.ownPost ? (
            <form action={deletePostAction} onSubmit={() => setOpen(false)}>
              <input type="hidden" name="postId" value={post.id} />
              <button type="submit" role="menuitem" className="flex min-h-11 w-full items-center gap-2 rounded-lg px-3 text-left text-label-md font-semibold text-primary transition-colors hover:bg-surface-container-low">
                <span className="material-symbols-outlined icon-inline" aria-hidden="true">delete</span>
                {t("social.deletePost")}
              </button>
            </form>
          ) : (
            <form action={reportPostAction} onSubmit={() => setOpen(false)}>
              <input type="hidden" name="postId" value={post.id} />
              <input type="hidden" name="reason" value={t("social.reportedFromFeed")} />
              <button type="submit" role="menuitem" className="flex min-h-11 w-full items-center gap-2 rounded-lg px-3 text-left text-label-md font-semibold text-primary transition-colors hover:bg-surface-container-low">
                <span className="material-symbols-outlined icon-inline" aria-hidden="true">flag</span>
                {t("social.report")}
              </button>
            </form>
          )}
        </div>
      ) : null}
    </div>
  );
}

function PostCard({ post }: { post: SocialPost }) {
  const { language, t } = useLanguage();
  const [commentsOpen, setCommentsOpen] = useState(false);
  const [shareStatus, setShareStatus] = useState("");
  const visibleComments = commentsOpen ? post.comments : post.comments.slice(0, 1);

  async function sharePost() {
    const url = `${publicUrl}/post/${post.id}`;
    try {
      if (navigator.share) {
        await navigator.share({ text: post.body || undefined, url });
      } else {
        await navigator.clipboard.writeText(url);
      }
      setShareStatus(t("social.linkCopied"));
    } catch {
      setShareStatus("");
    }
  }

  return (
    <article className="overflow-hidden border-b border-outline-variant/30 bg-surface-container-lowest px-1 py-4 first:border-t sm:px-3">
      <PostAuthorRow
        name={post.authorName}
        username={post.authorUsername}
        avatarUrl={post.authorAvatarUrl}
        href={post.authorUsername ? `/user/${post.authorUsername}` : undefined}
        timestamp={formatCompactTime(post.createdAt, language)}
        menu={<PostOverflowMenu post={post} />}
      />

      {post.body ? <p className="mt-3 whitespace-pre-wrap break-words text-[16px] font-normal leading-6 text-primary">{post.body}</p> : null}

      {post.imageUrl ? (
        <div className="mt-3 overflow-hidden rounded-xl border border-outline-variant/20 bg-surface-container-low">
          <img
            src={post.imageUrl}
            alt={t("social.postPhotoAlt").replace("{name}", post.authorName)}
            className="max-h-[520px] w-full object-contain"
          />
        </div>
      ) : null}

      <PostActionRow>
        <form action={togglePostLikeAction}>
          <input type="hidden" name="postId" value={post.id} />
          <ActionIconButton icon="favorite" active={post.likedByCurrentUser} title={t("social.likePost")}>
            {post.likeCount}
          </ActionIconButton>
        </form>
        <button
          type="button"
          onClick={() => setCommentsOpen((open) => !open)}
          className="inline-flex h-11 items-center gap-1.5 rounded-full border border-transparent px-2.5 text-[13px] font-normal leading-5 text-secondary transition-colors hover:bg-surface-container-low hover:text-primary"
          aria-expanded={commentsOpen}
          aria-label={t("social.writeComment")}
        >
          <span className="material-symbols-outlined icon-action" aria-hidden="true">mode_comment</span>
          <span>{post.commentCount}</span>
        </button>
        <button
          type="button"
          className="inline-flex h-11 w-11 items-center justify-center rounded-full border border-transparent text-secondary transition-colors hover:bg-surface-container-low hover:text-primary"
          title={t("social.share")}
          aria-label={t("social.share")}
          onClick={sharePost}
        >
          <span className="material-symbols-outlined icon-action" aria-hidden="true">ios_share</span>
        </button>
        <span className="sr-only" role="status">{shareStatus}</span>
      </PostActionRow>

      {visibleComments.length ? (
        <div className="space-y-2 border-t border-outline-variant/20 pt-3">
          {visibleComments.map((comment) => (
            <div key={comment.id} className="flex gap-2.5">
              <UserAvatar name={comment.authorName} src={comment.authorAvatarUrl} size="sm" />
              <div className="min-w-0 flex-1">
                <div className="flex min-w-0 items-center gap-1">
                  {comment.authorUsername ? (
                    <Link href={`/user/${comment.authorUsername}`} className="truncate text-[13px] font-semibold leading-5 text-primary hover:underline">{comment.authorName}</Link>
                  ) : (
                    <span className="truncate text-[13px] font-semibold leading-5 text-primary">{comment.authorName}</span>
                  )}
                  <VerifiedBadge />
                  <span className="shrink-0 text-[12px] font-normal leading-4 text-secondary">{formatCompactTime(comment.createdAt, language)}</span>
                </div>
                <p className="mt-0.5 whitespace-pre-wrap break-words text-[14px] font-normal leading-5 text-primary">{comment.body}</p>
              </div>
            </div>
          ))}
        </div>
      ) : null}

      {post.commentCount > 1 ? (
        <button type="button" className="mt-2 min-h-11 text-[13px] font-medium leading-5 text-secondary hover:text-primary" onClick={() => setCommentsOpen((open) => !open)}>
          {commentsOpen ? t("social.hideComments") : t("social.viewAllComments")}
        </button>
      ) : null}
      {commentsOpen ? <CommentForm postId={post.id} /> : null}
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

  if (!posts.length) {
    return (
      <div className="border-y border-outline-variant/30 bg-surface-container-lowest px-5 py-10 text-center">
        <span className="material-symbols-outlined icon-empty text-primary" aria-hidden="true">forum</span>
        <h2 className="mt-3 text-[20px] font-semibold leading-7 text-primary">{title}</h2>
        {emptyDescription ? (
          <p className="mx-auto mt-1.5 max-w-sm text-[14px] font-normal leading-5 text-secondary">{emptyDescription}</p>
        ) : null}
        {showCreateAction ? (
          <ButtonLink href="/app/user/create" icon="add" size="sm" className="mt-5">
            {t("social.createPost")}
          </ButtonLink>
        ) : null}
      </div>
    );
  }

  return (
    <div className="overflow-hidden bg-surface-container-lowest">
      {posts.map((post) => (
        <PostCard key={post.id} post={post} />
      ))}
    </div>
  );
}

function SocialRightRail({ user }: { user: CurrentStudentContext }) {
  const { t } = useLanguage();
  const community = campusCommunityName(user, t("social.defaultCampus"));

  return (
    <aside className="hidden space-y-4 xl:block">
      <div className="rounded-xl border border-outline-variant/30 bg-surface-container-lowest p-4">
        <div className="flex items-center justify-between gap-3">
          <h2 className="text-label-lg font-semibold text-primary">{t("social.campusSnapshot")}</h2>
          <span className="material-symbols-outlined icon-inline text-secondary" aria-hidden="true">public</span>
        </div>
        <p className="mt-1 text-[14px] font-normal leading-5 text-secondary">{community}</p>
      </div>
      <div className="rounded-xl border border-outline-variant/30 bg-surface-container-lowest p-4">
        <div className="flex items-center justify-between gap-3">
          <h2 className="text-[16px] font-semibold leading-6 text-primary">{t("social.campusFeatures")}</h2>
          <span className="material-symbols-outlined icon-inline text-secondary" aria-hidden="true">widgets</span>
        </div>
        <div className="mt-3 space-y-3">
          {[
            ["home_work", t("social.featureRoommateTitle")],
            ["event_available", t("social.featureEventsTitle")],
            ["local_mall", t("social.featureMarketplaceTitle")]
          ].map(([icon, label]) => (
            <div key={label} className="flex items-center gap-2.5 text-body-sm font-semibold text-primary">
              <span className="material-symbols-outlined icon-inline text-secondary" aria-hidden="true">{icon}</span>
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
        <div className="mx-auto grid w-full max-w-[984px] gap-6 xl:grid-cols-[minmax(0,680px)_280px]">
          <div className="min-w-0">
            <CompactComposer user={user} />
            <FeedList
              posts={posts}
              emptyTitle={t("social.emptyFirstPostTitle")}
              showCreateAction
            />
          </div>
          <SocialRightRail user={user} />
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
  href?: string;
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
    imageUrl: "https://images.unsplash.com/photo-1470229722913-7c0e2dbbafd3?auto=format&fit=crop&w=1400&q=82",
    href: "/app/user/events"
  },
  {
    icon: "local_mall",
    titleKey: "social.featureMarketplaceTitle",
    descriptionKey: "social.featureMarketplaceDescription",
    imageUrl: "https://images.unsplash.com/photo-1523275335684-37898b6baf30?auto=format&fit=crop&w=1400&q=82"
  }
];

export function ExploreScreen({ user, posts }: { user: CurrentStudentContext | null; posts: SocialPost[] }) {
  const { t } = useLanguage();

  return (
    <section>
      <SocialPageHeader title={t("social.exploreTitle")} subtitle={t("social.exploreSubtitle")} />
      {isVerifiedStudent(user) ? (
        <div className="mx-auto grid w-full max-w-[984px] gap-6 xl:grid-cols-[minmax(0,680px)_280px]">
          <div className="min-w-0 space-y-5">
            <div className="no-scrollbar -mx-4 flex snap-x snap-mandatory gap-3 overflow-x-auto px-4 pb-2 pr-8 [scroll-padding-inline:16px] sm:mx-0 sm:px-0 sm:pr-6">
              {exploreFeatureCards.map((card) => (
                <div key={card.titleKey} className="snap-start">
                  <FeatureBanner
                    icon={card.icon}
                    title={t(card.titleKey)}
                    description={t(card.descriptionKey)}
                    imageUrl={card.imageUrl}
                    status={card.href ? t("common.explore") : t("social.soon")}
                    href={card.href}
                  />
                </div>
              ))}
            </div>
            <div>
              <div className="mb-2">
                <h2 className="text-title-lg font-semibold text-primary">{t("social.campusPosts")}</h2>
              </div>
              <FeedList
                posts={posts}
                emptyTitle={t("social.noTrendsTitle")}
              />
            </div>
          </div>
          <SocialRightRail user={user} />
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
      {isVerifiedStudent(user) ? (
        <CreatePostComposer user={user} />
      ) : (
        <>
          <SocialPageHeader title={t("social.createPostTitle")} />
          <VerificationGate user={user} />
        </>
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
  const [readStateReady, setReadStateReady] = useState(false);
  const unreadCount = readStateReady ? items.filter((item) => !readItems.has(item.id)).length : 0;
  const groupedItems = items.reduce<Record<"today" | "week" | "earlier", SocialActivityItem[]>>((groups, item) => {
    groups[activityGroup(item.createdAt)].push(item);
    return groups;
  }, { today: [], week: [], earlier: [] });

  useEffect(() => {
    try {
      const stored = JSON.parse(window.localStorage.getItem(NOTIFICATION_READ_STORAGE_KEY) || "[]") as unknown;
      setReadItems(new Set(Array.isArray(stored) ? stored.filter((id): id is string => typeof id === "string") : []));
    } catch {
      setReadItems(new Set());
    }
    setReadStateReady(true);
  }, []);

  useEffect(() => {
    if (!readStateReady) return;
    const currentIds = new Set(items.map((item) => item.id));
    const currentReadItems = Array.from(readItems).filter((id) => currentIds.has(id));
    const count = items.filter((item) => !readItems.has(item.id)).length;
    window.localStorage.setItem(NOTIFICATION_READ_STORAGE_KEY, JSON.stringify(currentReadItems));
    window.localStorage.setItem(NOTIFICATION_COUNT_STORAGE_KEY, String(count));
    window.dispatchEvent(new CustomEvent(NOTIFICATION_COUNT_EVENT, { detail: { count } }));
  }, [items, readItems, readStateReady]);

  function markAsRead(id: string) {
    setReadItems((current) => new Set(current).add(id));
  }

  return (
    <section>
      <SocialPageHeader
        title={t("social.activityTitle")}
        action={unreadCount ? (
          <button
            type="button"
            className="inline-flex h-11 w-11 items-center justify-center gap-2 rounded-full text-caption font-semibold text-secondary transition-colors hover:bg-surface-container-low hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/30 sm:w-auto sm:rounded-lg sm:px-3"
            onClick={() => setReadItems(new Set(items.map((item) => item.id)))}
            aria-label={t("social.markAllRead")}
          >
            <span className="material-symbols-outlined icon-ui" aria-hidden="true">done_all</span>
            <span className="hidden sm:inline">{t("social.markAllRead")}</span>
          </button>
        ) : null}
      />
      {isVerifiedStudent(user) ? (
        <div className="mx-auto max-w-[680px] overflow-hidden border-y border-outline-variant/30 bg-surface-container-lowest">
          {items.length ? (Object.entries(groupedItems) as Array<["today" | "week" | "earlier", SocialActivityItem[]]>).map(([group, groupItems]) => groupItems.length ? (
            <section key={group} aria-labelledby={`activity-${group}`}>
              <h2 id={`activity-${group}`} className="border-b border-outline-variant/20 bg-surface-container-low px-3 py-2 text-[12px] font-semibold uppercase leading-4 tracking-[0.08em] text-secondary sm:px-4">
                {group === "today" ? t("common.today") : group === "week" ? t("social.activityThisWeek") : t("social.activityEarlier")}
              </h2>
              {groupItems.map((item) => {
                const unread = !readItems.has(item.id);
                return (
                  <NotificationRow
                    key={item.id}
                    actorName={item.actorName}
                    avatarUrl={item.actorAvatarUrl}
                    sentence={item.type === "like" ? t("social.likedYourPost") : item.type === "follow" ? t("social.followedYou") : t("social.commentedOnPost")}
                    preview={item.type !== "follow" ? item.commentBody || item.postPreview : null}
                    timestamp={formatCompactTime(item.createdAt, language)}
                    icon={item.type === "like" ? "favorite" : item.type === "follow" ? "person_add" : "mode_comment"}
                    unread={unread}
                    href={item.type === "follow" && item.actorUsername ? `/user/${item.actorUsername}` : item.postId ? `/post/${item.postId}` : undefined}
                    onClick={() => markAsRead(item.id)}
                  />
                );
              })}
            </section>
          ) : null) : (
            <div className="px-6 py-12 text-center">
              <span className="material-symbols-outlined icon-empty text-primary" aria-hidden="true">notifications</span>
              <h2 className="mt-3 text-title-lg font-semibold text-primary">{t("social.noActivityTitle")}</h2>
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
        <h2 className="text-label-lg font-semibold text-primary">{t("social.account")}</h2>
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
  const formMessage = state.message ? translatedMessage(t, state.message) : "";

  return (
    <section>
      <ScreenHeader title={t("social.settingsTitle")} description={t("social.settingsDescription")} />
      {user ? (
        <div className="mx-auto grid max-w-5xl gap-5 xl:grid-cols-[minmax(0,1fr)_340px]">
          <form action={formAction} className="premium-card overflow-hidden p-0">
            <div className="border-b border-outline-variant/20 p-5">
              <div className="flex flex-wrap items-center gap-4">
                <UserAvatar name={profileName} src={user.avatarUrl} size="xl" inverse />
                <div className="min-w-0">
                  <p className="text-caption font-semibold uppercase text-secondary">{t("social.profilePhoto")}</p>
                  <h2 className="mt-1 break-words text-headline-md font-semibold text-primary">{profileName}</h2>
                  <p className="mt-1 text-body-md font-semibold text-secondary">
                    {user.username ? `@${user.username}` : t("social.usernamePending")}
                  </p>
                </div>
              </div>
              <div className="mt-4">
                <ImageUploadPicker name="avatar" currentUrl={user.avatarUrl} capture="user" />
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

              <label className="flex items-start gap-3 rounded-xl border border-outline-variant/30 bg-surface-container-low p-4">
                <input
                  name="publicProfileEnabled"
                  type="checkbox"
                  defaultChecked={user.publicProfileEnabled}
                  className="mt-0.5 h-5 w-5 shrink-0 accent-primary"
                />
                <span className="min-w-0">
                  <span className="block text-label-md font-semibold text-primary">
                    {t("social.publicProfileEnabled")}
                  </span>
                  <span className="mt-1 block text-[13px] font-normal leading-5 text-secondary">
                    {t("social.publicProfileDescription")}
                  </span>
                </span>
              </label>

              <div className="flex flex-wrap items-center justify-between gap-3 border-t border-outline-variant/20 pt-4">
                {formMessage ? (
                  <p className={cn("text-caption font-semibold", state.ok ? "text-primary" : "text-error")} role="status">
                    {formMessage}
                  </p>
                ) : <span />}
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
    <section className="mx-auto min-h-dvh max-w-[680px] px-margin-mobile py-6 md:px-margin-tablet">
      <SocialPageHeader
        title={t("social.profileTitle")}
        leadingAction={
          <IconLink
            href="/app/user/home"
            icon="arrow_back"
            label={t("social.homeTitle")}
            className="text-primary"
          />
        }
        centered
      />

      <div className="border-b border-outline-variant/30 pb-5">
        <div className="flex items-center gap-5">
          <UserAvatar name={profile.displayName} src={profile.avatarUrl} size="xl" inverse />
          <ProfileStats
            posts={{ value: profile.postsCount, label: t("social.posts") }}
            followers={{ value: profile.followerCount, label: t("social.followers") }}
            following={{ value: profile.followingCount, label: t("social.following") }}
            username={profile.username}
          />
        </div>
        <div className="mt-4 min-w-0">
          <div className="flex min-w-0 items-center">
            <h1 className="truncate text-[19px] font-semibold leading-6 text-primary">{profile.displayName}</h1>
            <VerifiedBadge />
          </div>
          <p className="mt-0.5 break-words text-[14px] leading-5 text-secondary">@{profile.username}</p>
          <p className="mt-2 text-[14px] font-medium leading-5 text-primary">{profile.universityName}</p>
          {profile.bio ? <p className="mt-3 whitespace-pre-wrap break-words text-[14px] leading-5 text-primary">{profile.bio}</p> : null}
        </div>

        <div className="mt-4">
          {!profile.isOwnProfile ? (
            <form action={toggleFollowAction}>
              <input type="hidden" name="username" value={profile.username} />
              <FollowSubmitButton isFollowing={profile.isFollowing} />
            </form>
          ) : (
            <ButtonLink
              href="/app/user/settings"
              variant="secondary"
              icon="settings"
              className="w-full sm:w-auto"
            >
              {t("social.settingsTitle")}
            </ButtonLink>
          )}
        </div>
      </div>

      <div id="posts" className="pt-2">
        <FeedList
          posts={profile.posts}
          emptyTitle={t("social.noPostsYet")}
          showCreateAction={false}
        />
      </div>
    </section>
  );
}

export function ProfileScreen({
  user,
  stats,
  device: _device,
  posts
}: {
  user: CurrentStudentContext | null;
  stats: StudentProfileStats;
  device: DeviceType;
  posts: SocialPost[];
}) {
  const { t } = useLanguage();
  const [shareStatus, setShareStatus] = useState("");
  const verificationLabel = user?.studentStatus === "verified"
    ? t("social.verifiedStudent")
    : user?.studentStatus === "pending"
      ? t("social.verificationPending")
      : user?.studentStatus === "rejected"
        ? t("social.verificationRejected")
        : t("social.notVerified");
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

  async function shareProfile() {
    if (!user?.username) return;
    const url = `${publicUrl}/user/${user.username}`;
    try {
      if (navigator.share) await navigator.share({ title: profileName, url });
      else await navigator.clipboard.writeText(url);
      setShareStatus(t("social.linkCopied"));
    } catch {
      setShareStatus("");
    }
  }

  return (
    <section>
      <SocialPageHeader
        title={t("social.profileTitle")}
        action={
          <IconLink
            href="/app/user/settings"
            icon="settings"
            label={t("social.settingsTitle")}
          />
        }
      />
      <div className="mx-auto grid w-full max-w-[984px] gap-6 xl:grid-cols-[minmax(0,680px)_280px]">
        <div className="min-w-0">
          <div className="border-b border-outline-variant/30 pb-5">
            <div className="flex items-center gap-4 sm:gap-6">
              <UserAvatar name={profileName} src={user.avatarUrl} size="xl" inverse />
              <ProfileStats
                posts={{ value: stats.postsCount, label: t("social.posts") }}
                followers={{ value: stats.followerCount, label: t("social.followers") }}
                following={{ value: stats.followingCount, label: t("social.following") }}
                username={user.username}
              />
            </div>
            <div className="mt-4 min-w-0">
              <div className="flex min-w-0 items-center">
                <h2 className="truncate text-[17px] font-semibold leading-6 text-primary">{profileName}</h2>
                {user.studentStatus === "verified" ? <VerifiedBadge /> : <Badge tone="warning">{verificationLabel}</Badge>}
              </div>
              <p className="mt-0.5 break-words text-[14px] font-normal leading-5 text-secondary">
                {user.username ? `@${user.username}` : t("social.usernamePending")}
              </p>
              <p className="mt-2 text-[14px] font-medium leading-5 text-primary">{universityLabel}</p>
              {user.bio ? <p className="mt-2 max-w-2xl whitespace-pre-wrap break-words text-[15px] font-normal leading-6 text-primary">{user.bio}</p> : null}
              <div className="mt-4 grid min-w-0 grid-cols-1 gap-2 min-[520px]:grid-cols-2">
                <ButtonLink href="/app/user/settings" className="w-full min-w-0 px-4 text-[15px]">
                  {t("social.editProfile")}
                </ButtonLink>
                {user.username ? (
                  <Button type="button" variant="secondary" onClick={shareProfile} className="w-full min-w-0 px-4 text-[15px]">
                    {t("social.shareProfile")}
                  </Button>
                ) : null}
                <ButtonLink href="/app/user/pass" variant="secondary" className="w-full min-w-0 px-4 text-[15px] min-[520px]:col-span-2">
                  {t("social.studentPass")}
                </ButtonLink>
                <span className="sr-only" role="status">{shareStatus}</span>
              </div>
            </div>
          </div>

          <nav className="grid grid-cols-2 border-b border-outline-variant/30" aria-label={t("social.profileSections")}>
            <Link href="#posts" className="inline-flex min-h-12 min-w-0 items-center justify-center border-b-2 border-primary px-2 py-2 text-center text-[13px] font-semibold leading-4 text-primary">
              {t("social.posts")}
            </Link>
            <Link href="/app/user/pass" className="inline-flex min-h-12 min-w-0 items-center justify-center border-b-2 border-transparent px-2 py-2 text-center text-[13px] font-semibold leading-4 text-secondary transition-colors hover:border-outline hover:text-primary">
              {t("social.studentPass")}
            </Link>
          </nav>

          <section id="posts" className="scroll-mt-24">
            <FeedList
              posts={posts}
              emptyTitle={t("social.noPostsYet")}
              showCreateAction={false}
            />
          </section>

        </div>
        <SocialRightRail user={user} />
      </div>
    </section>
  );
}
