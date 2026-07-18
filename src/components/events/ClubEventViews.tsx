"use client";

import Link from "next/link";
import { useActionState, useState } from "react";
import { useRouter } from "next/navigation";

import {
  assignScannerToEventAction,
  cancelClubEventAction,
  createEventDraftAction,
  inviteClubMemberAction,
  revokeClubMembershipAction,
  revokeScannerFromEventAction,
  submitEventForReviewAction,
  updateEventDraftAction,
  type ClubActionState
} from "@/app/app/club/actions";
import { ApprovedClubProfileForm } from "@/components/clubs/ApprovedClubProfileForm";
import {
  ClubEventNav,
  EventCard,
  EventEmptyState,
  EventMetric,
  EventsFrame,
  EventsHeader,
  EventStatusPill,
  eventInput,
  eventPrimaryButton,
  eventSecondaryButton
} from "@/components/events/EventPrimitives";
import type {
  ClubDashboard,
  ClubEventAttendee,
  ClubEventOperations,
  ClubEventSummary,
  ClubFinanceTicket,
  ClubRole,
  ScannerAssignedEvent
} from "@/lib/events/types";
import {
  canManageClubEvents,
  canManageClubFinance,
  canScanClubEvents
} from "@/lib/events/permissions";
import { useEventsI18n } from "@/lib/events/localization";
import type { Language } from "@/lib/i18n";
import { cn } from "@/lib/utils";

const emptyActionState: ClubActionState = { ok: false, message: "" };

type ClubDashboardPresentation = Pick<ClubDashboard, "roles" | "members" | "events" | "analytics"> & {
  club: Pick<
    ClubDashboard["club"],
    | "id"
    | "name"
    | "status"
    | "description"
    | "logoUrl"
    | "contactEmail"
    | "websiteUrl"
    | "instagramUrl"
    | "universityPageUrl"
    | "updatedAt"
  >;
};

type ClubWorkspacePresentation = {
  clubId: string;
  clubName: string;
  roles: ClubRole[];
};

const clubManagementCopy: Record<Language, {
  inviteMember: string;
  accountIdentifier: string;
  revokeAccess: string;
  attendees: string;
  noAttendees: string;
  requestedAt: string;
  notCheckedIn: string;
  scannerAssignments: string;
  assign: string;
  removeAssignment: string;
  noScanners: string;
  auditLog: string;
  noAudit: string;
  clubActivity: string;
  eventActivity: string;
  ticketActivity: string;
  paymentActivity: string;
  entryActivity: string;
  memberActivity: string;
  activity: string;
  saving: string;
  memberInvited: string;
  memberRevoked: string;
  scannerAssigned: string;
  scannerRevoked: string;
  eventSubmitted: string;
  eventCancelled: string;
}> = {
  en: { inviteMember: "Invite member", accountIdentifier: "Username or university email", revokeAccess: "Revoke access", attendees: "Attendees", noAttendees: "No ticket requests yet.", requestedAt: "Requested", notCheckedIn: "Not checked in", scannerAssignments: "Scanner assignments", assign: "Assign", removeAssignment: "Remove assignment", noScanners: "Add a door-scanner role to a member before assigning this event.", auditLog: "Recent club activity", noAudit: "No activity has been recorded yet.", clubActivity: "Club review activity", eventActivity: "Event activity", ticketActivity: "Ticket activity", paymentActivity: "Payment activity", entryActivity: "Entry activity", memberActivity: "Member and role activity", activity: "Club activity", saving: "Saving…", memberInvited: "The role invitation was sent.", memberRevoked: "The member’s club access was revoked.", scannerAssigned: "Scanner access was assigned for this event.", scannerRevoked: "Scanner access was removed from this event.", eventSubmitted: "The event was sent to Cadesca for review.", eventCancelled: "The event was cancelled and affected tickets were updated." },
  az: { inviteMember: "Üzv dəvət et", accountIdentifier: "İstifadəçi adı və ya universitet e-poçtu", revokeAccess: "Girişi ləğv et", attendees: "İştirakçılar", noAttendees: "Hələ bilet sorğusu yoxdur.", requestedAt: "Sorğu vaxtı", notCheckedIn: "Giriş etməyib", scannerAssignments: "Skaner təyinatları", assign: "Təyin et", removeAssignment: "Təyinatı sil", noScanners: "Bu tədbirə təyin etmək üçün əvvəlcə üzvə giriş skaneri rolu verin.", auditLog: "Son klub fəaliyyəti", noAudit: "Hələ fəaliyyət qeydə alınmayıb.", clubActivity: "Klub yoxlama fəaliyyəti", eventActivity: "Tədbir fəaliyyəti", ticketActivity: "Bilet fəaliyyəti", paymentActivity: "Ödəniş fəaliyyəti", entryActivity: "Giriş fəaliyyəti", memberActivity: "Üzv və rol fəaliyyəti", activity: "Klub fəaliyyəti", saving: "Saxlanılır…", memberInvited: "Rol dəvəti göndərildi.", memberRevoked: "Üzvün klub girişi ləğv edildi.", scannerAssigned: "Bu tədbir üçün skaner girişi təyin edildi.", scannerRevoked: "Bu tədbir üçün skaner girişi silindi.", eventSubmitted: "Tədbir Cadesca yoxlamasına göndərildi.", eventCancelled: "Tədbir ləğv edildi və təsirlənən biletlər yeniləndi." },
  tr: { inviteMember: "Üye davet et", accountIdentifier: "Kullanıcı adı veya üniversite e-postası", revokeAccess: "Erişimi kaldır", attendees: "Katılımcılar", noAttendees: "Henüz bilet talebi yok.", requestedAt: "Talep edildi", notCheckedIn: "Giriş yapmadı", scannerAssignments: "Tarayıcı atamaları", assign: "Ata", removeAssignment: "Atamayı kaldır", noScanners: "Bu etkinliğe atamadan önce üyeye giriş tarayıcısı rolü verin.", auditLog: "Son kulüp etkinliği", noAudit: "Henüz bir etkinlik kaydedilmedi.", clubActivity: "Kulüp inceleme etkinliği", eventActivity: "Etkinlik işlemi", ticketActivity: "Bilet işlemi", paymentActivity: "Ödeme işlemi", entryActivity: "Giriş işlemi", memberActivity: "Üye ve rol işlemi", activity: "Kulüp işlemi", saving: "Kaydediliyor…", memberInvited: "Rol daveti gönderildi.", memberRevoked: "Üyenin kulüp erişimi kaldırıldı.", scannerAssigned: "Bu etkinlik için tarayıcı erişimi atandı.", scannerRevoked: "Bu etkinliğin tarayıcı erişimi kaldırıldı.", eventSubmitted: "Etkinlik Cadesca incelemesine gönderildi.", eventCancelled: "Etkinlik iptal edildi ve etkilenen biletler güncellendi." },
  ru: { inviteMember: "Пригласить участника", accountIdentifier: "Логин или университетская почта", revokeAccess: "Отозвать доступ", attendees: "Участники", noAttendees: "Заявок на билеты пока нет.", requestedAt: "Запрошено", notCheckedIn: "Вход не отмечен", scannerAssignments: "Назначения сканеров", assign: "Назначить", removeAssignment: "Снять назначение", noScanners: "Сначала назначьте участнику роль сканера на входе.", auditLog: "Последние действия клуба", noAudit: "Действий пока не зарегистрировано.", clubActivity: "Проверка клуба", eventActivity: "Действие с событием", ticketActivity: "Действие с билетом", paymentActivity: "Действие с оплатой", entryActivity: "Действие со входом", memberActivity: "Действие с участником или ролью", activity: "Действие клуба", saving: "Сохранение…", memberInvited: "Приглашение на роль отправлено.", memberRevoked: "Доступ участника к клубу отозван.", scannerAssigned: "Доступ сканера к этому событию назначен.", scannerRevoked: "Доступ сканера к этому событию удалён.", eventSubmitted: "Событие отправлено на проверку Cadesca.", eventCancelled: "Событие отменено, связанные билеты обновлены." }
};

