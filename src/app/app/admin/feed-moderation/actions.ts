"use server";

import { revalidatePath } from "next/cache";

import { requireAdminSession } from "@/lib/server/adminAuth";
import { setAdminPostStatus, setAdminReportStatus } from "@/lib/server/social";

function revalidateModeration() {
  revalidatePath("/app/admin/feed-moderation");
  revalidatePath("/app/admin/social");
  revalidatePath("/app/user/home");
  revalidatePath("/app/user/explore");
  revalidatePath("/app/user/activity");
}

export async function setPostModerationStatusAction(formData: FormData) {
  await requireAdminSession();
  const postId = String(formData.get("postId") || "");
  const status = String(formData.get("status") || "");
  if (!postId || (status !== "active" && status !== "hidden" && status !== "deleted")) return;

  await setAdminPostStatus(postId, status);
  revalidateModeration();
}

export async function setReportModerationStatusAction(formData: FormData) {
  const session = await requireAdminSession();
  const reportId = String(formData.get("reportId") || "");
  const status = String(formData.get("status") || "");
  if (!reportId || (status !== "resolved" && status !== "dismissed")) return;

  await setAdminReportStatus({
    reportId,
    status,
    adminEmail: session.email
  });
  revalidateModeration();
}
