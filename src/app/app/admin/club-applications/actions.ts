"use server";

import { revalidatePath } from "next/cache";

import { requireAdminSession } from "@/lib/server/adminAuth";
import {
  moderateClubStatus,
  reviewClubApplication,
  StudentClubError,
  type ClubReviewDecision
} from "@/lib/server/studentClubs";

export type AdminClubMutationState = {
  ok: boolean;
  action?: ClubReviewDecision | "suspend" | "reactivate";
  error: "" | "invalid" | "conflict" | "authentication_required" | "failed";
};

const EMPTY_STATE: AdminClubMutationState = { ok: false, error: "" };

function text(formData: FormData, key: string) {
  const value = formData.get(key);
  return typeof value === "string" ? value.trim() : "";
}

function actionError(error: unknown): AdminClubMutationState["error"] {
  if (error instanceof StudentClubError) {
    if (error.code === "review_invalid") return "invalid";
    if (error.code === "review_conflict" || error.code === "application_not_found") return "conflict";
  }
  if (error instanceof Error && error.message === "admin_session_required") return "authentication_required";
  return "failed";
}

export async function reviewClubApplicationAction(
  _previousState: AdminClubMutationState = EMPTY_STATE,
  formData: FormData
): Promise<AdminClubMutationState> {
  const decision = text(formData, "decision");
  if (decision !== "approve" && decision !== "reject" && decision !== "request_clarification") {
    return { ok: false, error: "invalid" };
  }

  try {
    const admin = await requireAdminSession();
    await reviewClubApplication({
      clubId: text(formData, "clubId"),
      decision: decision satisfies ClubReviewDecision,
      actorEmail: admin.email,
      message: text(formData, "message") || null
    });
    revalidatePath("/app/admin/club-applications");
    revalidatePath("/student-club/status");
    revalidatePath("/app/user/club");
    revalidatePath("/app/club");
    return { ok: true, action: decision, error: "" };
  } catch (error) {
    return { ok: false, error: actionError(error) };
  }
}

export async function moderateClubStatusAction(
  _previousState: AdminClubMutationState = EMPTY_STATE,
  formData: FormData
): Promise<AdminClubMutationState> {
  const action = text(formData, "action");
  if (action !== "suspend" && action !== "reactivate") {
    return { ok: false, error: "invalid" };
  }
  try {
    const admin = await requireAdminSession();
    await moderateClubStatus({
      clubId: text(formData, "clubId"),
      action,
      actorEmail: admin.email,
      reason: text(formData, "reason") || null
    });
    revalidatePath("/app/admin/club-applications");
    revalidatePath("/student-club/status");
    revalidatePath("/app/user/club");
    revalidatePath("/app/club");
    return { ok: true, action, error: "" };
  } catch (error) {
    return { ok: false, error: actionError(error) };
  }
}
