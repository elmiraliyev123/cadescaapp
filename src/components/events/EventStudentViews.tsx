"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";

import {
  EventCard,
  EventEmptyState,
  EventsFrame,
  EventsHeader,
  EventStatusPill,
  eventInput,
  eventPrimaryButton,
  eventSecondaryButton
} from "@/components/events/EventPrimitives";
import type { EventDetail, EventDiscoveryItem, EventTicketView, PaymentMethod } from "@/lib/events/types";
import { useEventsI18n } from "@/lib/events/localization";
import { cn } from "@/lib/utils";

export function EventsDiscoveryView({
  events,
  featuredEvents,
  query
}: {
  events: EventDiscoveryItem[];
  featuredEvents: EventDiscoveryItem[];
  query: string;
}) {
  const { copy } = useEventsI18n();

  return (
    <EventsFrame>
      <EventsHeader
        eyebrow={copy.events}
        title={copy.discoverTitle}
        description={copy.discoverDescription}
        action={
          <Link href="/app/user/tickets" className={eventSecondaryButton}>
            <span className="material-symbols-outlined text-[19px]" aria-hidden="true">confirmation_number</span>
            <span>{copy.myTickets}</span>
          </Link>
        }
      />

      <form action="/app/user/events" method="get" className="mb-8 flex flex-col gap-2 sm:flex-row">
        <label className="min-w-0 flex-1">
          <span className="sr-only">{copy.searchPlaceholder}</span>
          <span className="relative block">
            <span className="material-symbols-outlined pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[20px] text-black/55" aria-hidden="true">search</span>
            <input
              type="search"
              name="q"
              defaultValue={query}
              placeholder={copy.searchPlaceholder}
              className={cn(eventInput, "pl-10")}
            />
          </span>
        </label>
        <button type="submit" className={eventPrimaryButton}><span>{copy.search}</span></button>
        {query ? <Link href="/app/user/events" className={eventSecondaryButton}><span>{copy.clearSearch}</span></Link> : null}
      </form>

      {!query && featuredEvents.length ? (
        <section className="mb-9">
          <div className="mb-4 flex items-center gap-2">
            <span className="material-symbols-outlined text-[22px]" aria-hidden="true">star</span>
            <h2 className="text-[22px] font-black tracking-[-0.025em]">{copy.featured}</h2>
          </div>
          <div className="grid gap-5 md:grid-cols-2">
            {featuredEvents.map((event) => <EventCard key={event.id} event={event} href={`/app/user/events/${event.slug}`} />)}
          </div>
        </section>
      ) : null}

      <section>
        <div className="mb-4 flex items-center justify-between gap-3">
          <h2 className="text-[22px] font-black tracking-[-0.025em]">{copy.upcoming}</h2>
          <span className="rounded-full border border-black bg-white px-2.5 py-1 text-[12px] font-black">{events.length}</span>
        </div>
        {events.length ? (
          <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">
            {events.map((event) => <EventCard key={event.id} event={event} href={`/app/user/events/${event.slug}`} />)}
          </div>
        ) : <EventEmptyState text={copy.noEvents} />}
      </section>
    </EventsFrame>
  );
}

function DetailRow({ icon, label, children }: { icon: string; label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-start gap-3 border-b border-black/10 py-3 last:border-b-0">
      <span className="material-symbols-outlined mt-0.5 text-[21px]" aria-hidden="true">{icon}</span>
      <div className="min-w-0">
        <p className="text-[11px] font-black uppercase tracking-[0.1em] text-black/50">{label}</p>
        <div className="mt-1 break-words text-[14px] font-bold leading-5 text-black">{children}</div>
      </div>
    </div>
  );
}

