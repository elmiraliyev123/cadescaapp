"use client";

import Link from "next/link";

import type { EventDiscoveryItem } from "@/lib/events/types";
import { useEventsI18n, type EventPresentationStatus } from "@/lib/events/localization";
import { cn } from "@/lib/utils";

export const eventPrimaryButton =
  "inline-flex min-h-11 min-w-0 items-center justify-center gap-2 rounded-xl border border-black bg-[#ffd400] px-4 py-2.5 text-center text-[14px] font-black leading-5 text-black shadow-[3px_3px_0_#000] transition-transform hover:-translate-y-0.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-black focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 disabled:shadow-none [&>span]:whitespace-normal";

export const eventSecondaryButton =
  "inline-flex min-h-11 min-w-0 items-center justify-center gap-2 rounded-xl border border-black bg-white px-4 py-2.5 text-center text-[14px] font-bold leading-5 text-black transition-colors hover:bg-[#fff5c2] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-black focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 [&>span]:whitespace-normal";

export const eventInput =
  "min-h-11 w-full rounded-xl border border-black/25 bg-white px-3.5 py-2.5 text-[15px] leading-5 text-black outline-none placeholder:text-black/45 focus:border-black focus:ring-2 focus:ring-[#ffd400]";

export function EventsFrame({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <section
      className={cn(
        "mx-auto min-h-[60vh] w-full max-w-[1120px] rounded-[24px] bg-[#fffaf0] p-4 text-black sm:p-6 lg:p-8",
        className
      )}
    >
      {children}
    </section>
  );
}

export function EventsHeader({
  eyebrow,
  title,
  description,
  action
}: {
  eyebrow?: string;
  title: string;
  description?: string;
  action?: React.ReactNode;
}) {
  return (
    <header className="mb-6 flex flex-col gap-4 border-b-2 border-black pb-5 sm:flex-row sm:items-end sm:justify-between">
      <div className="min-w-0">
        {eyebrow ? (
          <p className="mb-2 text-[11px] font-black uppercase tracking-[0.18em] text-black/60">{eyebrow}</p>
        ) : null}
        <h1 className="max-w-3xl break-words text-[clamp(28px,6vw,48px)] font-black leading-[0.98] tracking-[-0.045em] text-black">
          {title}
        </h1>
        {description ? <p className="mt-3 max-w-2xl text-[15px] leading-6 text-black/65">{description}</p> : null}
      </div>
      {action ? <div className="flex shrink-0 flex-wrap gap-2">{action}</div> : null}
    </header>
  );
}

function statusClass(status: EventPresentationStatus) {
  if (["approved", "published", "active", "valid_ticket", "checked_in"].includes(status)) {
    return "border-black bg-[#ffd400] text-black";
  }
  if (["rejected", "cancelled", "revoked", "ticket_rejected", "ticket_cancelled", "invalid_qr"].includes(status)) {
    return "border-black bg-black text-white";
  }
  return "border-black/30 bg-white text-black";
}

export function EventStatusPill({ status, className }: { status: EventPresentationStatus; className?: string }) {
  const { statusLabel } = useEventsI18n();
  return (
    <span
      className={cn(
        "inline-flex min-h-7 max-w-full items-center rounded-full border px-2.5 py-1 text-[11px] font-extrabold leading-4",
        statusClass(status),
        className
      )}
    >
      {statusLabel(status)}
    </span>
  );
}

export function EventCard({ event, href }: { event: EventDiscoveryItem; href: string }) {
  const { copy, formatCurrency, formatDateTime } = useEventsI18n();
  const soldOut = event.status === "sold_out" || event.availableSlots <= 0;

  return (
    <article className="group flex h-full min-w-0 flex-col overflow-hidden rounded-2xl border-2 border-black bg-white shadow-[5px_5px_0_#000]">
      <Link href={href} className="relative block aspect-[16/9] overflow-hidden bg-[#ffd400] focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-[#ffd400]">
        {event.coverImageUrl ? (
          <img
            src={event.coverImageUrl}
            alt=""
            loading="lazy"
            className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-[1.03]"
          />
        ) : (
          <div className="flex h-full items-center justify-center">
            <span className="material-symbols-outlined text-[54px] text-black" aria-hidden="true">event</span>
          </div>
        )}
        {event.featuredStatus === "approved" ? (
          <span className="absolute left-3 top-3 rounded-full border border-black bg-[#ffd400] px-2.5 py-1 text-[11px] font-black text-black">
            {copy.featured}
          </span>
        ) : null}
      </Link>
      <div className="flex flex-1 flex-col p-4">
        <div className="flex min-w-0 items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="flex min-w-0 flex-wrap items-center gap-1.5">
              <p className="min-w-0 break-words text-[12px] font-bold uppercase tracking-[0.08em] text-black/55">{event.clubName}</p>
              <span className="inline-flex shrink-0 items-center gap-0.5 rounded-full border border-black/25 bg-[#fff5c2] px-1.5 py-0.5 text-[10px] font-black uppercase tracking-[0.04em] text-black">
                <span className="material-symbols-outlined text-[13px]" aria-hidden="true">verified</span>
                {copy.approvedClub}
              </span>
            </div>
            <h2 className="mt-1 break-words text-[20px] font-black leading-6 tracking-[-0.02em] text-black">
              <Link href={href} className="hover:underline">{event.title}</Link>
            </h2>
          </div>
          <EventStatusPill status={event.status} className="shrink-0" />
        </div>
        <div className="mt-4 space-y-2 text-[13px] font-medium text-black/65">
          <p className="flex min-w-0 items-start gap-2">
            <span className="material-symbols-outlined mt-0.5 text-[17px] text-black" aria-hidden="true">calendar_month</span>
            <span>{formatDateTime(event.startAt)}</span>
          </p>
          <p className="flex min-w-0 items-start gap-2">
            <span className="material-symbols-outlined mt-0.5 text-[17px] text-black" aria-hidden="true">location_on</span>
            <span className="break-words">{event.location}</span>
          </p>
        </div>
        <div className="mt-auto flex items-end justify-between gap-3 border-t border-black/15 pt-4">
          <div>
            <p className="text-[17px] font-black text-black">
              {event.isFree ? copy.free : formatCurrency(event.ticketPrice, event.currency)}
            </p>
            <p className="mt-0.5 text-[11px] font-bold text-black/55">
              {soldOut ? copy.soldOut : `${event.availableSlots} ${copy.placesLeft}`}
            </p>
          </div>
          <Link href={href} className={eventPrimaryButton}>
            <span>{soldOut ? copy.viewEvent : copy.requestTicket}</span>
          </Link>
        </div>
      </div>
    </article>
  );
}

