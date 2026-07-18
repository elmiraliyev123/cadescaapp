"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";

import {
  EventEmptyState,
  EventsFrame,
  EventsHeader,
  EventStatusPill,
  eventInput,
  eventPrimaryButton,
  eventSecondaryButton
} from "@/components/events/EventPrimitives";
import { ReservationTimer } from "@/components/events/EventStudentViews";
import type { EventTicketView } from "@/lib/events/types";
import { useEventsI18n } from "@/lib/events/localization";
import { useLanguage } from "@/lib/i18n";
import { cn } from "@/lib/utils";

function TicketCard({ ticket }: { ticket: EventTicketView }) {
  const { copy, formatCurrency, formatDateTime } = useEventsI18n();
  return (
    <article className="overflow-hidden rounded-2xl border-2 border-black bg-white shadow-[4px_4px_0_#000]">
      <div className="grid sm:grid-cols-[180px_minmax(0,1fr)]">
        <Link href={`/app/user/tickets/${ticket.id}`} className="flex min-h-[150px] items-center justify-center bg-[#ffd400]">
          {ticket.eventCoverImageUrl ? <img src={ticket.eventCoverImageUrl} alt="" className="h-full w-full object-cover" /> : <span className="material-symbols-outlined text-[54px]" aria-hidden="true">confirmation_number</span>}
        </Link>
        <div className="min-w-0 p-4">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="text-[11px] font-black uppercase tracking-[0.1em] text-black/50">{ticket.clubName}</p>
              <h2 className="mt-1 break-words text-[20px] font-black leading-6"><Link href={`/app/user/tickets/${ticket.id}`} className="hover:underline">{ticket.eventTitle}</Link></h2>
            </div>
            <EventStatusPill status={ticket.ticketStatus} />
          </div>
          <div className="mt-3 grid gap-1 text-[13px] font-medium text-black/65 sm:grid-cols-2">
            <p>{formatDateTime(ticket.startAt)}</p>
            <p className="sm:text-right">{ticket.amount > 0 ? formatCurrency(ticket.amount, ticket.currency) : copy.free}</p>
          </div>
          <div className="mt-4 flex flex-wrap items-center justify-between gap-2 border-t border-black/10 pt-3">
            <EventStatusPill status={ticket.paymentStatus} />
            <Link href={`/app/user/tickets/${ticket.id}`} className={eventSecondaryButton}><span>{copy.ticketDetails}</span></Link>
          </div>
        </div>
      </div>
    </article>
  );
}

export function TicketsListView({ tickets }: { tickets: EventTicketView[] }) {
  const { copy } = useEventsI18n();
  return (
    <EventsFrame>
      <EventsHeader
        eyebrow={copy.events}
        title={copy.myTickets}
        description={copy.myTicketsDescription}
        action={<Link href="/app/user/events" className={eventPrimaryButton}><span>{copy.browseEvents}</span></Link>}
      />
      {tickets.length ? <div className="space-y-5">{tickets.map((ticket) => <TicketCard key={ticket.id} ticket={ticket} />)}</div> : (
        <EventEmptyState text={copy.noTickets} action={<Link href="/app/user/events" className={eventPrimaryButton}><span>{copy.browseEvents}</span></Link>} />
      )}
    </EventsFrame>
  );
}

function TicketFact({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="border-b border-black/10 py-3 last:border-b-0">
      <p className="text-[11px] font-black uppercase tracking-[0.1em] text-black/50">{label}</p>
      <div className="mt-1 break-words text-[14px] font-bold leading-5">{children}</div>
    </div>
  );
}