export function EventDetailView({
  event,
  ticket,
  publicView = false,
  serverNow
}: {
  event: EventDetail;
  ticket?: EventTicketView | null;
  publicView?: boolean;
  serverNow: string;
}) {
  const { copy, formatCurrency, formatDateTime, statusLabel } = useEventsI18n();

  return (
    <EventsFrame className={publicView ? "max-w-[1040px]" : undefined}>
      <div className="overflow-hidden rounded-2xl border-2 border-black bg-black">
        <div className="relative h-[260px] w-full bg-[#ffd400] sm:h-auto sm:aspect-[16/8]">
          {event.coverImageUrl ? <img src={event.coverImageUrl} alt="" className="h-full w-full object-cover" /> : (
            <div className="flex h-full items-center justify-center"><span className="material-symbols-outlined text-[72px]" aria-hidden="true">event</span></div>
          )}
          <div className="absolute inset-0 bg-gradient-to-t from-black via-black/25 to-transparent" />
          <div className="absolute inset-x-0 bottom-0 p-4 text-white sm:p-7">
            <div className="mb-3 flex flex-wrap gap-2">
              <EventStatusPill status={event.status} />
              {event.featuredStatus === "approved" ? <EventStatusPill status="approved" /> : null}
            </div>
            <p className="text-[12px] font-bold uppercase tracking-[0.12em] text-white/75">{copy.organizedBy} {event.clubName}</p>
            <h1 className="mt-2 max-w-4xl break-words text-[clamp(30px,7vw,56px)] font-black leading-[0.98] tracking-[-0.05em]">{event.title}</h1>
          </div>
        </div>
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-[minmax(0,1fr)_360px]">
        <div className="min-w-0 space-y-5">
          <div className="rounded-2xl border-2 border-black bg-white p-5">
            <p className="whitespace-pre-wrap break-words text-[15px] leading-7 text-black/75">{event.description}</p>
          </div>
          <div className="rounded-2xl border-2 border-black bg-white p-5">
            <h2 className="text-[20px] font-black">{copy.ticketDetails}</h2>
            <div className="mt-2 grid gap-x-6 sm:grid-cols-2">
              <DetailRow icon="schedule" label={copy.dateAndTime}>{formatDateTime(event.startAt)} – {formatDateTime(event.endAt)}</DetailRow>
              <DetailRow icon="location_on" label={copy.location}>{event.location}</DetailRow>
              {event.venueDetails ? <DetailRow icon="map" label={copy.venueDetails}>{event.venueDetails}</DetailRow> : null}
              <DetailRow icon="payments" label={copy.payment}>{event.isFree ? copy.free : formatCurrency(event.ticketPrice, event.currency)}</DetailRow>
              <DetailRow icon="event_busy" label={copy.ticketDeadline}>{formatDateTime(event.ticketRequestDeadline)}</DetailRow>
              <DetailRow icon="groups" label={copy.capacity}>{event.availableSlots > 0 ? `${event.availableSlots} ${copy.placesLeft}` : copy.soldOut}</DetailRow>
              {event.ageRequirement !== null ? <DetailRow icon="badge" label={copy.ageRequirement}>{event.ageRequirement} {copy.yearsAndOlder}</DetailRow> : null}
            </div>
          </div>
          <div className="rounded-2xl border-2 border-black bg-white p-5">
            <h2 className="text-[20px] font-black">{copy.refundPolicy}</h2>
            <p className="mt-3 whitespace-pre-wrap text-[14px] leading-6 text-black/70">{event.refundPolicy}</p>
          </div>
        </div>

        <aside className="lg:sticky lg:top-8 lg:self-start">
          {publicView ? (
            <div className="rounded-2xl border-2 border-black bg-[#ffd400] p-5 shadow-[5px_5px_0_#000]">
              <p className="text-[22px] font-black">{event.isFree ? copy.free : formatCurrency(event.ticketPrice, event.currency)}</p>
              <p className="mt-2 text-[14px] leading-5 text-black/70">{copy.publicNote}</p>
              <Link href={`/app/user/events/${event.slug}`} className={cn(eventSecondaryButton, "mt-5 w-full")}><span>{copy.publicCta}</span></Link>
            </div>
          ) : (
            <EventReservationPanel event={event} ticket={ticket || null} serverNow={serverNow} />
          )}
        </aside>
      </div>
    </EventsFrame>
  );
}

