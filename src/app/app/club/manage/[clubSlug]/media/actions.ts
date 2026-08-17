"use server";

import { revalidatePath } from "next/cache";

import { deleteClubMediaAsset, uploadClubMediaAsset } from "@/lib/server/clubMedia";

export async function uploadClubMediaAction(formData: FormData) {
  const file = formData.get("file");
  if (!(file instanceof File)) throw new Error("invalid_media");
  await uploadClubMediaAsset(String(formData.get("clubId") || ""), file, String(formData.get("altText") || ""));
  revalidatePath("/app/club/manage");
}

export async function deleteClubMediaAction(formData: FormData) {
  await deleteClubMediaAsset(String(formData.get("clubId") || ""), String(formData.get("assetId") || ""));
  revalidatePath("/app/club/manage");
}
