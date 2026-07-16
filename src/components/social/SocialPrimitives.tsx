"use client";

import Link from "next/link";
import { useId, useState } from "react";

import { useLanguage } from "@/lib/i18n";
import { cn } from "@/lib/utils";

function avatarInitials(name: string | null | undefined, fallback: string) {
  return (name || fallback)
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join("") || "CS";
}

export function UserAvatar({
  name,
  src,
  size = "md",
  inverse = false,
  className
}: {
  name: string | null | undefined;
  src?: string | null;
  size?: "sm" | "md" | "notification" | "lg" | "xl";
  inverse?: boolean;
  className?: string;
}) {
  const { t } = useLanguage();
  const sizes = {
    sm: "h-9 w-9 text-[12px]",
    md: "h-11 w-11 text-[13px]",
    notification: "h-11 w-11 text-[13px]",
    lg: "h-16 w-16 text-[16px]",
    xl: "h-20 w-20 text-[18px]"
  };
  const label = name || t("social.defaultStudentName");

  return (
    <span
      role="img"
      aria-label={label}
      className={cn(
        "inline-flex shrink-0 items-center justify-center overflow-hidden rounded-full border border-outline-variant/35 font-semibold",
        sizes[size],
        inverse ? "bg-primary text-on-primary" : "bg-surface-container-low text-primary",
        className
      )}
    >
      {src ? (
        <img src={src} alt="" className="h-full w-full object-cover" />
      ) : (
        <span aria-hidden="true">{avatarInitials(name, label)}</span>
      )}
    </span>
  );
}

export function VerifiedBadge({ inverse = false, className }: { inverse?: boolean; className?: string }) {
  const { t } = useLanguage();
  const [open, setOpen] = useState(false);
  const tooltipId = useId();

  return (
    <span className={cn("relative ml-1 inline-flex shrink-0 self-center align-middle", className)}>
      <button
        type="button"
        className={cn(
          "relative top-px inline-flex h-4 w-4 items-center justify-center rounded-full focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/30 after:absolute after:-inset-[14px] after:content-['']",
          inverse ? "text-white" : "text-primary"
        )}
        aria-label={t("social.verifiedBadgeLabel")}
        aria-describedby={open ? tooltipId : undefined}
        aria-expanded={open}
        onClick={() => setOpen(true)}
        onFocus={() => setOpen(true)}
        onBlur={() => window.setTimeout(() => setOpen(false), 120)}
        onKeyDown={(event) => {
          if (event.key === "Escape") setOpen(false);
        }}
      >
        <span className="material-symbols-outlined material-symbols-filled icon-badge leading-none" aria-hidden="true">
          verified
        </span>
      </button>
      {open ? (
        <span
          id={tooltipId}
          role="tooltip"
          className="fixed bottom-[calc(var(--verified-tooltip-bottom,88px)+env(safe-area-inset-bottom))] left-4 right-4 z-30 w-auto rounded-lg border border-outline-variant/35 bg-surface-container-lowest px-3 py-2 text-[13px] font-normal leading-5 text-secondary shadow-md sm:absolute sm:bottom-auto sm:left-0 sm:right-auto sm:top-7 sm:w-60"
        >
          {t("social.verifiedBadgeTooltip")}
        </span>
      ) : null}
    </span>
  );
}

export function SocialPageHeader({
  title,
  subtitle,
  leadingAction,
  action,
  centered = false
}: {
  title: string;
  subtitle?: string;
  leadingAction?: React.ReactNode;
  action?: React.ReactNode;
  centered?: boolean;
}) {
  return (
    <header className="relative mx-auto mb-4 flex min-h-14 w-full max-w-[984px] items-center justify-between gap-2 border-b border-outline-variant/25 pb-3">
      {leadingAction ? <div className="shrink-0">{leadingAction}</div> : null}
      <div className={cn("min-w-0 flex-1", centered && "pointer-events-none absolute left-1/2 max-w-[calc(100%-168px)] -translate-x-1/2 text-center")}>
        <h1 className="break-words text-social-page text-primary">{title}</h1>
        {subtitle ? <p className="mt-0.5 truncate text-social-meta text-secondary">{subtitle}</p> : null}
      </div>
      {action ? <div className="shrink-0">{action}</div> : null}
    </header>
  );
}

export function PostAuthorRow({
  name,
  username,
  avatarUrl,
  href,
  timestamp,
  menu
}: {
  name: string;
  username?: string | null;
  avatarUrl?: string | null;
  href?: string;
  timestamp: string;
  menu?: React.ReactNode;
}) {
  const nameNode = href ? (
    <Link href={href} className="min-w-0 truncate text-[15px] font-semibold leading-5 text-primary hover:underline">
      {name}
    </Link>
  ) : (
    <span className="min-w-0 truncate text-[15px] font-semibold leading-5 text-primary">{name}</span>
  );

  return (
    <div className="flex items-start gap-3">
      <UserAvatar name={name} src={avatarUrl} size="md" />
      <div className="min-w-0 flex-1 pt-0.5">
        <div className="flex min-w-0 items-center">
          {nameNode}
          <VerifiedBadge />
        </div>
        <p className="mt-0.5 truncate text-[13px] font-normal leading-5 text-secondary">
          {username ? `@${username} · ` : ""}{timestamp}
        </p>
      </div>
      {menu}
    </div>
  );
}

