"use server";

import { revalidatePath } from "next/cache";

import { createClubPost, deleteClubPost } from "@/lib/server/clubPosts";

export type ClubPostActionState = { ok: boolean; message: string };
const EMPTY_STATE: ClubPostActionState = { ok: false, message: "" };

export async function createClubPostAction(
  _previous: ClubPostActionState = EMPTY_STATE,
  formData: FormData
): Promise<ClubPostActionState> {
  const clubId = String(formData.get("clubId") || "");
  const imageValue = formData.get("image");
  try {
    await createClubPost(
      clubId,
      String(formData.get("body") || ""),
      imageValue instanceof File && imageValue.size ? imageValue : null
    );
    revalidatePath("/app/club/posts");
    revalidatePath("/app/user/home");
    revalidatePath("/app/user/explore");
    return { ok: true, message: "Post published as the club." };
  } catch (error) {
    return { ok: false, message: error instanceof Error ? error.message : "Post could not be published." };
  }
}

export async function deleteClubPostAction(formData: FormData) {
  await deleteClubPost(String(formData.get("clubId") || ""), String(formData.get("postId") || ""));
  revalidatePath("/app/club/posts");
  revalidatePath("/app/user/home");
  revalidatePath("/app/user/explore");
}