export function EventMetric({ label, value, icon }: { label: string; value: string | number; icon: string }) {
  return (
    <div className="rounded-2xl border-2 border-black bg-white p-4 shadow-[3px_3px_0_#ffd400]">
      <div className="flex items-center justify-between gap-3">
        <p className="min-w-0 break-words text-[12px] font-black uppercase tracking-[0.08em] text-black/55">{label}</p>
        <span className="material-symbols-outlined text-[21px] text-black" aria-hidden="true">{icon}</span>
      </div>
      <p className="mt-3 text-[28px] font-black leading-none tracking-[-0.03em] text-black">{value}</p>
    </div>
  );
}

export function EventEmptyState({ text, action }: { text: string; action?: React.ReactNode }) {
  return (
    <div className="rounded-2xl border-2 border-dashed border-black bg-white px-5 py-12 text-center">
      <span className="material-symbols-outlined text-[48px] text-black" aria-hidden="true">event_busy</span>
      <p className="mx-auto mt-3 max-w-md text-[15px] font-bold leading-6 text-black">{text}</p>
      {action ? <div className="mt-5 flex justify-center">{action}</div> : null}
    </div>
  );
}

export function EventsLoadingState() {
  const { copy } = useEventsI18n();
  return (
    <EventsFrame>
      <div className="animate-pulse" aria-label={copy.loading} role="status">
        <div className="h-4 w-24 rounded bg-black/15" />
        <div className="mt-4 h-12 max-w-xl rounded bg-black/15" />
        <div className="mt-8 grid gap-5 sm:grid-cols-2">
          {[0, 1, 2, 3].map((item) => <div key={item} className="aspect-[4/3] rounded-2xl border-2 border-black/10 bg-white" />)}
        </div>
        <span className="sr-only">{copy.loading}</span>
      </div>
    </EventsFrame>
  );
}

export function EventsRouteError({ error, onRetry }: { error?: string | null; onRetry?: () => void }) {
  const { copy, errorLabel } = useEventsI18n();
  return (
    <EventsFrame>
      <div className="rounded-2xl border-2 border-black bg-white p-6 text-center shadow-[5px_5px_0_#ffd400]">
        <span className="material-symbols-outlined text-[48px] text-black" aria-hidden="true">error</span>
        <h1 className="mt-3 text-[24px] font-black text-black">{copy.somethingWentWrong}</h1>
        <p className="mx-auto mt-2 max-w-lg text-[14px] leading-6 text-black/65">{errorLabel(error)}</p>
        {onRetry ? (
          <button type="button" className={cn(eventPrimaryButton, "mt-5")} onClick={onRetry}>
            <span>{copy.retry}</span>
          </button>
        ) : null}
      </div>
    </EventsFrame>
  );
}

type ClubNavId = "overview" | "events" | "finance" | "scanner";

export function ClubEventNav({ current, visible }: { current: ClubNavId; visible?: readonly ClubNavId[] }) {
  const { copy } = useEventsI18n();
  const items = [
    { id: "overview" as const, href: "/app/club", label: copy.overview, icon: "dashboard" },
    { id: "events" as const, href: "/app/club/events", label: copy.clubEvents, icon: "event" },
    { id: "finance" as const, href: "/app/club/finance", label: copy.finance, icon: "payments" },
    { id: "scanner" as const, href: "/app/club/scanner", label: copy.scanner, icon: "qr_code_scanner" }
  ];
  return (
    <nav className="no-scrollbar mb-6 flex gap-2 overflow-x-auto pb-1" aria-label={copy.clubDashboard}>
      {items.filter((item) => !visible || visible.includes(item.id)).map((item) => (
        <Link
          key={item.id}
          href={item.href}
          aria-current={current === item.id ? "page" : undefined}
          className={cn(
            "inline-flex min-h-10 shrink-0 items-center gap-2 rounded-full border border-black px-3.5 text-[13px] font-extrabold",
            current === item.id ? "bg-black text-white" : "bg-white text-black hover:bg-[#fff5c2]"
          )}
        >
          <span className="material-symbols-outlined text-[18px]" aria-hidden="true">{item.icon}</span>
          {item.label}
        </Link>
      ))}
    </nav>
  );
}
