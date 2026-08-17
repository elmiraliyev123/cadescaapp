"use client";

import { useRouter } from "next/navigation";
import { useCallback, useState, type FormEvent } from "react";

import type { ClubApplicationView } from "@/lib/server/studentClubs";
import { clubCopy } from "@/lib/clubs/localization";
import {
  CLUB_IMAGE_ACCEPT,
  ClubUploadValidationError,
  validateClubImageFile
} from "@/lib/clubs/uploadValidation";
import { useLanguage } from "@/lib/i18n";

const fieldClass = "h-11 w-full rounded-lg border border-[#E4E1D8] bg-white px-4 text-sm text-[#0A0A0A] outline-none focus:border-[#0A0A0A]";
const textareaClass = "w-full resize-y rounded-lg border border-[#E4E1D8] bg-white px-4 py-3 text-sm text-[#0A0A0A] outline-none focus:border-[#0A0A0A]";
const labelClass = "mb-2 block text-xs font-semibold uppercase tracking-[0.08em] text-[#696969]";

function uploadErrorMessage(code: string, fallback: string) {
  if (code === "unsupported_image_type") return "Unsupported file type. Use JPG, PNG, WebP, HEIC, or HEIF.";
  if (code === "image_file_too_large" || code === "upload_request_too_large") return "The image is larger than 4 MB.";
  if (code === "image_upload_failed" || code === "upload_failed") return "Image upload failed. Please try again.";
  if (code === "image_moderation_unavailable") return "The image safety check is temporarily unavailable. Please try again.";
  if (code === "image_rejected") return "This image cannot be uploaded because it did not pass the safety check.";
  if (code === "network_error") return "Network error, please try again.";
  return fallback;
}

export function ClubApplicationUpdateForm({ application }: { application: ClubApplicationView }) {
  const router = useRouter();
  const { language } = useLanguage();
  const copy = useCallback((key: Parameters<typeof clubCopy>[1]) => clubCopy(language, key), [language]);
  const [saving, setSaving] = useState(false);
  const [responding, setResponding] = useState(false);
  const [feedback, setFeedback] = useState("");
  const [error, setError] = useState("");

  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setFeedback("");
    setSaving(true);
    try {
      const data = new FormData(event.currentTarget);
      const logo = data.get("logo");
      if (logo instanceof File && logo.size) await validateClubImageFile(logo);
      let response: Response;
      try {
        response = await fetch("/api/student-club/application/update", {
          method: "POST",
          body: data
        });
      } catch {
        throw new Error("network_error");
      }
      const body = (await response.json().catch(() => ({}))) as { ok?: boolean; error?: string };
      if (!response.ok || !body.ok) throw new Error(body.error || "update_failed");
      setFeedback(copy("updateSuccess"));
      router.refresh();
    } catch (caught) {
      const code = caught instanceof ClubUploadValidationError
        ? caught.code
        : caught instanceof Error
          ? caught.message
          : "update_failed";
      setError(uploadErrorMessage(code, copy("updateFailed")));
    } finally {
      setSaving(false);
    }
  }

  async function respond(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setFeedback("");
    const data = new FormData(event.currentTarget);
    setResponding(true);
    try {
      const response = await fetch("/api/student-club/application/respond", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: String(data.get("message") || "") })
      });
      const body = (await response.json().catch(() => ({}))) as { ok?: boolean };
      if (!response.ok || !body.ok) throw new Error("response_failed");
      setFeedback(copy("responseSent"));
      router.refresh();
    } catch {
      setError(copy("updateFailed"));
    } finally {
      setResponding(false);
    }
  }

  return (
    <section className="rounded-2xl border border-[#E4E1D8] bg-white p-6 shadow-sm">
      <h2 className="text-lg font-semibold text-[#0A0A0A]">{copy("editApplication")}</h2>
      <p className="mt-2 text-sm leading-6 text-[#696969]">{copy("editApplicationBody")}</p>

      <form onSubmit={save} className="mt-6 grid gap-4 sm:grid-cols-2">
        <label>
          <span className={labelClass}>{copy("clubName")}</span>
          <input name="clubName" defaultValue={application.name} required minLength={2} maxLength={140} className={fieldClass} />
        </label>
        <label>
          <span className={labelClass}>{copy("contactPhone")}</span>
          <input name="contactPhone" type="tel" defaultValue={application.contactPhone || ""} maxLength={40} className={fieldClass} />
        </label>
        <span />
        <label className="sm:col-span-2">
          <span className={labelClass}>{copy("description")}</span>
          <textarea name="description" defaultValue={application.description} required minLength={20} maxLength={2000} rows={5} className={textareaClass} />
        </label>
        <label className="sm:col-span-2">
          <span className={labelClass}>{copy("note")}</span>
          <textarea name="additionalNote" defaultValue={application.additionalNote || ""} maxLength={1000} rows={3} className={textareaClass} />
        </label>
        <div className="sm:col-span-2">
          <p className={labelClass}>{copy("replacementFiles")}</p>
          <div className="grid gap-4 sm:grid-cols-2">
            <label className="text-sm text-[#696969]">
              <span className="mb-2 block">{copy("logo")}</span>
              <input name="logo" type="file" accept={CLUB_IMAGE_ACCEPT} className="block w-full text-sm" />
              <span className="mt-2 block text-xs leading-5">JPG, PNG, WebP, HEIC or HEIF, up to 4 MB.</span>
            </label>
          </div>
        </div>
        <button type="submit" disabled={saving} className="mt-2 inline-flex h-11 items-center justify-center rounded-xl bg-[#0A0A0A] px-5 text-sm font-semibold text-white disabled:opacity-50 sm:col-span-2">
          {saving ? copy("savingChanges") : copy("saveChanges")}
        </button>
      </form>

      {application.status === "clarification_requested" || application.status === "rejected" ? (
        <form onSubmit={respond} className="mt-7 border-t border-[#E4E1D8] pt-6">
          <label>
            <span className={labelClass}>{application.status === "rejected" ? "Revision summary" : copy("clarificationResponse")}</span>
            <textarea name="message" required minLength={2} maxLength={2000} rows={5} placeholder={application.status === "rejected" ? "Explain what you changed before resubmitting." : copy("clarificationPlaceholder")} className={textareaClass} />
          </label>
          <button type="submit" disabled={responding} className="mt-4 inline-flex h-11 w-full items-center justify-center rounded-xl bg-[#FFD84D] px-5 text-sm font-semibold text-[#0A0A0A] disabled:opacity-50">
            {responding ? copy("sendingResponse") : application.status === "rejected" ? "Resubmit application" : copy("sendResponse")}
          </button>
        </form>
      ) : null}

      {feedback ? <p role="status" className="mt-4 rounded-xl bg-emerald-50 p-4 text-sm text-emerald-900">{feedback}</p> : null}
      {error ? <p role="alert" className="mt-4 rounded-xl bg-red-50 p-4 text-sm text-red-900">{error}</p> : null}
    </section>
  );
}
