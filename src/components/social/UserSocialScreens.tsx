"use client";

import Link from "next/link";
import { useActionState, useId, useOptimistic, useState, useTransition } from "react";
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

const LANGUAGE_OPTIONS: ReadonlyArray<{ value: Language; label: string }> = [
  { value: "az", label: "Azerbaycan dili" },
  { value: "tr", label: "Turkce" },
  { value: "en", label: "English" },
  { value: "ru", label: "Russian" }
];

function formatDateTime(value: string | null | undefined) {
  if (!value) return "-";
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit"
  }).format(new Date(value));
}

function campusCommunityName(user: CurrentStudentContext | null | undefined) {
  const university = user?.universityName || user?.legacyUniversityName;
  if (!university) return "Cadesca campus";
  return `Cadesca x ${university.replace(/ University$/i, "")}`;
}

function initials(name: string | null | undefined) {
  const parts = (name || "Cadesca Student").trim().split(/\s+/).slice(0, 2);
  return parts.map((part) => part[0]?.toUpperCase()).join("") || "CS";
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

  return (
    <div
      className={cn(
        "flex shrink-0 items-center justify-center overflow-hidden rounded-full border border-outline-variant/30 font-semibold",
        sizes[size],
        inverse ? "bg-primary text-on-primary" : "bg-surface-container-low text-primary"
      )}
    >
      {src ? <img src={src} alt="" className="h-full w-full object-cover" /> : initials(name)}
    </div>
  );
}

function VerifiedBadge() {
  const [open, setOpen] = useState(false);
  const tooltipId = useId();

  return (
    <span className="relative inline-flex">
      <button
        type="button"
        className="inline-flex h-7 w-7 items-center justify-center rounded-full text-primary transition-colors hover:bg-surface-container-low focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/30"
        aria-label="Verified student badge"
        aria-describedby={open ? tooltipId : undefined}
        aria-expanded={open}
        onClick={() => setOpen((value) => !value)}
        onFocus={() => setOpen(true)}
        onBlur={() => window.setTimeout(() => setOpen(false), 120)}
        onMouseEnter={() => setOpen(true)}
        onMouseLeave={() => setOpen(false)}
      >
        <span className="material-symbols-outlined material-symbols-filled text-[21px]" aria-hidden="true">verified</span>
      </button>
      {open ? (
        <span
          id={tooltipId}
          role="tooltip"
          className="absolute left-0 top-9 z-20 w-64 rounded-xl border border-outline-variant/30 bg-surface-container-lowest p-3 text-caption font-semibold text-secondary shadow-soft"
        >
          This badge means your student status has been verified by Cadesca.
        </span>
      ) : null}
    </span>
  );
}

function isVerifiedStudent(user: CurrentStudentContext | null): user is CurrentStudentContext & { universityId: string } {
  return Boolean(user?.socialReady && user.status === "active" && user.studentStatus === "verified" && user.universityId);
}

function VerificationGate({ user }: { user: CurrentStudentContext | null }) {
  let title = "Student verification required";
  let detail = "Your campus feed opens after your student verification is approved.";
  let icon = "verified_user";

  if (!user) {
    title = "Sign in required";
    detail = "Your session could not be verified.";
  } else if (!user.socialReady) {
    title = "Campus community is almost ready";
    detail = "We're setting up your private university space. Please check back soon.";
    icon = "hourglass_empty";
  } else if (!user.universityId) {
    title = "Campus community is almost ready";
    detail = "Your verified account is waiting for its university space.";
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
          Go to Profile
        </Link>
      </div>
    </div>
  );
}

