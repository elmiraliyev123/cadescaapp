"use server";

import { revalidatePath } from "next/cache";

import {
  acceptClubMembership,
  assignScannerToEvent,
  cancelClubEvent,
  createEventDraft,
  inviteClubMember,
  revokeClubMembership,
  revokeScannerFromEvent,
  submitEventForReview,
  updateEventDraft,
  type EventDraftInput,
  EventsError
} from "@/lib/server/events";
import { StudentClubError, updateApprovedClubProfile } from "@/lib/server/studentClubs";

export type ClubActionState = {
  ok: boolean;
  message: string;
  eventId?: string;
};

export type ClubProfileActionMessage =
  | ""
  | "updated"
  | "invalid"
  | "access_denied"
  | "not_editable"
  | "upload_failed"
  | "failed";

export type ClubProfileActionState = {
  ok: boolean;
  message: ClubProfileActionMessage;
};

const EMPTY_STATE: ClubActionState = { ok: false, message: "" };

function text(formData: FormData, key: string) {
  const value = formData.get(key);
  return typeof value === "string" ? value.trim() : "";
}

function checked(formData: FormData, key: string) {
  const value = formData.get(key);
  return value === "true" || value === "on" || value === "1";
}

function eventInput(formData: FormData): EventDraftInput {
  const isFree = checked(formData, "isFree");
  return {
    title: text(formData, "title"),
    description: text(formData, "description"),
    location: text(formData, "location"),
    venueDetails: text(formData, "venueDetails") || null,
    startAt: text(formData, "startAt"),
    endAt: text(formData, "endAt"),
    timezone: text(formData, "timezone") || "Europe/Istanbul",
    ticketPrice: isFree ? 0 : Number(text(formData, "ticketPrice")),
    currency: text(formData, "currency") || "TRY",
    isFree,
    capacity: Number(text(formData, "capacity")),
    ticketRequestDeadline: text(formData, "ticketRequestDeadline"),
    bankTransferEnabled: checked(formData, "bankTransferEnabled"),
    cashPaymentEnabled: checked(formData, "cashPaymentEnabled"),
    freeTicketMode: text(formData, "freeTicketMode") === "organizer_approval" ? "organizer_approval" : "automatic",
    iban: text(formData, "iban") || null,
    ibanAccountName: text(formData, "ibanAccountName") || null,
    paymentInstructions: text(formData, "paymentInstructions") || null,
    refundPolicy: text(formData, "refundPolicy"),
    ageRequirement: text(formData, "ageRequirement") ? Number(text(formData, "ageRequirement")) : null
  };
}

function actionMessage(error: unknown) {
  if (error instanceof EventsError) return `events.error.${error.code}`;
  return "events.error.generic";
}

export async function createEventDraftAction(
  _previousState: ClubActionState = EMPTY_STATE,
  formData: FormData
): Promise<ClubActionState> {
  try {
    const clubId = text(formData, "clubId");
    const coverValue = formData.get("cover");
    const created = await createEventDraft(
      clubId,
      eventInput(formData),
      coverValue instanceof File && coverValue.size ? coverValue : null
    );
    revalidatePath("/app/club");
    revalidatePath("/app/user/events");
    return { ok: true, message: "events.event.draftSaved", eventId: created.id };
  } catch (error) {
    return { ok: false, message: actionMessage(error) };
  }
}

export async function updateEventDraftAction(
  _previousState: ClubActionState = EMPTY_STATE,
  formData: FormData
): Promise<ClubActionState> {
  try {
    const eventId = text(formData, "eventId");
    const coverValue = formData.get("cover");
    await updateEventDraft(
      eventId,
      eventInput(formData),
      coverValue instanceof File && coverValue.size ? coverValue : null
    );
    revalidatePath("/app/club");
    revalidatePath(`/app/club/events/${eventId}`);
    return { ok: true, message: "events.event.draftSaved", eventId };
  } catch (error) {
    return { ok: false, message: actionMessage(error) };
  }
}

export async function submitEventForReviewAction(
  _previousState: ClubActionState = EMPTY_STATE,
  formData: FormData
): Promise<ClubActionState> {
  const eventId = text(formData, "eventId");
  try {
    await submitEventForReview(eventId);
    revalidatePath("/app/club");
    revalidatePath(`/app/club/events/${eventId}`);
    revalidatePath("/app/admin/events");
    return { ok: true, message: "events.event.submitted", eventId };
  } catch (error) {
    return { ok: false, message: actionMessage(error), eventId };
  }
}

