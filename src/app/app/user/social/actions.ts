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

function friendlyMessage(error: unknown, fallback = "social.actionFailed") {
  const message = error instanceof Error ? error.message : "";
  if (message === "verified_university_student_required") {
    return "social.verifiedAccessRequired";
  }
  if (message === "post_body_required") return "social.postBodyRequired";
  if (message === "post_body_too_long") return "social.postBodyTooLong";
  if (message === "invalid_image_url") return "social.invalidImageUrl";
  if (message === "invalid_post_image_type" || message === "image_moderation_invalid_input") return "social.invalidPostImageType";
  if (message === "post_image_file_too_large") return "social.postImageTooLarge";
  if (message === "post_image_upload_failed" || message === "post_image_bucket_missing") return "social.postImageUploadFailed";
  if (message === "image_rejected") return "social.imageRejected";
  if (message === "image_moderation_failed") return "social.imageScanFailed";
  if (message === "profile_not_found") return "social.profileNotFound";
  if (message === "cannot_follow_self") return "social.cannotFollowSelf";
  return fallback;
}

function errorReason(error: unknown) {
  return error instanceof Error ? error.message : "unknown";
}

function logSocialAction(action: string, event: "start" | "success" | "failed" | "skipped", details: Record<string, unknown> = {}) {
  const payload = { action, event, ...details };
  if (event === "failed") {
    console.error("[user_social_action]", payload);
    return;
  }

  console.info("[user_social_action]", payload);
}

function getFirstUploadedFile(formData: FormData, name: string) {
  return formData.getAll(name).find((value): value is File => value instanceof File && value.size > 0) || null;
}

export async function createPostAction(_previous: SocialFormState, formData: FormData): Promise<SocialFormState> {
  const shouldRedirect = formData.get("redirectToHome") === "true";
  const body = String(formData.get("body") || "");
  const imageUrl = String(formData.get("imageUrl") || "");
  const imageFile = getFirstUploadedFile(formData, "imageFile");

  logSocialAction("create_post", "start", {
    bodyLength: body.length,
    hasImageUrl: Boolean(imageUrl),
    hasImageFile: Boolean(imageFile),
    shouldRedirect
  });

  try {
    const imagePath = imageFile ? await uploadUniversityPostImage(imageFile) : null;
    await createUniversityPost({
      body,
      imageUrl,
      imagePath
    });
    revalidateSocialPaths();
  } catch (error) {
    logSocialAction("create_post", "failed", { reason: errorReason(error) });
    return { ok: false, message: friendlyMessage(error, "social.postPublishFailed") };
  }

  if (shouldRedirect) {
    logSocialAction("create_post", "success", { redirected: true });
    redirect("/app/user/home");
  }

  logSocialAction("create_post", "success", { redirected: false });
  return { ok: true, message: "social.postPublished" };
}

export async function togglePostLikeAction(formData: FormData) {
  const postId = String(formData.get("postId") || "");
  logSocialAction("toggle_post_like", "start", { hasPostId: Boolean(postId) });
  if (!postId) {
    logSocialAction("toggle_post_like", "skipped", { reason: "missing_post_id" });
    return;
  }

  try {
    await toggleUniversityPostLike(postId);
    revalidateSocialPaths();
    logSocialAction("toggle_post_like", "success");
  } catch (error) {
    logSocialAction("toggle_post_like", "failed", { reason: errorReason(error) });
  }
}

export async function addPostCommentAction(_previous: SocialFormState, formData: FormData): Promise<SocialFormState> {
  const postId = String(formData.get("postId") || "");
  const body = String(formData.get("body") || "");
  logSocialAction("add_post_comment", "start", {
    hasPostId: Boolean(postId),
    bodyLength: body.length
  });

  try {
    if (!postId) throw new Error("post_not_found");
    await createUniversityPostComment({ postId, body });
    revalidateSocialPaths();
    logSocialAction("add_post_comment", "success");
    return { ok: true, message: "social.commentAdded" };
  } catch (error) {
    logSocialAction("add_post_comment", "failed", { reason: errorReason(error) });
    return { ok: false, message: friendlyMessage(error) };
  }
}

export async function deletePostAction(formData: FormData) {
  const postId = String(formData.get("postId") || "");
  logSocialAction("delete_post", "start", { hasPostId: Boolean(postId) });
  if (!postId) {
    logSocialAction("delete_post", "skipped", { reason: "missing_post_id" });
    return;
  }

  try {
    await deleteOwnUniversityPost(postId);
    revalidateSocialPaths();
    logSocialAction("delete_post", "success");
  } catch (error) {
    logSocialAction("delete_post", "failed", { reason: errorReason(error) });
  }
}

export async function reportPostAction(formData: FormData) {
  const postId = String(formData.get("postId") || "");
  logSocialAction("report_post", "start", { hasPostId: Boolean(postId) });
  if (!postId) {
    logSocialAction("report_post", "skipped", { reason: "missing_post_id" });
    return;
  }

  try {
    await reportUniversityPost({
      postId,
      reason: String(formData.get("reason") || "Reported from feed")
    });
    revalidateSocialPaths();
    logSocialAction("report_post", "success");
  } catch (error) {
    logSocialAction("report_post", "failed", { reason: errorReason(error) });
  }
}

export async function toggleFollowAction(formData: FormData) {
  const username = String(formData.get("username") || "");
  logSocialAction("toggle_follow", "start", { hasUsername: Boolean(username) });
  if (!username) {
    logSocialAction("toggle_follow", "skipped", { reason: "missing_username" });
    return;
  }

  try {
    await toggleUserFollow(username);
    revalidateSocialPaths();
    revalidatePath(`/user/${username}`);
    logSocialAction("toggle_follow", "success");
  } catch (error) {
    logSocialAction("toggle_follow", "failed", { reason: errorReason(error) });
  }
}
