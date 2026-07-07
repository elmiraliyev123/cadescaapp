"use server";

import { revalidatePath } from "next/cache";
import { cookies } from "next/headers";

import {
  isSupportedLocale,
  LANGUAGE_BANNER_DISMISSED_COOKIE_NAME,
  LOCALE_COOKIE_DOMAIN,
  LOCALE_COOKIE_MAX_AGE,
  NEXT_LOCALE_COOKIE_NAME,
  type SupportedLocale
} from "@/lib/localization";
import { updateUserLocale } from "@/lib/server/users";
import { updateCurrentUserProfile, uploadCurrentUserAvatar } from "@/lib/server/social";
import { USER_SESSION_COOKIE, verifyUserSessionToken } from "@/lib/server/userSession";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export type LanguagePreferenceResult = {
  locale: SupportedLocale;
};

export type ProfileSettingsFormState = {
  ok: boolean;
  message: string;
};

function profileSettingsMessage(error: unknown) {
  const message = error instanceof Error ? error.message : "";
  if (message === "username_required") return "Choose a username.";
  if (message === "invalid_username") return "Use 3-30 lowercase letters, numbers, underscores, or dots.";
  if (message === "reserved_username") return "That username is reserved.";
  if (message === "username_taken") return "That username is already taken.";
  if (message === "display_name_too_long") return "Display name must be 80 characters or less.";
  if (message === "bio_too_long") return "Bio must be 240 characters or less.";
  if (message === "invalid_avatar_type") return "Upload a JPG, PNG, or WebP image.";
  if (message === "avatar_file_too_large") return "Avatar image must be 3 MB or less.";
  if (message === "avatar_bucket_missing") return "The avatars storage bucket is not configured.";
  if (message === "avatar_upload_requires_supabase_auth") return "Sign in again before uploading an avatar.";
  if (message === "avatar_upload_failed") return "Avatar upload failed.";
  return "Profile settings could not be saved.";
}

export async function updateProfileSettingsAction(
  _previous: ProfileSettingsFormState,
  formData: FormData
): Promise<ProfileSettingsFormState> {
  try {
    const avatar = formData.get("avatar");
    const avatarPath = avatar instanceof File && avatar.size > 0 ? await uploadCurrentUserAvatar(avatar) : null;

    await updateCurrentUserProfile({
      displayName: String(formData.get("displayName") || ""),
      username: String(formData.get("username") || ""),
      bio: String(formData.get("bio") || ""),
      avatarPath
    });

    const username = String(formData.get("username") || "").trim().toLowerCase();
    revalidatePath("/app/user/profile");
    revalidatePath("/app/user/settings");
    revalidatePath("/app/user/home");
    revalidatePath("/app/user/explore");
    if (username) revalidatePath(`/user/${username}`);

    return { ok: true, message: "Profile settings saved." };
  } catch (error) {
    return { ok: false, message: profileSettingsMessage(error) };
  }
}

export async function updateLanguagePreference(locale: SupportedLocale): Promise<LanguagePreferenceResult> {
  if (!isSupportedLocale(locale)) {
    throw new Error("invalid_locale");
  }

  const cookieStore = await cookies();
  let updatedWithSupabaseAuth = false;
  let supabase: Awaited<ReturnType<typeof createSupabaseServerClient>> | null = null;

  try {
    supabase = await createSupabaseServerClient();
  } catch {
    // Existing legacy sessions remain supported during the Supabase migration.
  }

  if (supabase) {
    const {
      data: { user }
    } = await supabase.auth.getUser();

    if (user) {
      const { data, error } = await supabase
        .from("users")
        .update({ locale })
        .eq("auth_user_id", user.id)
        .select("id")
        .maybeSingle();

      if (error) throw new Error("locale_update_failed");
      if (!data) throw new Error("user_not_found");
      updatedWithSupabaseAuth = true;
    }
  }

  if (!updatedWithSupabaseAuth) {
    const sessionToken = cookieStore.get(USER_SESSION_COOKIE)?.value;
    const authSecret = process.env.AUTH_SECRET;
    const legacySession =
      sessionToken && authSecret
        ? await verifyUserSessionToken(sessionToken, authSecret)
        : null;

    if (!legacySession || legacySession.role !== "user") {
      throw new Error("unauthorized");
    }

    await updateUserLocale(legacySession.id, locale);
  }

  const cookieOptions = {
    domain: LOCALE_COOKIE_DOMAIN,
    path: "/",
    maxAge: LOCALE_COOKIE_MAX_AGE,
    sameSite: "lax" as const,
    httpOnly: false,
    secure: process.env.NODE_ENV === "production"
  };

  cookieStore.set(NEXT_LOCALE_COOKIE_NAME, locale, cookieOptions);
  cookieStore.set(LANGUAGE_BANNER_DISMISSED_COOKIE_NAME, "true", cookieOptions);
  revalidatePath("/", "layout");

  return { locale };
}
