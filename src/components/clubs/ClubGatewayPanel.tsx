"use client";

import Link from "next/link";
import { useActionState } from "react";

import {
  acceptClubInvitationAction,
  type ClubInvitationActionState
} from "@/app/app/user/club/actions";
import type { ClubApplicationView, ClubMembershipInvitation } from "@/lib/server/studentClubs";
import { ScreenHeader } from "@/components/screens/ScreenHeader";
import { clubCopy } from "@/lib/clubs/localization";
import { useLanguage } from "@/lib/i18n";

const STATUS_BODY = {
  pending_review: "pendingBody",
  clarification_requested: "clarificationBody",
  approved: "approvedBody",
  rejected: "rejectedBody",
  suspended: "suspendedBody",
  archived: "archivedBody"
} as const;

const ROLE_COPY = {
  club_owner: "roleClubOwner",
  event_organizer: "roleEventOrganizer",
  finance_manager: "roleFinanceManager",
  door_scanner: "roleDoorScanner"
} as const;
const EMPTY_INVITATION_STATE: ClubInvitationActionState = { ok: false, message: "" };

function InvitationCard({
  invitation,
  copy
}: {
  invitation: ClubMembershipInvitation;
  copy: (key: Parameters<typeof clubCopy>[1]) => string;
}) {
  const [state, action, pending] = useActionState(acceptClubInvitationAction, EMPTY_INVITATION_STATE);
  return (
    <article className="rounded-lg border border-outline-variant/70 bg-surface-container-lowest p-4">
      <p className="text-caption font-semibold uppercase tracking-[0.08em] text-secondary">{invitation.universityName}</p>
      <h3 className="mt-1 text-title-md font-semibold text-primary">{invitation.clubName}</h3>
      <p className="mt-1 text-body-sm text-secondary">{copy(ROLE_COPY[invitation.role])}</p>
      <form action={action} className="mt-4">
        <input type="hidden" name="membershipId" value={invitation.id} />
        <button type="submit" disabled={pending} className="inline-flex h-10 items-center justify-center rounded-lg bg-primary px-4 text-sm font-semibold text-on-primary disabled:opacity-50">
          {pending ? copy("acceptingInvitation") : copy("acceptInvitation")}
        </button>
      </form>
      {state.message ? (
        <p role={state.ok ? "status" : "alert"} className={`mt-3 text-body-sm ${state.ok ? "text-emerald-700" : "text-red-700"}`}>
          {copy(
            state.ok
              ? "invitationAccepted"
              : state.message === "unavailable"
                ? "invitationUnavailable"
                : state.message === "authentication_required"
                  ? "invitationSessionExpired"
                  : "invitationFailed"
          )}
        </p>
      ) : null}
    </article>
  );
}

function InvitationList({
  invitations,
  copy
}: {
  invitations: ClubMembershipInvitation[];
  copy: (key: Parameters<typeof clubCopy>[1]) => string;
}) {
  if (!invitations.length) return null;
  return (
    <section className="premium-card mb-5 p-5">
      <h2 className="text-title-lg font-semibold text-primary">{copy("invitationsTitle")}</h2>
      <p className="mt-2 text-body-sm leading-6 text-secondary">{copy("invitationsBody")}</p>
      <div className="mt-4 grid gap-3 md:grid-cols-2">
        {invitations.map((invitation) => <InvitationCard key={invitation.id} invitation={invitation} copy={copy} />)}
      </div>
    </section>
  );
}

export function ClubGatewayPanel({ application, invitations, applyHref }: {
  application: ClubApplicationView | null;
  invitations: ClubMembershipInvitation[];
  applyHref: string;
}) {
  const { language } = useLanguage();
  const copy = (key: Parameters<typeof clubCopy>[1]) => clubCopy(language, key);

  if (!application) {
    return (
      <section>
        <ScreenHeader title={copy("gatewayTitle")} description={copy("gatewayDescription")} />
        <InvitationList invitations={invitations} copy={copy} />
        <div className="premium-card p-8 text-center">
          <span className="material-symbols-outlined text-[40px] text-secondary" aria-hidden="true">groups</span>
          <h2 className="mt-3 text-title-lg font-semibold text-primary">{copy("noApplication")}</h2>
          <Link href={applyHref} className="mt-5 inline-flex h-11 items-center justify-center rounded-lg bg-primary px-5 text-sm font-semibold text-on-primary">
            {copy("newApplication")}
          </Link>
        </div>
      </section>
    );
  }

  return (
    <section>
      <ScreenHeader title={copy("gatewayTitle")} description={copy("gatewayDescription")} />
      <InvitationList invitations={invitations} copy={copy} />
      <div className="premium-card overflow-hidden">
      <div className="flex flex-wrap items-start justify-between gap-4 border-b border-outline-variant/70 p-5">
        <div>
          <p className="text-caption font-semibold uppercase tracking-[0.08em] text-secondary">{application.universityName}</p>
          <h2 className="mt-1 text-title-lg font-semibold text-primary">{application.name}</h2>
        </div>
        <span className="rounded-md border border-outline-variant/80 bg-surface-container-high px-2 py-1 text-xs font-semibold text-primary">
          {copy(application.status)}
        </span>
      </div>
      <div className="p-5">
        <p className="text-body-md leading-6 text-secondary">{copy(STATUS_BODY[application.status])}</p>
        {application.clarificationMessage || application.rejectionReason || application.suspensionReason ? (
          <div className="mt-5 rounded-lg bg-surface-container-low p-4">
            <p className="text-caption font-semibold uppercase tracking-[0.08em] text-secondary">{copy("decisionNote")}</p>
            <p className="mt-2 whitespace-pre-wrap text-body-sm text-primary">
              {application.clarificationMessage || application.rejectionReason || application.suspensionReason}
            </p>
          </div>
        ) : null}
        <p className="mt-5 border-t border-outline-variant/60 pt-4 text-body-sm text-secondary">{copy("restrictedNotice")}</p>
        {application.status === "pending_review" || application.status === "clarification_requested" ? (
          <Link href={`${applyHref.replace(/\/+$/, "")}/status`} className="mt-5 inline-flex h-11 items-center justify-center rounded-lg bg-primary px-5 text-sm font-semibold text-on-primary">
            {copy("viewStatus")}
          </Link>
        ) : null}
        {application.status === "approved" ? (
          <Link href="/app/club" className="mt-5 inline-flex h-11 items-center justify-center rounded-lg bg-primary px-5 text-sm font-semibold text-on-primary">
            {copy("dashboard")}
          </Link>
        ) : null}
      </div>
      </div>
    </section>
  );
}
