"use server";

import { revalidatePath } from "next/cache";

import { requireAdminSession } from "@/lib/server/adminAuth";
import { EventsError, reviewEventAsAdmin, setEventFeaturedAsAdmin } from "@/lib/server/events";

export type AdminEventActionState = {
  ok: boolean;
  message: string;
};

const EMPTY_STATE: AdminEventActionState = { ok: false, message: "" };

function text(formData: FormData, key: string) {
  const value = formData.get(key);
  return typeof value === "string" ? value.trim() : "";
}

function actionError(error: unknown) {
  if (error instanceof EventsError) return `events.error.${error.code}`;
  if (error instanceof Error && error.message === "admin_session_required") {
    return "events.error.authentication_required";
  }
  return "events.error.generic";
}

export async function reviewEventAction(
  _previousState: AdminEventActionState = EMPTY_STATE,
  formData: FormData
): Promise<AdminEventActionState> {
  try {
    const admin = await requireAdminSession();
    const action = text(formData, "action");
    if (action !== "approve" && action !== "reject") {
      return { ok: false, message: "events.error.event_invalid" };
    }
    await reviewEventAsAdmin({
      eventId: text(formData, "eventId"),
      action,
      adminEmail: admin.email,
      reason: text(formData, "reason") || null
    });
    revalidatePath("/app/admin/events");
    revalidatePath("/app/user/events");
    revalidatePath("/app/club");
    return { ok: true, message: "events.admin.review_saved" };
  } catch (error) {
    return { ok: false, message: actionError(error) };
  }
}

export async function featureEventAction(
  _previousState: AdminEventActionState = EMPTY_STATE,
  formData: FormData
): Promise<AdminEventActionState> {
  try {
    const admin = await requireAdminSession();
    await setEventFeaturedAsAdmin({
      eventId: text(formData, "eventId"),
      featured: text(formData, "featured") === "true",
      featuredUntil: text(formData, "featuredUntil") || null,
      adminEmail: admin.email
    });
    revalidatePath("/app/admin/events");
    revalidatePath("/app/user/events");
    revalidatePath("/app/user/home");
    revalidatePath("/app/user/explore");
    return { ok: true, message: "events.admin.feature_saved" };
  } catch (error) {
    return { ok: false, message: actionError(error) };
  }
}
