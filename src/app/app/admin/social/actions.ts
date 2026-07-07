"use server";

import { revalidatePath } from "next/cache";

import { requireAdminSession } from "@/lib/server/adminAuth";
import {
  resetAdminUserUsername,
  setAdminUserStatus,
  upsertAdminUniversity
} from "@/lib/server/social";
import {
  approveUniversityAccessRequest,
  normalizeEmailDomains,
  rejectUniversityAccessRequest
} from "@/lib/server/universities";

function formString(formData: FormData, key: string) {
  const value = formData.get(key);
  return typeof value === "string" ? value.trim() : "";
}

function revalidateAdminSocial() {
  revalidatePath("/app/admin/social");
  revalidatePath("/app/admin/feed-moderation");
  revalidatePath("/app/user/home");
  revalidatePath("/app/user/profile");
}

export async function setSocialUserStatusAction(formData: FormData) {
  await requireAdminSession();
  const userId = formString(formData, "userId");
  const status = formString(formData, "status");
  if (!userId || (status !== "active" && status !== "suspended")) return;

  await setAdminUserStatus(userId, status);
  revalidateAdminSocial();
}

export async function resetSocialUsernameAction(formData: FormData) {
  await requireAdminSession();
  const userId = formString(formData, "userId");
  if (!userId) return;

  await resetAdminUserUsername(userId);
  revalidateAdminSocial();
}

export async function upsertUniversityAction(formData: FormData) {
  await requireAdminSession();
  const status = formString(formData, "status") === "inactive" ? "inactive" : "active";
  const domainsInput = formString(formData, "emailDomains") || formString(formData, "universityEmailDomain");

  await upsertAdminUniversity({
    id: formString(formData, "id") || null,
    slug: formString(formData, "slug"),
    name: formString(formData, "name"),
    emailDomains: normalizeEmailDomains(domainsInput),
    countryCode: formString(formData, "countryCode") || null,
    countryName: formString(formData, "countryName") || null,
    city: formString(formData, "city") || null,
    websiteUrl: formString(formData, "websiteUrl") || null,
    status
  });

  revalidateAdminSocial();
}

export async function approveUniversityAccessRequestAction(formData: FormData) {
  await requireAdminSession();
  const requestId = formString(formData, "requestId");
  if (!requestId) return;

  await approveUniversityAccessRequest(requestId);
  revalidateAdminSocial();
}

export async function rejectUniversityAccessRequestAction(formData: FormData) {
  await requireAdminSession();
  const requestId = formString(formData, "requestId");
  if (!requestId) return;

  await rejectUniversityAccessRequest(requestId);
  revalidateAdminSocial();
}