export function ReservationTimer({ expiresAt, serverNow }: { expiresAt: string; serverNow: string }) {
  const router = useRouter();
  const { copy } = useEventsI18n();
  const clock = useRef({ clientStartedAt: Date.now(), serverStartedAt: new Date(serverNow).getTime() });
  const refreshed = useRef(false);
  const [remaining, setRemaining] = useState(() => Math.max(0, new Date(expiresAt).getTime() - clock.current.serverStartedAt));

  useEffect(() => {
    clock.current = { clientStartedAt: Date.now(), serverStartedAt: new Date(serverNow).getTime() };
    refreshed.current = false;
    const update = () => {
      const serverEstimatedNow = clock.current.serverStartedAt + (Date.now() - clock.current.clientStartedAt);
      const next = Math.max(0, new Date(expiresAt).getTime() - serverEstimatedNow);
      setRemaining(next);
      if (next === 0 && !refreshed.current) {
        refreshed.current = true;
        router.refresh();
      }
    };
    update();
    const interval = window.setInterval(update, 1000);
    return () => window.clearInterval(interval);
  }, [expiresAt, router, serverNow]);

  if (remaining <= 0) return <p className="rounded-xl border border-black bg-white p-3 text-[13px] font-bold text-black/60" role="status">{copy.refreshingReservation}</p>;
  const totalSeconds = Math.ceil(remaining / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return (
    <div className="rounded-2xl border-2 border-black bg-white p-4" role="timer">
      <p className="text-[16px] font-black text-black">{copy.reservationCreated}</p>
      <p className="mt-1 text-[12px] font-semibold leading-5 text-black/65">{copy.completePaymentBeforeExpiry}</p>
      <div className="mt-3 flex min-w-0 flex-wrap items-end justify-between gap-2 border-t border-black/15 pt-3">
        <p className="min-w-0 text-[10px] font-black uppercase tracking-[0.1em] text-black/50">{copy.reservationEndsIn}</p>
        <p className="shrink-0 font-mono text-[24px] font-black tabular-nums text-black">{minutes}:{String(seconds).padStart(2, "0")}</p>
      </div>
    </div>
  );
}

export function EventReservationPanel({ event, ticket, serverNow }: { event: EventDetail; ticket: EventTicketView | null; serverNow: string }) {
  const router = useRouter();
  const { copy, errorLabel, formatCurrency, statusLabel } = useEventsI18n();
  const availableMethods: PaymentMethod[] = (() => {
    if (event.isFree) return ["free"];
    const methods: PaymentMethod[] = [];
    if (event.bankTransferEnabled) methods.push("bank_transfer");
    if (event.cashPaymentEnabled) methods.push("cash");
    return methods;
  })();
  const [method, setMethod] = useState<PaymentMethod | null>(availableMethods[0] || null);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function reserve() {
    if (!method) return;
    setPending(true);
    setError(null);
    try {
      const response = await fetch(`/api/events/${encodeURIComponent(event.id)}/reserve`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ paymentMethod: method })
      });
      const payload = await response.json().catch(() => ({})) as { error?: string; ticket?: EventTicketView };
      if (!response.ok || !payload.ticket) throw new Error(payload.error || "generic");
      router.push(`/app/user/tickets/${payload.ticket.id}`);
      router.refresh();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "generic");
    } finally {
      setPending(false);
    }
  }

  if (ticket) {
    return (
      <div className="rounded-2xl border-2 border-black bg-[#ffd400] p-5 shadow-[5px_5px_0_#000]">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="text-[11px] font-black uppercase tracking-[0.12em] text-black/55">{copy.ticket}</p>
            <p className="mt-1 text-[20px] font-black">{statusLabel(ticket.ticketStatus)}</p>
          </div>
          <EventStatusPill status={ticket.paymentStatus} />
        </div>
        {ticket.reservationExpiresAt && ticket.reservationStatus === "active" ? (
          <div className="mt-4"><ReservationTimer expiresAt={ticket.reservationExpiresAt} serverNow={serverNow} /></div>
        ) : null}
        <Link href={`/app/user/tickets/${ticket.id}`} className={cn(eventSecondaryButton, "mt-5 w-full")}><span>{copy.ticketDetails}</span></Link>
      </div>
    );
  }

  const unavailable = !(["published", "sold_out"] as const).includes(event.status as "published" | "sold_out") || event.availableSlots <= 0 || new Date(event.ticketRequestDeadline) <= new Date(serverNow);
  return (
    <div className="rounded-2xl border-2 border-black bg-[#ffd400] p-5 shadow-[5px_5px_0_#000]">
      <p className="text-[11px] font-black uppercase tracking-[0.12em] text-black/55">{copy.reservePlace}</p>
      <p className="mt-2 text-[26px] font-black tracking-[-0.03em]">{event.isFree ? copy.free : formatCurrency(event.ticketPrice, event.currency)}</p>
      <p className="mt-1 text-[13px] font-bold text-black/65">{event.availableSlots > 0 ? `${event.availableSlots} ${copy.placesLeft}` : copy.soldOut}</p>
      {!unavailable ? (
        <>
          <fieldset className="mt-5 space-y-2">
            <legend className="mb-2 text-[12px] font-black uppercase tracking-[0.08em]">{copy.choosePayment}</legend>
            {availableMethods.map((value) => (
              <label key={value} className="flex min-h-11 cursor-pointer items-center gap-3 rounded-xl border border-black bg-white px-3 py-2 text-[14px] font-bold">
                <input type="radio" name="paymentMethod" value={value} checked={method === value} onChange={() => setMethod(value)} className="h-4 w-4 accent-black" />
                {statusLabel(value)}
              </label>
            ))}
          </fieldset>
          {error ? <p className="mt-3 rounded-lg bg-black px-3 py-2 text-[13px] font-bold text-white" role="alert">{errorLabel(error)}</p> : null}
          <button type="button" className={cn(eventSecondaryButton, "mt-4 w-full")} disabled={pending || !method} onClick={reserve}>
            <span>{pending ? copy.loading : copy.requestTicket}</span>
          </button>
        </>
      ) : <p className="mt-4 rounded-xl border border-black bg-white p-3 text-[14px] font-bold">{event.availableSlots <= 0 ? copy.soldOut : statusLabel(event.status)}</p>}
    </div>
  );
}
