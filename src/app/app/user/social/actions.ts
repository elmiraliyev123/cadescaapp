"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import {
  createUniversityPost,
  createUniversityPostComment,
  deleteOwnUniversityPost,
  reportUniversityPost,
  toggleUserFollow,
  toggleUniversityPostLike,
  uploadUniversityPostImage
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
    return "social.verifiedAccessRequired";
  }
  if (message === "post_body_required") return "social.postBodyRequired";
  if (message === "post_body_too_long") return "social.postBodyTooLong";
  if (message === "invalid_image_url") return "social.invalidImageUrl";
  if (message === "invalid_post_image_type") return "social.invalidPostImageType";
  if (message === "post_image_file_too_large") return "social.postImageTooLarge";
  if (message === "post_image_upload_failed" || message === "post_image_bucket_missing") return "social.postImageUploadFailed";
  if (message === "image_rejected") return "social.imageRejected";
  if (message === "image_moderation_failed") return "social.imageScanFailed";
  if (message === "profile_not_found") return "social.profileNotFound";
  if (message === "cannot_follow_self") return "social.cannotFollowSelf";
  return "social.actionFailed";
}

function getFirstUploadedFile(formData: FormData, name: string) {
  return formData.getAll(name).find((value): value is File => value instanceof File && value.size > 0) || null;
}

export async function createPostAction(_previous: SocialFormState, formData: FormData): Promise<SocialFormState> {
  const shouldRedirect = formData.get("redirectToHome") === "true";
  try {
    const imageFile = getFirstUploadedFile(formData, "imageFile");
    const imagePath = imageFile ? await uploadUniversityPostImage(imageFile) : null;
    await createUniversityPost({
      body: String(formData.get("body") || ""),
      imageUrl: String(formData.get("imageUrl") || ""),
      imagePath
    });
    revalidateSocialPaths();
  } catch (error) {
    return { ok: false, message: friendlyMessage(error) };
  }

  if (shouldRedirect) {
    redirect("/app/user/home");
  }

  return { ok: true, message: "social.postPublished" };
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
    return { ok: true, message: "social.commentAdded" };
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
