"use server";

import { revalidatePath } from "next/cache";

import { archiveClubPost, createClubPost, deleteClubPost, duplicateClubPost, updateClubPost, type ClubPostInput } from "@/lib/server/clubPosts";

export type ClubPostActionState = { ok: boolean; message: string; postId?: string };
const EMPTY_STATE: ClubPostActionState = { ok: false, message: "" };

function postInput(formData: FormData): ClubPostInput {
  const publicationStatus = String(formData.get("publicationStatus") || "published");
  return {
    title: String(formData.get("title") || "") || null,
    body: String(formData.get("body") || ""),
    publicationStatus: (["draft", "published", "scheduled"].includes(publicationStatus) ? publicationStatus : "draft") as ClubPostInput["publicationStatus"],
    scheduledAt: String(formData.get("scheduledAt") || "") || null,
    linkUrl: String(formData.get("linkUrl") || "") || null,
    tags: String(formData.get("tags") || "").split(","),
    relatedEventId: String(formData.get("relatedEventId") || "") || null
  };
}

export async function createClubPostAction(
  _previous: ClubPostActionState = EMPTY_STATE,
  formData: FormData
): Promise<ClubPostActionState> {
  const clubId = String(formData.get("clubId") || "");
  const imageValue = formData.get("image");
  try {
    const input = postInput(formData);
    const postId = await createClubPost(
      clubId,
      input,
      imageValue instanceof File && imageValue.size ? imageValue : null
    );
    revalidatePath("/app/club/posts");
    revalidatePath("/app/user/home");
    revalidatePath("/app/user/explore");
    return { ok: true, message: input.publicationStatus === "published" ? "Post published as the club." : "Post saved.", postId };
  } catch (error) {
    return { ok: false, message: error instanceof Error ? error.message : "Post could not be published." };
  }
}

export async function updateClubPostAction(
  _previous: ClubPostActionState = EMPTY_STATE,
  formData: FormData
): Promise<ClubPostActionState> {
  const clubId = String(formData.get("clubId") || "");
  const postId = String(formData.get("postId") || "");
  const imageValue = formData.get("image");
  try {
    const input = postInput(formData);
    await updateClubPost(clubId, postId, input, imageValue instanceof File && imageValue.size ? imageValue : null);
    revalidatePath("/app/club/posts");
    revalidatePath("/app/user/home");
    revalidatePath("/app/user/explore");
    return { ok: true, message: input.publicationStatus === "published" ? "Post updated and published." : "Post updated.", postId };
  } catch (error) {
    return { ok: false, message: error instanceof Error ? error.message : "Post could not be updated.", postId };
  }
}

export async function archiveClubPostAction(formData: FormData) {
  await archiveClubPost(String(formData.get("clubId") || ""), String(formData.get("postId") || ""));
  revalidatePath("/app/club/posts");
}

export async function duplicateClubPostAction(formData: FormData) {
  await duplicateClubPost(String(formData.get("clubId") || ""), String(formData.get("postId") || ""));
  revalidatePath("/app/club/posts");
}

export async function deleteClubPostAction(formData: FormData) {
  await deleteClubPost(String(formData.get("clubId") || ""), String(formData.get("postId") || ""));
  revalidatePath("/app/club/posts");
  revalidatePath("/app/user/home");
  revalidatePath("/app/user/explore");
}
