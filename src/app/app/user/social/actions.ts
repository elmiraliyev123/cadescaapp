"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import {
  createUniversityPost,
  createUniversityPostComment,
  deleteOwnUniversityPost,
  reportUniversityPost,
  toggleUserFollow,
  toggleUniversityPostLike
} from "@/lib/server/social";

export type SocialFormState = {
  ok: boolean;
  message: string;
};

const SOCIAL_REVALIDATE_PATHS = [
  "/app/user/home",
  "/app/user/explore",
  "/app/user/create",
  "/app/user/activity",
  "/app/user/profile",
  "/app/admin/feed-moderation"
];

function revalidateSocialPaths() {
  for (const path of SOCIAL_REVALIDATE_PATHS) {
    revalidatePath(path);
  }
}

function friendlyMessage(error: unknown) {
  const message = error instanceof Error ? error.message : "";
  if (message === "verified_university_student_required") {
    return "Verified university access is required.";
  }
  if (message === "post_body_required") return "Write something before posting.";
  if (message === "post_body_too_long") return "Your post is too long.";
  if (message === "invalid_image_url") return "Use a valid http or https image URL.";
  if (message === "profile_not_found") return "That profile could not be found.";
  if (message === "cannot_follow_self") return "You cannot follow yourself.";
  return "The action could not be completed.";
}

export async function createPostAction(_previous: SocialFormState, formData: FormData): Promise<SocialFormState> {
  const shouldRedirect = formData.get("redirectToHome") === "true";
  try {
    await createUniversityPost({
      body: String(formData.get("body") || ""),
      imageUrl: String(formData.get("imageUrl") || "")
    });
    revalidateSocialPaths();
  } catch (error) {
    return { ok: false, message: friendlyMessage(error) };
  }

  if (shouldRedirect) {
    redirect("/app/user/home");
  }

  return { ok: true, message: "Post published." };
}

export async function togglePostLikeAction(formData: FormData) {
  const postId = String(formData.get("postId") || "");
  if (!postId) return;
  await toggleUniversityPostLike(postId);
  revalidateSocialPaths();
}

export async function addPostCommentAction(_previous: SocialFormState, formData: FormData): Promise<SocialFormState> {
  try {
    const postId = String(formData.get("postId") || "");
    const body = String(formData.get("body") || "");
    if (!postId) throw new Error("post_not_found");
    await createUniversityPostComment({ postId, body });
    revalidateSocialPaths();
    return { ok: true, message: "Comment added." };
  } catch (error) {
    return { ok: false, message: friendlyMessage(error) };
  }
}

export async function deletePostAction(formData: FormData) {
  const postId = String(formData.get("postId") || "");
  if (!postId) return;
  await deleteOwnUniversityPost(postId);
  revalidateSocialPaths();
}

export async function reportPostAction(formData: FormData) {
  const postId = String(formData.get("postId") || "");
  if (!postId) return;
  await reportUniversityPost({
    postId,
    reason: String(formData.get("reason") || "Reported from feed")
  });
  revalidateSocialPaths();
}

export async function toggleFollowAction(formData: FormData) {
  const username = String(formData.get("username") || "");
  if (!username) return;
  await toggleUserFollow(username);
  revalidateSocialPaths();
  revalidatePath(`/user/${username}`);
}
