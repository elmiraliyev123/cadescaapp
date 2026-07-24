"use client";

import { useCallback, useState, type FormEvent } from "react";

import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { TurnstileWidget } from "@/components/ui/TurnstileWidget";
import { clubCopy } from "@/lib/clubs/localization";
import { useLanguage } from "@/lib/i18n";

type UniversityOption = {
  id: string;
  name: string;
};

function errorMessage(error: string, copy: (key: Parameters<typeof clubCopy>[1]) => string) {
  if (error === "authentication_required") return copy("loginRequired");
  if (error === "application_conflict") return copy("submitFailed");
  if (error === "invalid_upload") return copy("uploadInvalid");
  return copy("submitFailed");
}

export function ClubApplicationForm({ universities }: { universities: UniversityOption[] }) {
  const { language } = useLanguage();
  const copy = useCallback((key: Parameters<typeof clubCopy>[1]) => clubCopy(language, key), [language]);
  const [turnstileToken, setTurnstileToken] = useState("");
  const [turnstileReset, setTurnstileReset] = useState(0);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState("");

  async function submitApplication(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");

    if (!turnstileToken) {
      setError(copy("securityRequired"));
      return;
    }

    const data = new FormData(event.currentTarget);
    setIsSubmitting(true);
    try {
      const response = await fetch("/api/student-club/application", {
        method: "POST",
        headers: { "x-cadesca-turnstile": turnstileToken },
        body: data
      });
      const body = (await response.json().catch(() => ({}))) as { ok?: boolean; error?: string };
      if (!response.ok || !body.ok) throw new Error(body.error || "submit_failed");
      setSubmitted(true);
    } catch (caughtError) {
      setError(errorMessage(caughtError instanceof Error ? caughtError.message : "submit_failed", copy));
      setTurnstileToken("");
      setTurnstileReset((value) => value + 1);
    } finally {
      setIsSubmitting(false);
    }
  }

  if (submitted) {
    return (
      <div className="rounded-2xl border border-[#E4E1D8] bg-white p-6 shadow-sm">
        <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-[#FFF3B8] text-[#0A0A0A]">
          <span className="material-symbols-outlined" aria-hidden="true">task_alt</span>
        </div>
        <h2 className="mt-5 text-2xl font-semibold text-[#0A0A0A]">{copy("submitted")}</h2>
        <p className="mt-2 text-sm leading-6 text-[#696969]">{copy("submittedBody")}</p>
        <a
          href="/waiting-approval"
          className="mt-5 inline-flex h-12 w-full items-center justify-center rounded-xl bg-[#0A0A0A] px-5 font-semibold text-white transition-colors hover:bg-[#252525]"
        >
          {copy("viewStatus")}
        </a>
      </div>
    );
  }

  return (
    <form onSubmit={submitApplication} className="space-y-6">
      <section className="rounded-2xl border border-[#E4E1D8] bg-white p-5 shadow-sm sm:p-6">
        <h2 className="text-lg font-semibold text-[#0A0A0A]">{copy("clubSection")}</h2>
        <div className="mt-5 grid gap-4 sm:grid-cols-2">
          <label className="block sm:col-span-2">
            <span className="mb-2 block text-xs font-semibold uppercase tracking-[0.08em] text-[#696969]">{copy("university")}</span>
            <select
              name="universityId"
              required
              className="h-11 w-full rounded-lg border border-[#E4E1D8] bg-white px-4 text-sm text-[#0A0A0A] outline-none focus:border-[#0A0A0A]"
            >
              <option value="">—</option>
              {universities.map((university) => (
                <option key={university.id} value={university.id}>{university.name}</option>
              ))}
            </select>
          </label>
          <Input label={copy("clubName")} name="clubName" maxLength={140} required />
          <Input label={copy("officialEmail")} name="officialEmail" type="email" maxLength={254} required />
          <Input label={copy("contactPhone")} name="contactPhone" type="tel" maxLength={40} />
          <div />
          <label className="block sm:col-span-2">
            <span className="mb-2 block text-xs font-semibold uppercase tracking-[0.08em] text-[#696969]">{copy("description")}</span>
            <textarea
              name="description"
              rows={5}
              minLength={20}
              maxLength={2000}
              required
              className="w-full resize-y rounded-lg border border-[#E4E1D8] bg-white px-4 py-3 text-sm text-[#0A0A0A] outline-none focus:border-[#0A0A0A]"
            />
          </label>
          <label className="block sm:col-span-2">
            <span className="mb-2 block text-xs font-semibold uppercase tracking-[0.08em] text-[#696969]">{copy("note")}</span>
            <textarea
              name="additionalNote"
              rows={3}
              maxLength={1000}
              className="w-full resize-y rounded-lg border border-[#E4E1D8] bg-white px-4 py-3 text-sm text-[#0A0A0A] outline-none focus:border-[#0A0A0A]"
            />
          </label>
          <label className="block sm:col-span-2">
            <span className="mb-2 block text-xs font-semibold uppercase tracking-[0.08em] text-[#696969]">{copy("logo")}</span>
            <input name="logo" type="file" accept="image/jpeg,image/png,image/webp" required className="block w-full text-sm text-[#696969] file:mr-3 file:rounded-lg file:border-0 file:bg-[#F7F5EF] file:px-3 file:py-2 file:font-semibold file:text-[#0A0A0A]" />
          </label>
        </div>
        <label className="mt-5 flex items-start gap-3 rounded-xl bg-[#F7F5EF] p-4 text-sm leading-5 text-[#0A0A0A]">
          <input name="agreementAccepted" type="checkbox" value="true" required className="mt-0.5 h-4 w-4 accent-[#0A0A0A]" />
          <span>{copy("agreement")}</span>
        </label>
      </section>

      <section className="rounded-2xl border border-[#E4E1D8] bg-white p-5 shadow-sm sm:p-6">
        <h2 className="text-lg font-semibold text-[#0A0A0A]">{copy("securityCheck")}</h2>
        <div className="mt-4">
          <TurnstileWidget
            action="club_application"
            resetSignal={turnstileReset}
            onVerify={setTurnstileToken}
            errorMessage={copy("securityLoadFailed")}
          />
        </div>
      </section>

      {error ? <p role="alert" className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm font-medium text-red-800">{error}</p> : null}

      <Button
        type="submit"
        disabled={isSubmitting || !turnstileToken}
        className="h-12 w-full border-[#0A0A0A] bg-[#0A0A0A] text-white hover:bg-[#252525]"
      >
        {isSubmitting ? copy("submitting") : copy("submit")}
      </Button>
    </form>
  );
}