export function PostActionRow({ children }: { children: React.ReactNode }) {
  return <div className="flex min-h-11 items-center gap-2 border-t border-outline-variant/20 pt-1">{children}</div>;
}

export function ProfileStats({
  posts,
  followers,
  following,
  username
}: {
  posts: { value: number; label: string };
  followers: { value: number; label: string };
  following: { value: number; label: string };
  username?: string | null;
}) {
  const stats = [
    { ...posts, href: username ? `/user/${username}#posts` : "#posts" },
    { ...followers, href: username ? `/user/${username}#followers` : "#followers" },
    { ...following, href: username ? `/user/${username}#following` : "#following" }
  ];

  return (
    <div className="grid min-w-0 flex-1 grid-cols-3 gap-1 text-center">
      {stats.map((stat) => (
        <Link key={stat.label} href={stat.href} className="min-w-0 rounded-lg px-1 py-1.5 hover:bg-surface-container-low focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/30">
          <span className="block text-[16px] font-semibold leading-5 text-primary">{stat.value}</span>
          <span className="mt-0.5 block min-h-8 break-words text-[12px] font-normal leading-4 text-secondary">{stat.label}</span>
        </Link>
      ))}
    </div>
  );
}

export function FeatureBanner({
  icon,
  title,
  description,
  imageUrl,
  status
}: {
  icon: string;
  title: string;
  description: string;
  imageUrl: string;
  status: string;
}) {
  return (
    <article
      className="group relative aspect-[16/10] w-[clamp(260px,76vw,290px)] flex-[0_0_clamp(260px,76vw,290px)] overflow-hidden rounded-xl bg-primary text-white"
      aria-label={`${title}. ${description}. ${status}`}
    >
      <img src={imageUrl} alt="" loading="lazy" className="absolute inset-0 h-full w-full object-cover transition-transform duration-300 group-hover:scale-[1.02]" />
      <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(0,0,0,0.16)_0%,rgba(0,0,0,0.78)_100%)]" />
      <div className="relative flex h-full flex-col justify-between p-4">
        <span className="flex h-9 w-9 items-center justify-center rounded-full bg-white/95 text-primary">
          <span className="material-symbols-outlined icon-ui" aria-hidden="true">{icon}</span>
        </span>
        <div className="flex min-w-0 items-end gap-3">
          <div className="min-w-0 flex-1">
            <h2 className="text-[20px] font-semibold leading-6 tracking-[-0.02em] text-white">{title}</h2>
            <p className="mt-1 line-clamp-2 text-[13px] font-normal leading-4 text-white/90">{description}</p>
          </div>
          <span className="inline-flex min-h-8 max-w-[92px] shrink-0 items-center justify-center rounded-lg bg-white/95 px-3 text-center text-[12px] font-semibold leading-4 text-primary">
            {status}
          </span>
        </div>
      </div>
    </article>
  );
}

export function NotificationRow({
  actorName,
  avatarUrl,
  sentence,
  preview,
  timestamp,
  icon,
  unread,
  href,
  onClick
}: {
  actorName: string;
  avatarUrl?: string | null;
  sentence: string;
  preview?: string | null;
  timestamp: string;
  icon?: string;
  unread?: boolean;
  href?: string;
  onClick?: () => void;
}) {
  const className = cn(
    "flex min-h-[72px] w-full items-center gap-3 border-b border-outline-variant/20 px-3 py-3 text-left transition-colors hover:bg-surface-container-low/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-primary/30 sm:px-4",
    unread && "bg-surface-container-low/40"
  );
  const content = (
    <>
      <span className="relative shrink-0">
        <UserAvatar name={actorName} src={avatarUrl} size="notification" />
        {icon ? (
          <span className="absolute -bottom-0.5 -right-0.5 flex h-4 w-4 items-center justify-center rounded-full border-2 border-surface-container-lowest bg-primary text-white">
            <span className="material-symbols-outlined icon-overlay" aria-hidden="true">{icon}</span>
          </span>
        ) : null}
      </span>
      <span className="min-w-0 flex-1">
        <span className="line-clamp-2 text-[14px] font-normal leading-5 text-primary">
          <strong className="font-semibold">{actorName}</strong> {sentence}
        </span>
        {preview ? <span className="mt-0.5 block truncate text-[13px] font-normal leading-5 text-secondary">{preview}</span> : null}
      </span>
      <span className="flex shrink-0 items-center gap-2">
        <span className="text-[13px] font-normal leading-5 text-secondary">{timestamp}</span>
        {unread ? <span className="h-1.5 w-1.5 rounded-full bg-primary" aria-hidden="true" /> : null}
      </span>
    </>
  );

  if (href) {
    return (
      <Link href={href} className={className} onClick={onClick}>
        {content}
      </Link>
    );
  }

  return (
    <button type="button" className={className} onClick={onClick}>
      {content}
    </button>
  );
}
