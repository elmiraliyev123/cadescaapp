"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { acceptClubMembership, EventsError } from "@/lib/server/events";

export type ClubInvitationActionState = {
  ok: boolean;
  message: "" | "accepted" | "unavailable" | "authentication_required" | "failed";
};

export async function acceptClubInvitationAction(
  _previousState: ClubInvitationActionState,
  formData: FormData
): Promise<ClubInvitationActionState> {
  const membershipId = formData.get("membershipId");
  if (typeof membershipId !== "string") return { ok: false, message: "failed" };
  try {
    await acceptClubMembership(membershipId);
  } catch (error) {
    if (error instanceof EventsError && error.code === "authentication_required") {
      return { ok: false, message: "authentication_required" };
    }
    if (error instanceof EventsError && error.code === "club_access_denied") {
      return { ok: false, message: "unavailable" };
    }
    return { ok: false, message: "failed" };
  }
  revalidatePath("/app/user/club");
  revalidatePath("/app/club");
  redirect("/app/club");
}