function auditActivityLabel(action: string, copy: (typeof clubManagementCopy)[Language]) {
  if (action.includes("payment") || action.includes("cash") || action.includes("refund")) return copy.paymentActivity;
  if (action.includes("scan") || action.includes("entry") || action.includes("qr")) return copy.entryActivity;
  if (action.includes("member") || action.includes("membership") || action.includes("role") || action.includes("scanner_assigned") || action.includes("scanner_revoked")) return copy.memberActivity;
  if (action.includes("ticket") || action.includes("reservation")) return copy.ticketActivity;
  if (action.includes("event") || action.includes("featured")) return copy.eventActivity;
  if (action.includes("club") || action.includes("clarification") || action.includes("otp")) return copy.clubActivity;
  return copy.activity;
}

function visibleClubNavigation(roles: readonly ClubRole[]) {
  const items: Array<"overview" | "events" | "finance" | "scanner"> = [];
  if (canManageClubEvents(roles)) items.push("overview", "events");
  if (canManageClubFinance(roles)) items.push("finance");
  if (canScanClubEvents(roles)) items.push("scanner");
  return items;
}

type ClubMutationAction = (
  previousState: ClubActionState,
  formData: FormData
) => Promise<ClubActionState>;

function ClubMutationForm({
  action,
  children,
  className,
  buttonClassName,
  submitLabel,
  pendingLabel,
  successLabel,
  feedbackClassName,
  confirmMessage,
  submitIcon
}: {
  action: ClubMutationAction;
  children: React.ReactNode;
  className?: string;
  buttonClassName: string;
  submitLabel: string;
  pendingLabel: string;
  successLabel: string;
  feedbackClassName?: string;
  confirmMessage?: string;
  submitIcon?: string;
}) {
  const { errorLabel } = useEventsI18n();
  const [state, formAction, pending] = useActionState(action, emptyActionState);
  return (
    <form
      action={formAction}
      className={className}
      onSubmit={confirmMessage ? (formEvent) => {
        if (!window.confirm(confirmMessage)) formEvent.preventDefault();
      } : undefined}
    >
      {children}
      <button type="submit" disabled={pending} aria-busy={pending} className={buttonClassName}>
        {submitIcon ? <span className="material-symbols-outlined text-[19px]" aria-hidden="true">{submitIcon}</span> : null}
        <span>{pending ? pendingLabel : submitLabel}</span>
      </button>
      {state.message ? (
        <p
          role={state.ok ? "status" : "alert"}
          className={cn(
            "rounded-lg px-3 py-2 text-[12px] font-bold",
            state.ok ? "border border-black bg-[#ffd400] text-black" : "bg-black text-white",
            feedbackClassName
          )}
        >
          {state.ok ? successLabel : errorLabel(state.message)}
        </p>
      ) : null}
    </form>
  );
}