export function SocialUnavailableScreen({ message: _message }: { message?: string }) {
  return (
    <section>
      <SocialPageHeader title="Home" subtitle="Cadesca university community" />
      <div className="mx-auto max-w-xl rounded-2xl border border-outline-variant/30 bg-surface-container-lowest p-6 text-center shadow-[0_1px_3px_rgba(0,0,0,0.04)]">
        <span className="material-symbols-outlined text-[28px] text-primary" aria-hidden="true">hourglass_empty</span>
        <h2 className="mt-3 text-headline-md font-semibold text-primary">Campus community is almost ready</h2>
        <p className="mt-2 text-body-md text-secondary">We're setting up your private university space. Please check back soon.</p>
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
  const [state, formAction, isPending] = useActionState(createPostAction, EMPTY_FORM_STATE);
  const [body, setBody] = useState("");
  const authorName = user.displayName || user.name;
  const placeholder = compact ? "What's happening at Bilkent?" : "What do you want to share?";
  const community = campusCommunityName(user);

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
          <div className="mt-3 flex flex-col gap-3 sm:flex-row sm:items-center">
            <label className="flex min-w-0 flex-1 items-center gap-2 rounded-full border border-outline-variant/30 bg-surface-container-lowest px-3 py-2">
              <span className="material-symbols-outlined text-[18px] text-secondary" aria-hidden="true">image</span>
              <span className="sr-only">Optional image URL</span>
              <input
                name="imageUrl"
                type="url"
                placeholder="Add image URL"
                className="h-6 min-w-0 flex-1 bg-transparent text-caption font-semibold text-primary outline-none placeholder:text-secondary"
              />
            </label>
            <div className="flex shrink-0 items-center justify-between gap-3 sm:justify-end">
              <span className="text-caption font-semibold text-secondary">{body.length}/{POST_MAX_LENGTH}</span>
              <Button type="submit" icon="send" disabled={isPending}>
                {isPending ? "Posting" : "Post"}
              </Button>
            </div>
          </div>
          <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
            <p className={cn("text-caption font-semibold", state.message ? (state.ok ? "text-primary" : "text-secondary") : "text-secondary")}>
              {state.message || `Visible to verified students in ${community}.`}
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
  const [state, formAction, isPending] = useActionState(addPostCommentAction, EMPTY_FORM_STATE);

  return (
    <form action={formAction} className="mt-3 flex gap-2">
      <input type="hidden" name="postId" value={postId} />
      <input
        name="body"
        maxLength={500}
        placeholder="Write a comment"
        className="h-10 min-w-0 flex-1 rounded-lg border border-outline-variant/30 bg-surface-container-lowest px-3 text-label-md text-primary outline-none transition focus:border-primary"
      />
      <Button type="submit" size="sm" variant="secondary" icon="chat_bubble" disabled={isPending}>
        {isPending ? "Sending" : "Reply"}
      </Button>
      {state.message ? <p className="sr-only" role="status">{state.message}</p> : null}
    </form>
  );
}

function SocialPostCard({ post }: { post: SocialPost }) {
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
                {post.universityName} · {formatDateTime(post.createdAt)}
              </p>
            </div>
          </div>
          {post.ownPost ? (
            <form action={deletePostAction}>
              <input type="hidden" name="postId" value={post.id} />
              <ActionIconButton icon="delete" title="Delete post" />
            </form>
          ) : (
            <form action={reportPostAction}>
              <input type="hidden" name="postId" value={post.id} />
              <input type="hidden" name="reason" value="Reported from feed" />
              <ActionIconButton icon="flag" title="Report post">
                Report
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
            <ActionIconButton icon="favorite" active={post.likedByCurrentUser} title="Like post">
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
            title="Share"
          >
            <span className="material-symbols-outlined text-[18px]" aria-hidden="true">ios_share</span>
            <span>Share</span>
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
                          {formatDateTime(comment.createdAt)}
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
  emptyTitle = "Be the first to post",
  emptyDescription = "Start the first campus conversation.",
  showCreateAction = false
}: {
  posts: SocialPost[];
  emptyTitle?: string;
  emptyDescription?: string;
  showCreateAction?: boolean;
}) {
  if (!posts.length) {
    return (
      <div className="rounded-2xl border border-outline-variant/30 bg-surface-container-lowest p-6 text-center shadow-[0_1px_3px_rgba(0,0,0,0.04)]">
        <span className="material-symbols-outlined text-[28px] text-primary" aria-hidden="true">forum</span>
        <h2 className="mt-3 text-headline-md font-semibold text-primary">{emptyTitle}</h2>
        <p className="mt-2 text-body-md text-secondary">{emptyDescription}</p>
        {showCreateAction ? (
          <Link
            href="/app/user/create"
            className="mt-5 inline-flex h-10 items-center justify-center gap-2 rounded-lg border border-primary bg-primary px-4 text-label-md font-semibold text-on-primary"
          >
            <span className="material-symbols-outlined text-[18px]" aria-hidden="true">add</span>
            Create post
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
  const universityLabel = campusCommunityName(user);

  return (
    <section>
      <SocialPageHeader
        title="Home"
        subtitle={universityLabel}
      />
      {isVerifiedStudent(user) ? (
        <div className="mx-auto grid max-w-xl gap-3">
          <PostComposer compact user={user} />
          <FeedList
            posts={posts}
            emptyTitle="Be the first to post"
            emptyDescription="Share something with verified students from your university."
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
  title: string;
  description: string;
  imageUrl: string;
}> = [
  {
    icon: "home_work",
    title: "Roommate Finder",
    description: "Find verified students looking for roommates.",
    imageUrl: "https://images.unsplash.com/photo-1522202176988-66273c2fd55f?auto=format&fit=crop&w=1400&q=82"
  },
  {
    icon: "favorite",
    title: "MatchMe",
    description: "Opt-in campus matching for verified students.",
    imageUrl: "https://images.unsplash.com/photo-1529333166437-7750a6dd5a70?auto=format&fit=crop&w=1400&q=82"
  },
  {
    icon: "event_available",
    title: "Events",
    description: "Discover campus events and join what matters.",
    imageUrl: "https://images.unsplash.com/photo-1470229722913-7c0e2dbbafd3?auto=format&fit=crop&w=1400&q=82"
  },
  {
    icon: "local_mall",
    title: "Marketplace",
    description: "Buy, sell and trade within your campus.",
    imageUrl: "https://images.unsplash.com/photo-1523275335684-37898b6baf30?auto=format&fit=crop&w=1400&q=82"
  }
];

function ExploreFeatureCard({
  icon,
  title,
  description,
  imageUrl
}: {
  icon: string;
  title: string;
  description: string;
  imageUrl: string;
}) {
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
          Soon
        </span>
      </div>
    </article>
  );
}

export function ExploreScreen({ user, posts }: { user: CurrentStudentContext | null; posts: SocialPost[] }) {
  return (
    <section>
      <SocialPageHeader title="Explore" subtitle={`${campusCommunityName(user)} launchpad`} />
      {isVerifiedStudent(user) ? (
        <div className="mx-auto max-w-3xl space-y-6">
          <div className="grid gap-3 sm:gap-4">
            {exploreFeatureCards.map((card) => (
              <ExploreFeatureCard key={card.title} {...card} />
            ))}
          </div>
          <div>
            <div className="mb-3 flex items-center justify-between gap-3">
              <h2 className="text-headline-md font-semibold text-primary">Campus Posts</h2>
              <Badge tone="muted">{posts.length} posts</Badge>
            </div>
            <FeedList
              posts={posts}
              emptyTitle="No trends yet"
              emptyDescription="Campus posts will surface here as students start sharing."
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
  return (
    <section>
      <SocialPageHeader title="Create post" subtitle={`Share with ${campusCommunityName(user)}`} />
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
  return (
    <section>
      <SocialPageHeader title="Activity" subtitle="Likes, comments, follows, and replies" />
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
                    {item.actorName} {item.type === "like" ? "liked your post" : item.type === "follow" ? "followed you" : "commented on your post"}
                  </p>
                  {item.actorUsername && item.type === "follow" ? (
                    <p className="mt-1 text-body-sm font-semibold text-secondary">@{item.actorUsername}</p>
                  ) : null}
                  {item.type !== "follow" ? (
                    <p className="mt-1 break-words text-body-sm text-secondary">
                      {item.commentBody || item.postPreview}
                    </p>
                  ) : null}
                  <p className="mt-2 text-caption text-secondary">{formatDateTime(item.createdAt)}</p>
                </div>
              </div>
            </div>
          )) : (
            <div className="rounded-2xl border border-outline-variant/30 bg-surface-container-lowest p-6 text-center shadow-[0_1px_3px_rgba(0,0,0,0.04)]">
              <span className="material-symbols-outlined text-[28px] text-primary" aria-hidden="true">notifications</span>
              <h2 className="mt-3 text-headline-md font-semibold text-primary">No activity yet</h2>
              <p className="mt-2 text-body-md text-secondary">Likes, comments, follows, and replies will appear here.</p>
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
  const { language, t } = useLanguage();
  const [selectedLanguage, setSelectedLanguage] = useOptimistic(language);
  const [message, setMessage] = useState("");
  const [isPending, startTransition] = useTransition();

  function changeLanguage(locale: Language) {
    setMessage("");

    startTransition(async () => {
      setSelectedLanguage(locale);
      try {
        await updateLanguagePreference(locale);
        setMessage("Language preference saved.");
        router.refresh();
      } catch {
        setMessage("Language preference could not be saved.");
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

function LogoutCard() {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  function logout() {
    startTransition(async () => {
      await fetch("/api/auth/logout", { method: "POST" }).catch(() => undefined);
      router.push("/login");
    });
  }

  return (
    <div className="premium-card p-5">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h2 className="text-label-lg font-semibold text-primary">Account</h2>
          <p className="mt-1 text-body-sm text-secondary">Cadesca student session</p>
        </div>
        <Button variant="secondary" icon="logout" disabled={pending} onClick={logout}>
          {pending ? "Logging out" : "Log out"}
        </Button>
      </div>
    </div>
  );
}

function AccountDetailsCard({ user }: { user: CurrentStudentContext }) {
  return (
    <div className="premium-card p-5">
      <h2 className="text-label-lg font-semibold text-primary">Account details</h2>
      <div className="mt-4 space-y-3 text-label-md">
        <div className="flex items-center justify-between gap-3">
          <span className="text-secondary">Email</span>
          <span className="min-w-0 break-words text-right font-semibold text-primary">{user.email}</span>
        </div>
        <div className="flex items-center justify-between gap-3">
          <span className="text-secondary">University</span>
          <span className="text-right font-semibold text-primary">{user.universityName || user.legacyUniversityName || "Not assigned"}</span>
        </div>
      </div>
    </div>
  );
}

function SettingsSaveButton() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" icon="check" disabled={pending}>
      {pending ? "Saving" : "Save changes"}
    </Button>
  );
}

export function ProfileSettingsScreen({ user }: { user: CurrentStudentContext | null }) {
  const [state, formAction] = useActionState(updateProfileSettingsAction, EMPTY_PROFILE_SETTINGS_STATE);
  const profileName = user?.displayName || user?.name || "Cadesca Student";

  return (
    <section>
      <ScreenHeader title="Settings" description="Profile and account preferences" />
      {user ? (
        <div className="mx-auto grid max-w-5xl gap-5 xl:grid-cols-[minmax(0,1fr)_340px]">
          <form action={formAction} encType="multipart/form-data" className="premium-card p-5">
            <div className="flex flex-wrap items-center gap-4 border-b border-outline-variant/20 pb-5">
              <Avatar name={profileName} src={user.avatarUrl} size="xl" inverse />
              <div className="min-w-0">
                <h2 className="break-words text-headline-md font-semibold text-primary">{profileName}</h2>
                <p className="mt-1 text-body-md font-semibold text-secondary">
                  {user.username ? `@${user.username}` : "@username pending"}
                </p>
              </div>
            </div>

            <div className="mt-5 grid gap-4">
              <label className="block">
                <span className="mb-2 block text-caption font-semibold uppercase text-secondary">Display name</span>
                <input
                  name="displayName"
                  defaultValue={user.displayName || user.name}
                  maxLength={80}
                  className="h-11 w-full rounded-lg border border-outline-variant/30 bg-surface-container-lowest px-4 text-label-md text-primary outline-none transition focus:border-primary"
                />
              </label>

              <label className="block">
                <span className="mb-2 block text-caption font-semibold uppercase text-secondary">Username</span>
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
                <span className="mb-2 block text-caption font-semibold uppercase text-secondary">Bio</span>
                <textarea
                  name="bio"
                  defaultValue={user.bio || ""}
                  rows={4}
                  maxLength={240}
                  className="min-h-28 w-full resize-none rounded-lg border border-outline-variant/30 bg-surface-container-lowest px-4 py-3 text-label-md text-primary outline-none transition focus:border-primary"
                />
              </label>

              <label className="block">
                <span className="mb-2 block text-caption font-semibold uppercase text-secondary">Profile photo</span>
                <input
                  name="avatar"
                  type="file"
                  accept="image/jpeg,image/png,image/webp"
                  className="block w-full rounded-lg border border-outline-variant/30 bg-surface-container-lowest px-4 py-3 text-label-md text-primary file:mr-4 file:rounded-md file:border-0 file:bg-primary file:px-3 file:py-2 file:text-caption file:font-semibold file:text-on-primary"
                />
              </label>

              <div className="flex flex-wrap items-center justify-between gap-3 border-t border-outline-variant/20 pt-4">
                <p className={cn("text-caption font-semibold", state.message ? (state.ok ? "text-primary" : "text-secondary") : "text-secondary")}>
                  {state.message || "Changes apply to your campus profile."}
                </p>
                <SettingsSaveButton />
              </div>
            </div>
          </form>

          <aside className="space-y-5">
            <AccountDetailsCard user={user} />
            <LanguageSettings />
            <LogoutCard />
          </aside>
        </div>
      ) : (
        <VerificationGate user={user} />
      )}
    </section>
  );
}

function FollowSubmitButton({ isFollowing }: { isFollowing: boolean }) {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" variant={isFollowing ? "secondary" : "primary"} icon={isFollowing ? "person_remove" : "person_add"} disabled={pending}>
      {pending ? "Updating" : isFollowing ? "Unfollow" : "Follow"}
    </Button>
  );
}

export function PublicProfileScreen({ profile }: { profile: PublicStudentProfile }) {
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
            Home
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
                Settings
              </Link>
            )}
          </div>
        </div>

        <div className="grid gap-3 sm:grid-cols-3">
          <div className="premium-card p-4">
            <p className="text-caption font-semibold uppercase text-secondary">Posts</p>
            <p className="mt-2 text-headline-md font-semibold text-primary">{profile.postsCount}</p>
          </div>
          <div className="premium-card p-4">
            <p className="text-caption font-semibold uppercase text-secondary">Followers</p>
            <p className="mt-2 text-headline-md font-semibold text-primary">{profile.followerCount}</p>
          </div>
          <div className="premium-card p-4">
            <p className="text-caption font-semibold uppercase text-secondary">Following</p>
            <p className="mt-2 text-headline-md font-semibold text-primary">{profile.followingCount}</p>
          </div>
        </div>

        <div>
          <div className="mb-3 flex items-center justify-between gap-3">
            <h2 className="text-headline-md font-semibold text-primary">Posts</h2>
            <Badge tone="muted">{profile.universitySlug || "campus"}</Badge>
          </div>
          <FeedList
            posts={profile.posts}
            emptyTitle="No posts yet"
            emptyDescription="Posts from this student will appear here."
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
  const verificationLabel = user?.studentStatus === "verified" ? "Verified student" : user?.studentStatus || "Not verified";
  const profileName = user?.displayName || user?.name || "Cadesca Student";
  const universityLabel = user?.universityName || user?.legacyUniversityName || "University not assigned";

  if (!user) {
    return (
      <section>
        <SocialPageHeader title="Profile" subtitle="Cadesca campus" />
        <VerificationGate user={user} />
      </section>
    );
  }

  return (
    <section>
      <SocialPageHeader
        title="Profile"
        subtitle={campusCommunityName(user)}
        action={
          <Link
            href="/app/user/settings"
            className="inline-flex h-10 items-center justify-center gap-2 rounded-lg border border-outline-variant/30 bg-surface-container-lowest px-4 text-label-md font-semibold text-primary transition-colors hover:bg-surface-container-low"
          >
            <span className="material-symbols-outlined text-[18px]" aria-hidden="true">settings</span>
            Settings
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
                  {user?.username ? `@${user.username}` : "@username pending"}
                </p>
                <p className="mt-2 text-label-md font-semibold text-primary">{universityLabel}</p>
                {user?.bio ? <p className="mt-3 max-w-2xl whitespace-pre-wrap break-words text-body-md text-primary">{user.bio}</p> : null}
                <div className="mt-5 grid w-full max-w-md grid-cols-3 gap-2 border-y border-outline-variant/20 py-3 text-center sm:gap-4">
                  <div>
                    <p className="text-title-md font-semibold text-primary">{stats.postsCount}</p>
                    <p className="mt-0.5 text-caption font-semibold text-secondary">Posts</p>
                  </div>
                  <div>
                    <p className="text-title-md font-semibold text-primary">{stats.followerCount}</p>
                    <p className="mt-0.5 text-caption font-semibold text-secondary">Followers</p>
                  </div>
                  <div>
                    <p className="text-title-md font-semibold text-primary">{stats.followingCount}</p>
                    <p className="mt-0.5 text-caption font-semibold text-secondary">Following</p>
                  </div>
                </div>
                {user?.username ? (
                  <Link href={`/user/${user.username}`} className="mt-4 inline-flex h-9 items-center justify-center rounded-lg border border-outline-variant/30 px-3 text-caption font-semibold text-primary transition-colors hover:bg-surface-container-low">
                    View public profile
                  </Link>
                ) : null}
              </div>
            </div>
          </div>

          <nav className="flex gap-2 overflow-x-auto rounded-full border border-outline-variant/30 bg-surface-container-lowest p-1 shadow-[0_1px_3px_rgba(0,0,0,0.04)]" aria-label="Profile sections">
            {[
              { href: "#posts", icon: "forum", label: "Posts" },
              { href: "#student-pass", icon: "qr_code_2", label: "Student Pass" }
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
              <h2 className="text-headline-md font-semibold text-primary">Posts</h2>
              {user?.universitySlug ? <Badge tone="muted">{user.universitySlug}</Badge> : null}
            </div>
            <FeedList
              posts={posts}
              emptyTitle="No posts yet"
              emptyDescription="Your campus posts will appear here."
              showCreateAction={false}
            />
          </section>

          <section id="student-pass" className="scroll-mt-24 space-y-3">
            <div>
              <h2 className="text-headline-md font-semibold text-primary">Student Pass</h2>
              <p className="mt-1 text-body-sm text-secondary">Use your verified student pass with Wallet.</p>
            </div>
            <WalletPassSection device={device} showHeader={false} />
          </section>
        </div>

        <aside className="space-y-5">
          <div className="rounded-2xl border border-outline-variant/30 bg-surface-container-lowest p-5 shadow-[0_1px_3px_rgba(0,0,0,0.04)]">
            <h2 className="text-label-lg font-semibold text-primary">Campus verification</h2>
            <p className="mt-1 text-body-sm text-secondary">Your account is verified for your university community.</p>
            <div className="mt-4 space-y-3 text-label-md">
              <div className="flex items-center justify-between gap-3">
                <span className="text-secondary">University</span>
                <span className="text-right font-semibold text-primary">{universityLabel}</span>
              </div>
              <div className="flex items-center justify-between gap-3">
                <span className="text-secondary">Status</span>
                <span className="font-semibold text-primary">{user.studentStatus === "verified" ? "Verified" : verificationLabel}</span>
              </div>
            </div>
          </div>
          <LogoutCard />
        </aside>
      </div>
    </section>
  );
}
