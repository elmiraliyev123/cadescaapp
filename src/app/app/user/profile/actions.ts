"use server";

import { revalidatePath } from "next/cache";
import { cookies } from "next/headers";

import {
  getLocaleCookieDomain,
  isSupportedLocale,
  LANGUAGE_BANNER_DISMISSED_COOKIE_NAME,
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
  if (message === "username_required") return "social.chooseUsername";
  if (message === "invalid_username") return "social.invalidUsername";
  if (message === "reserved_username") return "social.reservedUsername";
  if (message === "username_taken") return "social.usernameTaken";
  if (message === "display_name_too_long") return "social.displayNameTooLong";
  if (message === "bio_too_long") return "social.bioTooLong";
  if (message === "invalid_avatar_type") return "social.invalidAvatarType";
  if (message === "avatar_file_too_large") return "social.avatarTooLarge";
  if (message === "avatar_bucket_missing") return "social.avatarBucketMissing";
  if (message === "avatar_upload_requires_supabase_auth") return "social.avatarUploadAuth";
  if (message === "avatar_upload_failed") return "social.avatarUploadFailed";
  if (message === "image_rejected") return "social.imageRejected";
  if (message === "image_moderation_failed") return "social.imageScanFailed";
  return "social.profileSettingsFailed";
}

function getFirstUploadedFile(formData: FormData, name: string) {
  return formData.getAll(name).find((value): value is File => value instanceof File && value.size > 0) || null;
}

export async function updateProfileSettingsAction(
  _previous: ProfileSettingsFormState,
  formData: FormData
): Promise<ProfileSettingsFormState> {
  try {
    const avatar = getFirstUploadedFile(formData, "avatar");
    const avatarPath = avatar ? await uploadCurrentUserAvatar(avatar) : null;

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

    return { ok: true, message: "social.profileSaved" };
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

    if (process.env.NODE_ENV === "development" && legacySession.id === "user_mock") {
      // The local demo user is not stored in the production users table.
    } else {
      await updateUserLocale(legacySession.id, locale);
    }
  }

  const cookieOptions = {
    domain: getLocaleCookieDomain(),
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