export function ClubDashboardView({ dashboard }: { dashboard: ClubDashboardPresentation }) {
  const { copy, language, statusLabel } = useEventsI18n();
  const management = clubManagementCopy[language];
  const analytics = dashboard.analytics;
  const canManage = canManageClubEvents(dashboard.roles);
  const visibleNavigation = visibleClubNavigation(dashboard.roles);
  return (
    <EventsFrame>
      <ClubEventNav current="overview" visible={visibleNavigation} />
      <EventsHeader
        eyebrow={dashboard.club.name}
        title={copy.clubDashboard}
        description={copy.clubDashboardDescription}
        action={canManage ? <Link href="/app/club/events/new" className={eventPrimaryButton}><span>{copy.createEvent}</span></Link> : undefined}
      />
      <div className="mb-7 flex flex-wrap items-center gap-2">
        <EventStatusPill status={dashboard.club.status} />
        {dashboard.roles.map((role) => <EventStatusPill key={role} status={role} />)}
      </div>
      {dashboard.roles.includes("club_owner") ? <ApprovedClubProfileForm club={dashboard.club} /> : null}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <EventMetric label={copy.requests} value={analytics.totalRequests} icon="confirmation_number" />
        <EventMetric label={copy.activeReservations} value={analytics.activeReservations} icon="timer" />
        {canManageClubFinance(dashboard.roles) ? <EventMetric label={copy.paymentsToReview} value={analytics.paymentUnderReview} icon="payments" /> : null}
        <EventMetric label={copy.checkedIn} value={analytics.checkedInAttendees} icon="how_to_reg" />
        <EventMetric label={copy.approvedTickets} value={analytics.approvedTickets} icon="verified" />
        <EventMetric label={copy.remainingCapacity} value={analytics.remainingCapacity} icon="event_seat" />
        <EventMetric label={copy.checkInRate} value={`${Math.round(analytics.checkInRate * 100)}%`} icon="monitoring" />
        <EventMetric label={copy.conversionRate} value={`${Math.round(analytics.conversionRate * 100)}%`} icon="trending_up" />
      </div>

      <section className="mt-9">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-[22px] font-black">{copy.clubEvents}</h2>
          <Link href="/app/club/events" className={eventSecondaryButton}><span>{copy.viewEvent}</span></Link>
        </div>
        {dashboard.events.length ? (
          <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">
            {dashboard.events.slice(0, 3).map((event) => <EventCard key={event.id} event={event} href={`/app/club/events/${event.id}`} />)}
          </div>
        ) : <EventEmptyState text={copy.noClubEvents} action={canManage ? <Link href="/app/club/events/new" className={eventPrimaryButton}><span>{copy.createEvent}</span></Link> : undefined} />}
      </section>

      {dashboard.roles.includes("club_owner") ? <section className="mt-9">
        <h2 className="mb-4 text-[22px] font-black">{copy.members}</h2>
        <ClubMutationForm
          action={inviteClubMemberAction}
          className="mb-4 grid gap-3 rounded-2xl border-2 border-black bg-[#fffaf0] p-4 sm:grid-cols-[minmax(0,1fr)_minmax(190px,0.45fr)_auto] sm:items-end"
          buttonClassName={eventPrimaryButton}
          submitLabel={management.inviteMember}
          pendingLabel={management.saving}
          successLabel={management.memberInvited}
          feedbackClassName="sm:col-span-3"
        >
          <input type="hidden" name="clubId" value={dashboard.club.id} />
          <Field label={management.accountIdentifier}><input name="usernameOrEmail" required maxLength={254} autoComplete="off" className={eventInput} /></Field>
          <Field label={copy.role}>
            <select name="role" defaultValue="event_organizer" className={eventInput}>
              <option value="event_organizer">{statusLabel("event_organizer")}</option>
              <option value="finance_manager">{statusLabel("finance_manager")}</option>
              <option value="door_scanner">{statusLabel("door_scanner")}</option>
            </select>
          </Field>
        </ClubMutationForm>
        <div className="overflow-x-auto rounded-2xl border-2 border-black bg-white">
          <table className="w-full min-w-[620px] text-left text-[13px]">
            <thead className="bg-black text-white"><tr><th className="px-4 py-3">{copy.student}</th><th className="px-4 py-3">{copy.role}</th><th className="px-4 py-3">{copy.statusText}</th><th className="px-4 py-3">{copy.actions}</th></tr></thead>
            <tbody>
              {dashboard.members.map((member) => (
                <tr key={member.id} className="border-t border-black/10 first:border-t-0">
                  <td className="px-4 py-3 font-bold">{member.displayName}{member.username ? <span className="ml-2 font-normal text-black/50">@{member.username}</span> : null}</td>
                  <td className="px-4 py-3">{statusLabel(member.role)}</td>
                  <td className="px-4 py-3"><EventStatusPill status={member.status} /></td>
                  <td className="px-4 py-3">{member.role !== "club_owner" && (member.status === "active" || member.status === "invited" || member.status === "suspended") ? (
                    <ClubMutationForm
                      action={revokeClubMembershipAction}
                      className="space-y-2"
                      buttonClassName={cn(eventSecondaryButton, "!min-h-9 !px-3 !py-1.5 text-[12px]")}
                      submitLabel={management.revokeAccess}
                      pendingLabel={management.saving}
                      successLabel={management.memberRevoked}
                    >
                      <input type="hidden" name="clubId" value={dashboard.club.id} />
                      <input type="hidden" name="membershipId" value={member.id} />
                    </ClubMutationForm>
                  ) : <span aria-hidden="true">—</span>}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section> : null}
    </EventsFrame>
  );
}

export function ClubEventsListView({ clubName, roles, events }: { clubName: string; roles: ClubRole[]; events: ClubEventSummary[] }) {
  const { copy } = useEventsI18n();
  const canManage = canManageClubEvents(roles);
  return (
    <EventsFrame>
      <ClubEventNav current="events" visible={visibleClubNavigation(roles)} />
      <EventsHeader eyebrow={clubName} title={copy.clubEvents} action={canManage ? <Link href="/app/club/events/new" className={eventPrimaryButton}><span>{copy.createEvent}</span></Link> : undefined} />
      {events.length ? (
        <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">
          {events.map((event) => <EventCard key={event.id} event={event} href={`/app/club/events/${event.id}`} />)}
        </div>
      ) : <EventEmptyState text={copy.noClubEvents} action={canManage ? <Link href="/app/club/events/new" className={eventPrimaryButton}><span>{copy.createEvent}</span></Link> : undefined} />}
    </EventsFrame>
  );
}

function toLocalInput(value: string | undefined, fallbackHours: number) {
  const date = value ? new Date(value) : new Date(Date.now() + fallbackHours * 60 * 60 * 1000);
  const offset = date.getTimezoneOffset() * 60_000;
  return new Date(date.getTime() - offset).toISOString().slice(0, 16);
}

function localInputToIso(value: string) {
  const parsed = new Date(value);
  return Number.isFinite(parsed.getTime()) ? parsed.toISOString() : "";
}

function Field({ label, children, className }: { label: string; children: React.ReactNode; className?: string }) {
  return <label className={cn("block", className)}><span className="mb-1.5 block text-[11px] font-black uppercase tracking-[0.08em] text-black/60">{label}</span>{children}</label>;
}

function OrganizerTicketActions({ attendee }: { attendee: ClubEventAttendee }) {
  const router = useRouter();
  const { copy, errorLabel } = useEventsI18n();
  const [message, setMessage] = useState("");
  const [deadline, setDeadline] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const canArrangeCash = attendee.paymentMethod === "cash"
    && attendee.paymentStatus === "pending"
    && attendee.ticketStatus === "pending"
    && attendee.reservationStatus === "active"
    && !attendee.cashPaymentDeadline;
  const canReviewFree = attendee.paymentMethod === "free"
    && attendee.paymentStatus === "not_required"
    && attendee.requestStatus === "pending"
    && attendee.ticketStatus === "pending";

  async function mutate(endpoint: "cash" | "review", body: Record<string, string | null>) {
    setPending(true);
    setError(null);
    try {
      const response = await fetch(`/api/events/tickets/${encodeURIComponent(attendee.ticketId)}/${endpoint}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body)
      });
      const payload = await response.json().catch(() => ({})) as { error?: string };
      if (!response.ok) throw new Error(payload.error || "generic");
      router.refresh();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "generic");
    } finally {
      setPending(false);
    }
  }

  if (!canArrangeCash && !canReviewFree) return <span aria-hidden="true">—</span>;

  return (
    <div className="min-w-[250px] space-y-2">
      {canArrangeCash ? (
        <>
          <label className="block">
            <span className="mb-1 block text-[10px] font-black uppercase tracking-[0.08em] text-black/55">{copy.cashPaymentDeadline} · {copy.optional}</span>
            <input type="datetime-local" value={deadline} onChange={(event) => setDeadline(event.target.value)} className={cn(eventInput, "!min-h-9 !py-1.5 text-[12px]")} />
          </label>
          <p className="text-[10px] leading-4 text-black/55">{copy.cashDeadlineHelp}</p>
          <button type="button" disabled={pending} onClick={() => void mutate("cash", { deadline: deadline ? localInputToIso(deadline) : null })} className={cn(eventPrimaryButton, "!min-h-9 !px-3 !py-1.5 text-[12px]")}><span>{copy.arrangeCash}</span></button>
        </>
      ) : null}
      {canReviewFree ? (
        <>
          <textarea value={message} onChange={(event) => setMessage(event.target.value)} placeholder={copy.reviewMessage} rows={2} maxLength={1000} className={cn(eventInput, "!min-h-0 !py-2 text-[12px]")} />
          <div className="flex flex-wrap gap-2">
            <button type="button" disabled={pending} onClick={() => void mutate("review", { action: "approve_free", message: null })} className={cn(eventPrimaryButton, "!min-h-9 !px-3 !py-1.5 text-[12px]")}><span>{copy.approveFree}</span></button>
            <button type="button" disabled={pending || !message.trim()} onClick={() => void mutate("review", { action: "reject", message })} className={cn(eventSecondaryButton, "!min-h-9 !px-3 !py-1.5 text-[12px]")}><span>{copy.reject}</span></button>
          </div>
        </>
      ) : null}
      {error ? <p className="rounded-lg bg-black px-2 py-1.5 text-[11px] font-bold text-white" role="alert">{errorLabel(error)}</p> : null}
    </div>
  );
}

export function ClubEventForm({
  workspace,
  event
}: {
  workspace: ClubWorkspacePresentation;
  event?: ClubEventSummary;
}) {
  const { copy, errorLabel, statusLabel } = useEventsI18n();
  const isEdit = Boolean(event);
  const action = isEdit ? updateEventDraftAction : createEventDraftAction;
  const [state, formAction, pending] = useActionState(action, emptyActionState);
  const [isFree, setIsFree] = useState(event?.isFree ?? false);
  const [bankEnabled, setBankEnabled] = useState(event?.bankTransferEnabled ?? true);
  const [startLocal, setStartLocal] = useState(() => toLocalInput(event?.startAt, 72));
  const [endLocal, setEndLocal] = useState(() => toLocalInput(event?.endAt, 75));
  const [deadlineLocal, setDeadlineLocal] = useState(() => toLocalInput(event?.ticketRequestDeadline, 48));
  const visibleNavigation = visibleClubNavigation(workspace.roles);

  return (
    <EventsFrame>
      <ClubEventNav current="events" visible={visibleNavigation} />
      <EventsHeader eyebrow={workspace.clubName} title={isEdit ? copy.editEvent : copy.createEvent} description={copy.eventFormDescription} />
      <form action={formAction} className="rounded-2xl border-2 border-black bg-white p-4 shadow-[5px_5px_0_#ffd400] sm:p-6">
        <input type="hidden" name="clubId" value={workspace.clubId} />
        <input type="hidden" name="startAt" value={localInputToIso(startLocal)} />
        <input type="hidden" name="endAt" value={localInputToIso(endLocal)} />
        <input type="hidden" name="ticketRequestDeadline" value={localInputToIso(deadlineLocal)} />
        {event ? <input type="hidden" name="eventId" value={event.id} /> : null}
        <div className="grid gap-5 md:grid-cols-2">
          <Field label={copy.title} className="md:col-span-2"><input name="title" required minLength={3} maxLength={140} defaultValue={event?.title} className={eventInput} /></Field>
          <Field label={copy.description} className="md:col-span-2"><textarea name="description" required minLength={20} maxLength={10000} rows={7} defaultValue={event?.description} className={eventInput} /></Field>
          <Field label={copy.location}><input name="location" required maxLength={240} defaultValue={event?.location} className={eventInput} /></Field>
          <Field label={copy.venueDetails}><input name="venueDetails" maxLength={500} defaultValue={event?.venueDetails || ""} className={eventInput} /></Field>
          <Field label={copy.start}><input type="datetime-local" required value={startLocal} onChange={(e) => setStartLocal(e.target.value)} className={eventInput} /></Field>
          <Field label={copy.end}><input type="datetime-local" required value={endLocal} onChange={(e) => setEndLocal(e.target.value)} className={eventInput} /></Field>
          <Field label={copy.requestDeadline}><input type="datetime-local" required value={deadlineLocal} onChange={(e) => setDeadlineLocal(e.target.value)} className={eventInput} /></Field>
          <Field label={copy.timezone}><input name="timezone" required defaultValue={event?.timezone || "Europe/Istanbul"} className={eventInput} /></Field>
          <Field label={copy.capacity}><input type="number" name="capacity" required min={1} max={100000} defaultValue={event?.capacity || 100} className={eventInput} /></Field>
          <Field label={copy.ageRequirement}><input type="number" name="ageRequirement" min={0} max={99} defaultValue={event?.ageRequirement ?? ""} className={eventInput} /></Field>
          <label className="flex min-h-12 items-center gap-3 rounded-xl border border-black bg-[#fffaf0] px-4 py-3 text-[14px] font-bold md:col-span-2">
            <input type="checkbox" name="isFree" value="true" checked={isFree} onChange={(e) => setIsFree(e.target.checked)} className="h-4 w-4 accent-black" />{copy.isFree}
          </label>
          {!isFree ? (
            <>
              <Field label={copy.price}><input type="number" name="ticketPrice" required min={0.01} step="0.01" defaultValue={event?.ticketPrice || ""} className={eventInput} /></Field>
              <Field label={copy.currency}><input name="currency" required minLength={3} maxLength={3} defaultValue={event?.currency || "TRY"} className={eventInput} /></Field>
              <label className="flex min-h-12 items-center gap-3 rounded-xl border border-black bg-[#fffaf0] px-4 py-3 text-[14px] font-bold"><input type="checkbox" name="bankTransferEnabled" value="true" checked={bankEnabled} onChange={(e) => setBankEnabled(e.target.checked)} className="h-4 w-4 accent-black" />{copy.allowBankTransfer}</label>
              <label className="flex min-h-12 items-center gap-3 rounded-xl border border-black bg-[#fffaf0] px-4 py-3 text-[14px] font-bold"><input type="checkbox" name="cashPaymentEnabled" value="true" defaultChecked={event?.cashPaymentEnabled ?? false} className="h-4 w-4 accent-black" />{copy.allowCash}</label>
              {bankEnabled ? (
                <>
                  <Field label={copy.iban}><input name="iban" required defaultValue={event?.iban || ""} className={eventInput} /></Field>
                  <Field label={copy.accountName}><input name="ibanAccountName" required defaultValue={event?.ibanAccountName || ""} className={eventInput} /></Field>
                </>
              ) : null}
            </>
          ) : (
            <Field label={copy.approvalMode} className="md:col-span-2"><select name="freeTicketMode" defaultValue={event?.freeTicketMode || "automatic"} className={eventInput}><option value="automatic">{statusLabel("automatic")}</option><option value="organizer_approval">{statusLabel("organizer_approval")}</option></select></Field>
          )}
          <Field label={copy.paymentNotes} className="md:col-span-2"><textarea name="paymentInstructions" rows={3} defaultValue={event?.paymentInstructions || ""} className={eventInput} /></Field>
          <Field label={copy.refundPolicy} className="md:col-span-2"><textarea name="refundPolicy" required minLength={5} maxLength={2000} rows={4} defaultValue={event?.refundPolicy} className={eventInput} /></Field>
          <Field label={copy.coverImage} className="md:col-span-2"><input type="file" name="cover" required={!isEdit || !event?.coverImageUrl} accept="image/jpeg,image/png,image/webp,image/avif" className={cn(eventInput, "file:mr-3 file:rounded-lg file:border-0 file:bg-black file:px-3 file:py-1.5 file:font-bold file:text-white")} /></Field>
        </div>
        {state.message ? <p className={cn("mt-5 rounded-xl px-3 py-2 text-[13px] font-bold", state.ok ? "border border-black bg-[#ffd400] text-black" : "bg-black text-white")} role={state.ok ? "status" : "alert"}>{state.ok ? copy.draftSaved : errorLabel(state.message)}</p> : null}
        <div className="mt-6 flex flex-wrap gap-3">
          <button type="submit" disabled={pending} className={eventPrimaryButton}><span>{pending ? copy.loading : copy.saveDraft}</span></button>
          {state.ok && state.eventId ? <Link href={`/app/club/events/${state.eventId}`} className={eventSecondaryButton}><span>{copy.viewEvent}</span></Link> : null}
          <Link href="/app/club/events" className={eventSecondaryButton}><span>{copy.clubEvents}</span></Link>
        </div>
      </form>
    </EventsFrame>
  );
}

export function ClubEventManageView({ workspace, event, operations }: { workspace: ClubWorkspacePresentation; event: ClubEventSummary; operations: ClubEventOperations }) {
  const { copy, language, formatDateTime, formatCurrency } = useEventsI18n();
  const management = clubManagementCopy[language];
  const canManage = canManageClubEvents(workspace.roles);
  const canSubmit = canManage && event.status === "draft";
  const canEdit = canManage && (event.status === "draft" || event.status === "rejected");
  const canCancel = canManage && (["draft", "pending_review", "published", "sold_out", "rejected"] as const).includes(
    event.status as "draft" | "pending_review" | "published" | "sold_out" | "rejected"
  );
  return (
    <EventsFrame>
      <ClubEventNav current="events" visible={visibleClubNavigation(workspace.roles)} />
      <EventsHeader
        eyebrow={workspace.clubName}
        title={event.title}
        description={`${formatDateTime(event.startAt)} · ${event.location}`}
        action={<>{canEdit ? <Link href={`/app/club/events/${event.id}/edit`} className={eventSecondaryButton}><span>{copy.edit}</span></Link> : null}{event.status === "published" || event.status === "sold_out" ? <Link href={`/event/${event.slug}`} className={eventPrimaryButton}><span>{copy.viewEvent}</span></Link> : null}</>}
      />
      <div className="mb-6 flex flex-wrap gap-2"><EventStatusPill status={event.status} /><EventStatusPill status={event.featuredStatus} /></div>
      <div className="grid gap-4 sm:grid-cols-3">
        <EventMetric label={copy.requests} value={event.requestCount} icon="confirmation_number" />
        <EventMetric label={copy.approvedTickets} value={event.approvedCount} icon="verified" />
        <EventMetric label={copy.checkedIn} value={event.checkedInCount} icon="how_to_reg" />
      </div>
      <div className="mt-6 rounded-2xl border-2 border-black bg-white p-5">
        <p className="whitespace-pre-wrap text-[14px] leading-6 text-black/70">{event.description}</p>
        <div className="mt-5 grid gap-3 border-t border-black/10 pt-5 sm:grid-cols-2">
          <p><strong>{copy.capacity}:</strong> {event.capacity}</p>
          <p><strong>{copy.payment}:</strong> {event.isFree ? copy.free : formatCurrency(event.ticketPrice, event.currency)}</p>
          <p><strong>{copy.ticketDeadline}:</strong> {formatDateTime(event.ticketRequestDeadline)}</p>
          <p><strong>{copy.location}:</strong> {event.location}</p>
        </div>
      </div>
      <section className="mt-8">
        <h2 className="mb-4 text-[22px] font-black">{management.attendees}</h2>
        {operations.attendees.length ? <div className="overflow-x-auto rounded-2xl border-2 border-black bg-white">
          <table className="w-full min-w-[980px] text-left text-[13px]">
            <thead className="bg-black text-white"><tr><th className="px-4 py-3">{copy.student}</th><th className="px-4 py-3">{copy.statusText}</th><th className="px-4 py-3">{copy.payment}</th><th className="px-4 py-3">{management.requestedAt}</th><th className="px-4 py-3">{copy.checkedIn}</th><th className="px-4 py-3">{copy.actions}</th></tr></thead>
            <tbody>{operations.attendees.map((attendee) => <tr key={attendee.ticketId} className="border-t border-black/10 first:border-t-0">
              <td className="px-4 py-3 font-bold">{attendee.displayName}{attendee.username ? <span className="ml-2 font-normal text-black/50">@{attendee.username}</span> : null}</td>
              <td className="px-4 py-3"><div className="flex flex-wrap gap-1.5"><EventStatusPill status={attendee.requestStatus} /><EventStatusPill status={attendee.ticketStatus} /></div></td>
              <td className="px-4 py-3"><div className="flex flex-wrap gap-1.5">{attendee.paymentMethod ? <EventStatusPill status={attendee.paymentMethod} /> : null}<EventStatusPill status={attendee.paymentStatus} /></div>{attendee.cashPaymentDeadline ? <p className="mt-1.5 text-[11px] font-bold text-black/55">{copy.cashPaymentDeadline}: {formatDateTime(attendee.cashPaymentDeadline)}</p> : null}</td>
              <td className="px-4 py-3 text-black/65">{formatDateTime(attendee.requestedAt)}</td>
              <td className="px-4 py-3 text-black/65">{attendee.checkedInAt ? formatDateTime(attendee.checkedInAt) : management.notCheckedIn}</td>
              <td className="px-4 py-3"><OrganizerTicketActions attendee={attendee} /></td>
            </tr>)}</tbody>
          </table>
        </div> : <EventEmptyState text={management.noAttendees} />}
      </section>
      <section className="mt-8">
        <h2 className="mb-4 text-[22px] font-black">{management.scannerAssignments}</h2>
        {operations.scanners.length ? <div className="grid gap-3 md:grid-cols-2">{operations.scanners.map((scanner) => (
          <article key={scanner.membershipId} className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border-2 border-black bg-white p-4">
            <div><p className="font-black">{scanner.displayName}</p>{scanner.username ? <p className="text-[12px] text-black/55">@{scanner.username}</p> : null}</div>
            <ClubMutationForm
              action={scanner.assigned ? revokeScannerFromEventAction : assignScannerToEventAction}
              className="space-y-2"
              buttonClassName={scanner.assigned ? eventSecondaryButton : eventPrimaryButton}
              submitLabel={scanner.assigned ? management.removeAssignment : management.assign}
              pendingLabel={management.saving}
              successLabel={scanner.assigned ? management.scannerRevoked : management.scannerAssigned}
            >
              <input type="hidden" name="eventId" value={event.id} />
              <input type="hidden" name="scannerUserId" value={scanner.userId} />
            </ClubMutationForm>
          </article>
        ))}</div> : <EventEmptyState text={management.noScanners} />}
      </section>
      {operations.audit.length ? <section className="mt-8">
        <h2 className="mb-4 text-[22px] font-black">{management.auditLog}</h2>
        <div className="divide-y divide-black/10 overflow-hidden rounded-2xl border-2 border-black bg-white">{operations.audit.map((entry) => (
          <div key={entry.id} className="flex flex-wrap items-center justify-between gap-3 px-4 py-3 text-[13px]">
            <div><p className="font-black">{auditActivityLabel(entry.action, management)}</p>{entry.actorDisplayName ? <p className="text-black/55">{entry.actorDisplayName}</p> : null}</div>
            <time className="font-bold text-black/55" dateTime={entry.createdAt}>{formatDateTime(entry.createdAt)}</time>
          </div>
        ))}</div>
      </section> : workspace.roles.includes("club_owner") ? <EventEmptyState text={management.noAudit} /> : null}
      {canSubmit ? (
        <ClubMutationForm
          action={submitEventForReviewAction}
          className="mt-6 space-y-4 rounded-2xl border-2 border-black bg-[#ffd400] p-5"
          buttonClassName={eventSecondaryButton}
          submitLabel={copy.submitForReview}
          pendingLabel={management.saving}
          successLabel={management.eventSubmitted}
        >
          <input type="hidden" name="eventId" value={event.id} />
          <p className="text-[14px] font-bold leading-6">{copy.eventFormDescription}</p>
        </ClubMutationForm>
      ) : null}
      {canCancel ? (
        <section className="mt-8 border-t-2 border-dashed border-black pt-6">
          <div className="rounded-2xl border-2 border-black bg-white p-5">
            <h2 className="text-[18px] font-black">{copy.cancelEvent}</h2>
            <p className="mt-2 max-w-2xl text-[13px] leading-5 text-black/65">{copy.cancelEventConfirm}</p>
            <ClubMutationForm
              action={cancelClubEventAction}
              className="mt-4 space-y-3"
              buttonClassName={cn(eventSecondaryButton, "!bg-black !text-white hover:!bg-black/80")}
              submitLabel={copy.cancelEvent}
              pendingLabel={management.saving}
              successLabel={management.eventCancelled}
              confirmMessage={copy.cancelEventConfirm}
              submitIcon="event_busy"
            >
              <input type="hidden" name="eventId" value={event.id} />
            </ClubMutationForm>
          </div>
        </section>
      ) : null}
    </EventsFrame>
  );
}

type FinanceAction = "approve" | "reject" | "clarify" | "confirm_cash" | "approve_free" | "refund";

function FinanceTicketRow({ ticket, roles }: { ticket: ClubFinanceTicket; roles: ClubRole[] }) {
  const router = useRouter();
  const { copy, errorLabel, formatCurrency, formatDateTime } = useEventsI18n();
  const [message, setMessage] = useState("");
  const [deadline, setDeadline] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function review(action: FinanceAction) {
    setPending(true);
    setError(null);
    try {
      const response = await fetch(`/api/events/tickets/${encodeURIComponent(ticket.id)}/review`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action, message })
      });
      const payload = await response.json().catch(() => ({})) as { error?: string };
      if (!response.ok) throw new Error(payload.error || "generic");
      router.refresh();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "generic");
    } finally {
      setPending(false);
    }
  }

  async function arrangeCash() {
    setPending(true);
    setError(null);
    try {
      const response = await fetch(`/api/events/tickets/${encodeURIComponent(ticket.id)}/cash`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ deadline: deadline ? localInputToIso(deadline) : null })
      });
      const payload = await response.json().catch(() => ({})) as { error?: string };
      if (!response.ok) throw new Error(payload.error || "generic");
      router.refresh();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "generic");
    } finally {
      setPending(false);
    }
  }

  const canManageFree = roles.includes("club_owner") || roles.includes("event_organizer");
  const canArrangeCash = ticket.paymentMethod === "cash"
    && ticket.paymentStatus === "pending"
    && ticket.ticketStatus === "pending"
    && ticket.reservationStatus === "active"
    && !ticket.cashPaymentDeadline;
  const actions: Array<{ value: FinanceAction; label: string }> = ticket.refundRequiredAt && ticket.amount > 0
    ? [{ value: "refund", label: copy.refund }]
    : ticket.paymentStatus === "approved" && ticket.amount > 0
    ? [{ value: "refund", label: copy.refund }]
    : ticket.paymentStatus === "rejected" || ticket.paymentStatus === "refunded" || !["pending", "revoked"].includes(ticket.ticketStatus)
      ? []
      : ticket.paymentMethod === "cash"
        ? ticket.reservationStatus === "held_for_review" && Boolean(ticket.cashPaymentDeadline)
          ? [{ value: "confirm_cash", label: copy.confirmCash }, { value: "reject", label: copy.reject }]
          : []
        : ticket.paymentMethod === "free"
          ? canManageFree && ticket.requestStatus === "pending"
            ? [{ value: "approve_free", label: copy.approveFree }, { value: "reject", label: copy.reject }]
            : []
          : ticket.paymentStatus === "under_review"
            ? [{ value: "approve", label: copy.approve }, { value: "reject", label: copy.reject }, { value: "clarify", label: copy.requestClarification }]
            : ticket.paymentStatus === "clarification_requested"
              ? [{ value: "approve", label: copy.approve }, { value: "reject", label: copy.reject }]
              : ticket.paymentStatus === "pending"
                ? [{ value: "reject", label: copy.reject }]
                : [];
  const needsMessage = actions.some((action) => action.value === "reject" || action.value === "clarify");

  return (
    <article className="rounded-2xl border-2 border-black bg-white p-4 shadow-[3px_3px_0_#ffd400]">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div><p className="text-[11px] font-black uppercase tracking-[0.08em] text-black/50">{ticket.eventTitle}</p><h3 className="mt-1 text-[17px] font-black">{ticket.studentDisplayName}</h3>{ticket.studentUsername ? <p className="text-[12px] text-black/55">@{ticket.studentUsername}</p> : null}</div>
        <div className="text-right"><p className="text-[18px] font-black">{ticket.amount ? formatCurrency(ticket.amount, ticket.currency) : copy.free}</p><div className="mt-1 flex flex-wrap justify-end gap-1"><EventStatusPill status={ticket.requestStatus} /><EventStatusPill status={ticket.paymentStatus} /><EventStatusPill status={ticket.ticketStatus} /></div></div>
      </div>
      {ticket.submittedPaymentAt ? <p className="mt-3 text-[12px] text-black/65">{copy.submittedAt}: <time dateTime={ticket.submittedPaymentAt} className="font-bold">{formatDateTime(ticket.submittedPaymentAt)}</time></p> : null}
      {ticket.paymentReference ? <p className="mt-3 text-[12px] text-black/65">{copy.paymentReference}: <strong>{ticket.paymentReference}</strong></p> : null}
      {ticket.receiptAvailable ? <a href={`/api/events/tickets/${ticket.id}/receipt`} target="_blank" rel="noreferrer" className={cn(eventSecondaryButton, "mt-3")}><span>{copy.openReceipt}</span></a> : null}
      {ticket.paymentMethod === "bank_transfer" && (ticket.iban || ticket.bankAccountName || ticket.paymentInstructions) ? (
        <div className="mt-3 rounded-xl border border-black/20 bg-[#fffaf0] p-3 text-[12px] leading-5">
          {ticket.bankAccountName ? <p><span className="font-black">{copy.accountName}:</span> {ticket.bankAccountName}</p> : null}
          {ticket.iban ? <p className="mt-1 break-all font-mono"><span className="font-sans font-black">{copy.iban}:</span> {ticket.iban}</p> : null}
          {ticket.paymentInstructions ? <p className="mt-2 whitespace-pre-wrap text-black/65">{ticket.paymentInstructions}</p> : null}
        </div>
      ) : null}
      {ticket.cashPaymentDeadline ? <p className="mt-3 rounded-xl border border-black/20 bg-[#fffaf0] px-3 py-2 text-[12px] font-bold">{copy.cashPaymentDeadline}: {formatDateTime(ticket.cashPaymentDeadline)}</p> : null}
      {canArrangeCash ? <div className="mt-3 rounded-xl border border-black/20 bg-[#fffaf0] p-3">
        <label className="block">
          <span className="mb-1.5 block text-[11px] font-black uppercase tracking-[0.08em] text-black/60">{copy.cashPaymentDeadline} · {copy.optional}</span>
          <input type="datetime-local" value={deadline} onChange={(event) => setDeadline(event.target.value)} className={eventInput} />
        </label>
        <p className="mt-2 text-[11px] leading-4 text-black/55">{copy.cashDeadlineHelp}</p>
        <button type="button" disabled={pending} onClick={() => void arrangeCash()} className={cn(eventPrimaryButton, "mt-3")}><span>{copy.arrangeCash}</span></button>
      </div> : null}
      {needsMessage ? <textarea value={message} onChange={(e) => setMessage(e.target.value)} placeholder={copy.reviewMessage} rows={2} maxLength={1000} className={cn(eventInput, "mt-3")} /> : null}
      <div className="mt-3 flex flex-wrap gap-2">{actions.map((action) => <button key={action.value} type="button" disabled={pending || ((action.value === "reject" || action.value === "clarify") && !message.trim())} onClick={() => void review(action.value)} className={action.value === "approve" || action.value === "approve_free" || action.value === "confirm_cash" ? eventPrimaryButton : eventSecondaryButton}><span>{action.label}</span></button>)}</div>
      {error ? <p className="mt-3 rounded-lg bg-black px-3 py-2 text-[12px] font-bold text-white" role="alert">{errorLabel(error)}</p> : null}
    </article>
  );
}

export function ClubFinanceView({ tickets, clubName, roles }: { tickets: ClubFinanceTicket[]; clubName: string; roles: ClubRole[] }) {
  const { copy } = useEventsI18n();
  return (
    <EventsFrame>
      <ClubEventNav current="finance" visible={visibleClubNavigation(roles)} />
      <EventsHeader eyebrow={clubName} title={copy.finance} description={copy.financeDescription} />
      {tickets.length ? <div className="grid gap-4 lg:grid-cols-2">{tickets.map((ticket) => <FinanceTicketRow key={ticket.id} ticket={ticket} roles={roles} />)}</div> : <EventEmptyState text={copy.noFinanceRequests} />}
    </EventsFrame>
  );
}

export function ScannerEventListView({ events }: { events: ScannerAssignedEvent[] }) {
  const { copy, formatDateTime } = useEventsI18n();
  return (
    <EventsFrame>
      <ClubEventNav current="scanner" visible={["scanner"]} />
      <EventsHeader title={copy.scannerEvents} description={copy.scannerEventsDescription} />
      {events.length ? <div className="grid gap-4 md:grid-cols-2">{events.map((event) => (
        <article key={event.id} className="rounded-2xl border-2 border-black bg-white p-5 shadow-[4px_4px_0_#ffd400]">
          <div className="flex flex-wrap items-start justify-between gap-3"><div><p className="text-[11px] font-black uppercase tracking-[0.08em] text-black/50">{event.clubName}</p><h2 className="mt-1 text-[20px] font-black">{event.title}</h2></div><EventStatusPill status={event.status} /></div>
          <p className="mt-4 text-[13px] font-bold text-black/65">{formatDateTime(event.startAt)} · {event.location}</p>
          <div className="mt-4 flex items-center justify-between gap-3 border-t border-black/10 pt-4"><p className="text-[13px] font-bold">{event.checkedInCount}/{event.approvedCount} {copy.checkedIn}</p><Link href={`/app/club/scanner/${event.id}`} className={eventPrimaryButton}><span>{copy.openScanner}</span></Link></div>
        </article>
      ))}</div> : <EventEmptyState text={copy.noScannerEvents} />}
    </EventsFrame>
  );
}