function TicketPaymentActions({ ticket }: { ticket: EventTicketView }) {
  const router = useRouter();
  const { copy, errorLabel, formatDateTime } = useEventsI18n();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  async function cancelTicket() {
    setPending(true);
    setError(null);
    setSuccess(null);
    try {
      const response = await fetch(`/api/events/tickets/${encodeURIComponent(ticket.id)}/cancel`, { method: "POST" });
      const payload = await response.json().catch(() => ({})) as { error?: string };
      if (!response.ok) throw new Error(payload.error || "generic");
      setSuccess(copy.cancelTicket);
      router.refresh();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "generic");
    } finally {
      setPending(false);
    }
  }

  async function submitPayment(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPending(true);
    setError(null);
    setSuccess(null);
    try {
      const response = await fetch(`/api/events/tickets/${encodeURIComponent(ticket.id)}/payment`, {
        method: "POST",
        body: new FormData(event.currentTarget)
      });
      const payload = await response.json().catch(() => ({})) as { error?: string };
      if (!response.ok) throw new Error(payload.error || "generic");
      setSuccess(copy.paymentSubmitted);
      router.refresh();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "generic");
    } finally {
      setPending(false);
    }
  }

  const canUpload = !ticket.refundRequiredAt && ticket.ticketStatus === "pending" && ticket.paymentMethod === "bank_transfer" && ["pending", "clarification_requested"].includes(ticket.paymentStatus);
  const canCancel = ["pending", "active"].includes(ticket.ticketStatus);

  return (
    <div className="space-y-4">
      {ticket.refundRequiredAt ? <p className="rounded-xl border-2 border-black bg-[#ffd400] p-3 text-[13px] font-black" role="status">{errorLabel("refund_required")}</p> : null}
      {ticket.paymentMethod === "bank_transfer" && (ticket.iban || ticket.bankAccountName || ticket.paymentInstructions) ? (
        <div className="rounded-2xl border-2 border-black bg-[#ffd400] p-4">
          <h3 className="text-[18px] font-black">{copy.paymentInstructions}</h3>
          {ticket.bankAccountName ? <TicketFact label={copy.accountName}>{ticket.bankAccountName}</TicketFact> : null}
          {ticket.iban ? <TicketFact label={copy.iban}><span className="font-mono break-all">{ticket.iban}</span></TicketFact> : null}
          {ticket.paymentInstructions ? <p className="mt-3 whitespace-pre-wrap text-[13px] leading-5">{ticket.paymentInstructions}</p> : null}
        </div>
      ) : null}

      {canUpload ? (
        <form onSubmit={submitPayment} className="rounded-2xl border-2 border-black bg-white p-4">
          <h3 className="text-[18px] font-black">{copy.submitPayment}</h3>
          <div className="mt-4 space-y-4">
            <label className="block">
              <span className="mb-1.5 block text-[12px] font-black uppercase tracking-[0.08em]">{copy.paymentReference} · {copy.optional}</span>
              <input name="paymentReference" maxLength={140} className={eventInput} />
            </label>
            <label className="block">
              <span className="mb-1.5 block text-[12px] font-black uppercase tracking-[0.08em]">{copy.receipt}</span>
              <input name="receipt" type="file" required accept="application/pdf,image/jpeg,image/png,image/webp" className={cn(eventInput, "file:mr-3 file:rounded-lg file:border-0 file:bg-black file:px-3 file:py-1.5 file:font-bold file:text-white")} />
            </label>
            <button className={eventPrimaryButton} type="submit" disabled={pending}><span>{pending ? copy.loading : copy.submitPayment}</span></button>
          </div>
        </form>
      ) : null}

      {ticket.cashPaymentDeadline ? (
        <div className="rounded-xl border border-black bg-white p-3 text-[13px] font-bold">{copy.cashPaymentDeadline}: {formatDateTime(ticket.cashPaymentDeadline)}</div>
      ) : null}
      {ticket.ticketStatus === "pending" && ticket.paymentMethod === "cash" && ticket.paymentStatus === "pending" && !ticket.cashPaymentDeadline ? (
        <p className="rounded-xl border border-black bg-white p-3 text-[13px] font-bold">{copy.cashAwaitingArrangement}</p>
      ) : null}
      {ticket.receiptAvailable ? <a href={`/api/events/tickets/${ticket.id}/receipt`} target="_blank" rel="noreferrer" className={eventSecondaryButton}><span>{copy.openReceipt}</span></a> : null}
      {canCancel ? (
        <button
          type="button"
          className={eventSecondaryButton}
          disabled={pending}
          onClick={() => { if (window.confirm(copy.cancelConfirm)) void cancelTicket(); }}
        ><span>{copy.cancelTicket}</span></button>
      ) : null}
      {success ? <p className="rounded-xl border border-black bg-[#ffd400] px-3 py-2 text-[13px] font-bold" role="status">{success}</p> : null}
      {error ? <p className="rounded-xl bg-black px-3 py-2 text-[13px] font-bold text-white" role="alert">{errorLabel(error)}</p> : null}
    </div>
  );
}

