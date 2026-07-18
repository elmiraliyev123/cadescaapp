"use client";

import { useActionState } from "react";

import {
  featureEventAction,
  reviewEventAction,
  type AdminEventActionState
} from "@/app/app/admin/events/actions";
import {
  EventEmptyState,
  EventStatusPill,
  EventsFrame,
  EventsHeader,
  eventInput,
  eventPrimaryButton,
  eventSecondaryButton
} from "@/components/events/EventPrimitives";
import type { EventDiscoveryItem } from "@/lib/events/types";
import { useEventsI18n } from "@/lib/events/localization";
import type { Language } from "@/lib/i18n";

const EMPTY_ACTION_STATE: AdminEventActionState = { ok: false, message: "" };

const feedbackCopy: Record<Language, {
  saving: string;
  reviewSaved: string;
  featureSaved: string;
}> = {
  en: { saving: "Saving…", reviewSaved: "The moderation decision was saved.", featureSaved: "Featured placement was updated." },
  az: { saving: "Saxlanılır…", reviewSaved: "Moderasiya qərarı saxlanıldı.", featureSaved: "Seçilmiş yerləşdirmə yeniləndi." },
  tr: { saving: "Kaydediliyor…", reviewSaved: "Moderasyon kararı kaydedildi.", featureSaved: "Öne çıkarılan yerleşim güncellendi." },
  ru: { saving: "Сохранение…", reviewSaved: "Решение модерации сохранено.", featureSaved: "Размещение в рекомендациях обновлено." }
};

function ActionFeedback({ state, success }: { state: AdminEventActionState; success: string }) {
  const { errorLabel } = useEventsI18n();
  if (!state.message) return null;
  return (
    <p
      role={state.ok ? "status" : "alert"}
      className={`mt-3 rounded-lg px-3 py-2 text-[12px] font-bold ${state.ok ? "border border-black bg-[#ffd400] text-black" : "bg-black text-white"}`}
    >
      {state.ok ? success : errorLabel(state.message)}
    </p>
  );
}

function AdminEventCard({ event }: { event: EventDiscoveryItem }) {
  const { copy, formatCurrency, formatDateTime, language } = useEventsI18n();
  const feedback = feedbackCopy[language];
  const [reviewState, reviewFormAction, reviewPending] = useActionState(reviewEventAction, EMPTY_ACTION_STATE);
  const [featureState, featureFormAction, featurePending] = useActionState(featureEventAction, EMPTY_ACTION_STATE);

  return (
    <article className="overflow-hidden rounded-2xl border-2 border-black bg-white shadow-[4px_4px_0_#ffd400]">
      <div className="grid lg:grid-cols-[220px_minmax(0,1fr)]">
        <div className="min-h-[180px] bg-[#ffd400]">
          {event.coverImageUrl ? (
            // This authenticated proxy URL intentionally bypasses a shared image cache.
            // eslint-disable-next-line @next/next/no-img-element
            <img src={event.coverImageUrl} alt="" className="h-full w-full object-cover" />
          ) : (
            <div className="flex h-full min-h-[180px] items-center justify-center">
              <span className="material-symbols-outlined text-[56px]" aria-hidden="true">event</span>
            </div>
          )}
        </div>
        <div className="min-w-0 p-4 sm:p-5">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="text-[11px] font-black uppercase tracking-[0.09em] text-black/50">{event.clubName}</p>
              <h2 className="mt-1 break-words text-[22px] font-black leading-7">{event.title}</h2>
            </div>
            <div className="flex flex-wrap gap-2">
              <EventStatusPill status={event.status} />
              <EventStatusPill status={event.featuredStatus} />
            </div>
          </div>
          <p className="mt-3 line-clamp-3 text-[13px] leading-5 text-black/65">{event.description}</p>
          <div className="mt-4 grid gap-2 border-y border-black/10 py-3 text-[12px] font-bold text-black/65 sm:grid-cols-3">
            <p>{formatDateTime(event.startAt)}</p>
            <p>{event.location}</p>
            <p>{event.isFree ? copy.free : formatCurrency(event.ticketPrice, event.currency)}</p>
          </div>

          {event.status === "pending_review" ? (
            <div className="mt-4 grid gap-4 xl:grid-cols-2">
              <form action={reviewFormAction} className="rounded-xl border border-black bg-[#fffaf0] p-3">
                <input type="hidden" name="eventId" value={event.id} />
                <input type="hidden" name="action" value="approve" />
                <button type="submit" disabled={reviewPending} aria-busy={reviewPending} className={eventPrimaryButton}>
                  <span>{reviewPending ? feedback.saving : copy.approve}</span>
                </button>
              </form>
              <form action={reviewFormAction} className="rounded-xl border border-black bg-[#fffaf0] p-3">
                <input type="hidden" name="eventId" value={event.id} />
                <input type="hidden" name="action" value="reject" />
                <textarea name="reason" required minLength={2} maxLength={1000} rows={2} placeholder={copy.rejectionReason} className={eventInput} />
                <button type="submit" disabled={reviewPending} aria-busy={reviewPending} className={`${eventSecondaryButton} mt-2`}>
                  <span>{reviewPending ? feedback.saving : copy.reject}</span>
                </button>
              </form>
              <div className="xl:col-span-2">
                <ActionFeedback state={reviewState} success={feedback.reviewSaved} />
              </div>
            </div>
          ) : null}

          {event.status === "published" ? (
            <form action={featureFormAction} className="mt-4 rounded-xl border border-black bg-[#fffaf0] p-3">
              <div className="flex flex-col gap-2 sm:flex-row sm:items-end">
                <input type="hidden" name="eventId" value={event.id} />
                <input type="hidden" name="featured" value={event.featuredStatus === "approved" ? "false" : "true"} />
                {event.featuredStatus !== "approved" ? (
                  <label className="min-w-0 flex-1">
                    <span className="mb-1 block text-[11px] font-black uppercase">{copy.featureUntil}</span>
                    <input type="datetime-local" name="featuredUntil" className={eventInput} />
                  </label>
                ) : null}
                <button
                  type="submit"
                  disabled={featurePending}
                  aria-busy={featurePending}
                  className={event.featuredStatus === "approved" ? eventSecondaryButton : eventPrimaryButton}
                >
                  <span>{featurePending ? feedback.saving : event.featuredStatus === "approved" ? copy.removeFeature : copy.featureEvent}</span>
                </button>
              </div>
              <ActionFeedback state={featureState} success={feedback.featureSaved} />
            </form>
          ) : null}
        </div>
      </div>
    </article>
  );
}

export function AdminEventsModerationView({ events }: { events: EventDiscoveryItem[] }) {
  const { copy } = useEventsI18n();
  const pendingCount = events.filter((event) => event.status === "pending_review").length;

  return (
    <EventsFrame className="max-w-none">
      <EventsHeader
        eyebrow={`${pendingCount} ${copy.pendingReview}`}
        title={copy.adminEvents}
        description={copy.adminEventsDescription}
      />
      {events.length ? (
        <div className="space-y-5">
          {events.map((event) => <AdminEventCard key={event.id} event={event} />)}
        </div>
      ) : <EventEmptyState text={copy.noModerationEvents} />}
    </EventsFrame>
  );
}