export async function cancelClubEventAction(
  _previousState: ClubActionState = EMPTY_STATE,
  formData: FormData
): Promise<ClubActionState> {
  const eventId = text(formData, "eventId");
  try {
    await cancelClubEvent(eventId);
    revalidatePath("/app/club");
    revalidatePath(`/app/club/events/${eventId}`);
    revalidatePath("/app/user/events");
    return { ok: true, message: "events.event.cancelled", eventId };
  } catch (error) {
    return { ok: false, message: actionMessage(error), eventId };
  }
}

export async function inviteClubMemberAction(
  _previousState: ClubActionState = EMPTY_STATE,
  formData: FormData
): Promise<ClubActionState> {
  const role = text(formData, "role");
  if (role !== "event_organizer" && role !== "finance_manager" && role !== "door_scanner") {
    return { ok: false, message: "events.error.club_member_invalid" };
  }
  try {
    await inviteClubMember({
      clubId: text(formData, "clubId"),
      usernameOrEmail: text(formData, "usernameOrEmail"),
      role
    });
    revalidatePath("/app/club");
    revalidatePath("/app/user/club");
    return { ok: true, message: "events.member.invited" };
  } catch (error) {
    return { ok: false, message: actionMessage(error) };
  }
}

export async function acceptClubMembershipAction(
  _previousState: ClubActionState = EMPTY_STATE,
  formData: FormData
): Promise<ClubActionState> {
  try {
    await acceptClubMembership(text(formData, "membershipId"));
    revalidatePath("/app/club");
    revalidatePath("/app/user/club");
    return { ok: true, message: "events.member.accepted" };
  } catch (error) {
    return { ok: false, message: actionMessage(error) };
  }
}

export async function revokeClubMembershipAction(
  _previousState: ClubActionState = EMPTY_STATE,
  formData: FormData
): Promise<ClubActionState> {
  try {
    await revokeClubMembership(text(formData, "clubId"), text(formData, "membershipId"));
    revalidatePath("/app/club");
    revalidatePath("/app/user/club");
    return { ok: true, message: "events.member.revoked" };
  } catch (error) {
    return { ok: false, message: actionMessage(error) };
  }
}

export async function assignScannerToEventAction(
  _previousState: ClubActionState = EMPTY_STATE,
  formData: FormData
): Promise<ClubActionState> {
  const eventId = text(formData, "eventId");
  try {
    await assignScannerToEvent(eventId, text(formData, "scannerUserId"));
    revalidatePath("/app/club");
    revalidatePath(`/app/club/events/${eventId}`);
    revalidatePath("/app/club/scanner");
    return { ok: true, message: "events.scanner.assigned", eventId };
  } catch (error) {
    return { ok: false, message: actionMessage(error), eventId };
  }
}

export async function revokeScannerFromEventAction(
  _previousState: ClubActionState = EMPTY_STATE,
  formData: FormData
): Promise<ClubActionState> {
  const eventId = text(formData, "eventId");
  try {
    await revokeScannerFromEvent(eventId, text(formData, "scannerUserId"));
    revalidatePath(`/app/club/events/${eventId}`);
    revalidatePath("/app/club/scanner");
    return { ok: true, message: "events.scanner.revoked", eventId };
  } catch (error) {
    return { ok: false, message: actionMessage(error), eventId };
  }
}

export async function updateApprovedClubProfileAction(
  _previousState: ClubProfileActionState,
  formData: FormData
): Promise<ClubProfileActionState> {
  const clubId = text(formData, "clubId");
  const logoValue = formData.get("logo");
  try {
    await updateApprovedClubProfile({
      clubId,
      description: text(formData, "description"),
      contactEmail: text(formData, "contactEmail"),
      websiteUrl: text(formData, "websiteUrl") || null,
      instagramUrl: text(formData, "instagramUrl") || null,
      universityPageUrl: text(formData, "universityPageUrl") || null,
      logo: logoValue instanceof File && logoValue.size ? logoValue : null
    });
    revalidatePath("/app/club");
    revalidatePath("/app/user/events");
    revalidatePath(`/media/club/${clubId}`);
    return { ok: true, message: "updated" };
  } catch (error) {
    if (error instanceof StudentClubError) {
      if (error.code === "invalid_upload" && error.status >= 500) {
        return { ok: false, message: "upload_failed" };
      }
      if (error.code === "club_profile_invalid" || error.code === "invalid_upload") {
        return { ok: false, message: "invalid" };
      }
      if (error.code === "club_profile_access_denied" || error.code === "authentication_required") {
        return { ok: false, message: "access_denied" };
      }
      if (error.code === "club_profile_not_editable") {
        return { ok: false, message: "not_editable" };
      }
      if (error.code === "upload_failed") {
        return { ok: false, message: "upload_failed" };
      }
    }
    return { ok: false, message: "failed" };
  }
}