export function TicketDetailView({ ticket, serverNow }: { ticket: EventTicketView; serverNow: string }) {
  const { copy, formatCurrency, formatDateTime } = useEventsI18n();
  const { t } = useLanguage();
  return (
    <EventsFrame>
      <Link href="/app/user/tickets" className="mb-5 inline-flex items-center gap-1 text-[13px] font-black hover:underline">
        <span className="material-symbols-outlined text-[18px]" aria-hidden="true">arrow_back</span>{copy.backToTickets}
      </Link>
      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_360px]">
        <div className="min-w-0">
          <div className="overflow-hidden rounded-2xl border-2 border-black bg-white shadow-[5px_5px_0_#000]">
            {ticket.eventCoverImageUrl ? <div className="aspect-[16/7] bg-[#ffd400]"><img src={ticket.eventCoverImageUrl} alt="" className="h-full w-full object-cover" /></div> : null}
            <div className="p-5 sm:p-6">
              <div className="flex flex-wrap gap-2"><EventStatusPill status={ticket.ticketStatus} /><EventStatusPill status={ticket.paymentStatus} /></div>
              <p className="mt-4 text-[12px] font-black uppercase tracking-[0.1em] text-black/50">{ticket.clubName}</p>
              <h1 className="mt-1 break-words text-[clamp(28px,6vw,44px)] font-black leading-none tracking-[-0.04em]">{ticket.eventTitle}</h1>
              <div className="mt-5 grid gap-x-6 sm:grid-cols-2">
                <TicketFact label={copy.dateAndTime}>{formatDateTime(ticket.startAt)}</TicketFact>
                <TicketFact label={copy.location}>{ticket.location}</TicketFact>
                <TicketFact label={copy.payment}>{ticket.amount > 0 ? formatCurrency(ticket.amount, ticket.currency) : copy.free}</TicketFact>
                <TicketFact label={copy.payment}>{ticket.paymentMethod ? <EventStatusPill status={ticket.paymentMethod} /> : "—"}</TicketFact>
                {ticket.checkedInAt ? <TicketFact label={copy.checkedInAt}>{formatDateTime(ticket.checkedInAt)}</TicketFact> : null}
              </div>
              {ticket.clarificationMessage ? <div className="mt-4 rounded-xl border-2 border-black bg-[#ffd400] p-4"><p className="text-[12px] font-black uppercase">{copy.clarification}</p><p className="mt-2 whitespace-pre-wrap text-[14px] leading-6">{ticket.clarificationMessage}</p></div> : null}
            </div>
          </div>
        </div>
        <aside className="space-y-4 lg:sticky lg:top-8 lg:self-start">
          {ticket.reservationExpiresAt && ticket.reservationStatus === "active" ? <ReservationTimer expiresAt={ticket.reservationExpiresAt} serverNow={serverNow} /> : null}
          <TicketPaymentActions ticket={ticket} />
          {ticket.ticketStatus === "active" ? (
            <Link href="/app/user/pass" className={cn(eventPrimaryButton, "w-full")}>
              <span className="material-symbols-outlined text-[19px]" aria-hidden="true">qr_code_2</span>
              <span>{t("social.showQr")}</span>
            </Link>
          ) : null}
          <Link href={`/app/user/events/${ticket.eventSlug}`} className={cn(eventSecondaryButton, "w-full")}><span>{copy.viewEvent}</span></Link>
        </aside>
      </div>
    </EventsFrame>
  );
}
