"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState, type FormEvent } from "react";

import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { TurnstileWidget } from "@/components/ui/TurnstileWidget";
import { clubCopy } from "@/lib/clubs/localization";
import { useLanguage } from "@/lib/i18n";
import { isStrongCadescaPassword } from "@/lib/passwords";
import { cadescaUsernameValidationError } from "@/lib/usernames";

type UniversityOption = {
  id: string;
  name: string;
};

function errorMessage(error: string, copy: (key: Parameters<typeof clubCopy>[1]) => string) {
  if (error === "invalid_username" || error === "reserved_username" || error === "duplicate_username") {
    return copy("usernameInvalid");
  }
  if (error === "password_mismatch") return copy("passwordMismatch");
  if (error === "invalid_password") return copy("passwordWeak");
  if (error === "verification_code_expired") return copy("otpExpired");
  if (error === "verification_too_many_attempts") return copy("otpTooMany");
  if (error.includes("verification") || error.includes("otp")) return copy("otpInvalid");
  if (error === "invalid_upload") return copy("uploadInvalid");
  return copy("submitFailed");
}

export function ClubApplicationForm({ universities }: { universities: UniversityOption[] }) {
  const { language } = useLanguage();
  const copy = useCallback((key: Parameters<typeof clubCopy>[1]) => clubCopy(language, key), [language]);
  const formRef = useRef<HTMLFormElement | null>(null);
  const [accountMode, setAccountMode] = useState<"new" | "existing">("new");
  const [representativeEmail, setRepresentativeEmail] = useState("");
  const [representativeName, setRepresentativeName] = useState("");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [universityId, setUniversityId] = useState("");
  const [officialEmail, setOfficialEmail] = useState("");
  const [otp, setOtp] = useState("");
  const [turnstileToken, setTurnstileToken] = useState("");
  const [turnstileReset, setTurnstileReset] = useState(0);
  const [codeSentAt, setCodeSentAt] = useState(0);
  const [sentIdentity, setSentIdentity] = useState("");
  const [cooldown, setCooldown] = useState(0);
  const [otpExpiresIn, setOtpExpiresIn] = useState(0);
  const [isSendingCode, setIsSendingCode] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState("");
  const [feedback, setFeedback] = useState("");
  const onTurnstileVerify = useCallback((token: string) => setTurnstileToken(token), []);

  useEffect(() => {
    if (!codeSentAt) return;
    const update = () => {
      const elapsed = Math.floor((Date.now() - codeSentAt) / 1000);
      setCooldown(Math.max(0, 60 - elapsed));
      setOtpExpiresIn(Math.max(0, 10 * 60 - elapsed));
    };
    update();
    const interval = window.setInterval(update, 1000);
    return () => window.clearInterval(interval);
  }, [codeSentAt]);

  useEffect(() => {
    if (!sentIdentity) return;
    const currentIdentity = `${representativeEmail.trim().toLowerCase()}|${officialEmail.trim().toLowerCase()}|${universityId}`;
    if (currentIdentity === sentIdentity) return;
    setCodeSentAt(0);
    setOtpExpiresIn(0);
    setOtp("");
    setFeedback("");
    setSentIdentity("");
  }, [officialEmail, representativeEmail, sentIdentity, universityId]);

  async function sendCode() {
    setError("");
    setFeedback("");

    if (!formRef.current?.reportValidity()) return;
    if (!representativeEmail.trim() || !representativeName.trim() || !universityId || !officialEmail.trim()) {
      setError(copy("requiredFields"));
      return;
    }
    if (cadescaUsernameValidationError(username)) {
      setError(copy("usernameInvalid"));
      return;
    }
    if (accountMode === "new" && !isStrongCadescaPassword(password)) {
      setError(copy("passwordWeak"));
      return;
    }
    if (!password || password !== confirmPassword) {
      setError(copy("passwordMismatch"));
      return;
    }
    if (!turnstileToken) {
      setError(copy("securityRequired"));
      return;
    }

    setIsSendingCode(true);
    try {
      const response = await fetch("/api/student-club/application/send-otp", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-cadesca-turnstile": turnstileToken
        },
        body: JSON.stringify({
          representativeEmail,
          representativeName,
          officialEmail,
          universityId,
          locale: language
        })
      });
      const body = (await response.json().catch(() => ({}))) as { ok?: boolean; error?: string };
      if (!response.ok || !body.ok) throw new Error(body.error || "send_failed");
      setCodeSentAt(Date.now());
      setOtpExpiresIn(10 * 60);
      setSentIdentity(`${representativeEmail.trim().toLowerCase()}|${officialEmail.trim().toLowerCase()}|${universityId}`);
      setFeedback(copy("codeSent"));
      setTurnstileToken("");
      setTurnstileReset((value) => value + 1);
    } catch {
      setError(copy("sendFailed"));
      setTurnstileToken("");
      setTurnstileReset((value) => value + 1);
    } finally {
      setIsSendingCode(false);
    }
  }

  async function submitApplication(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setFeedback("");

    if (cadescaUsernameValidationError(username)) {
      setError(copy("usernameInvalid"));
      return;
    }
    if (accountMode === "new" && !isStrongCadescaPassword(password)) {
      setError(copy("passwordWeak"));
      return;
    }
    if (password !== confirmPassword) {
      setError(copy("passwordMismatch"));
      return;
    }
    if (!/^\d{6}$/.test(otp.trim())) {
      setError(copy("otpInvalid"));
      return;
    }
    if (!turnstileToken) {
      setError(copy("securityRequired"));
      return;
    }

    const form = formRef.current;
    if (!form) return;
    const data = new FormData(form);
    data.set("locale", language);

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
        <p className="mt-4 rounded-xl bg-[#F7F5EF] p-4 text-sm leading-6 text-[#0A0A0A]">{copy("futureLogin")}</p>
        <Link
          href="/student-club/status"
          className="mt-5 inline-flex h-12 w-full items-center justify-center rounded-xl bg-[#FFD84D] px-5 font-semibold text-[#0A0A0A] transition-colors hover:bg-[#F2C230]"
        >
          {copy("viewStatus")}
        </Link>
      </div>
    );
  }

  return (
    <form ref={formRef} onSubmit={submitApplication} className="space-y-6">
      <section className="rounded-2xl border border-[#E4E1D8] bg-white p-5 shadow-sm sm:p-6">
        <h2 className="text-lg font-semibold text-[#0A0A0A]">{copy("accountSection")}</h2>
        <p className="mt-2 text-sm leading-6 text-[#696969]">{copy("existingAccount")}</p>
        <div className="mt-4 grid grid-cols-2 gap-2 rounded-xl bg-[#F7F5EF] p-1" role="group" aria-label={copy("accountMode")}>
          <button
            type="button"
            onClick={() => setAccountMode("new")}
            aria-pressed={accountMode === "new"}
            className={`rounded-lg px-3 py-2 text-sm font-semibold transition-colors ${accountMode === "new" ? "bg-white text-[#0A0A0A] shadow-sm" : "text-[#696969]"}`}
          >
            {copy("newAccount")}
          </button>
          <button
            type="button"
            onClick={() => setAccountMode("existing")}
            aria-pressed={accountMode === "existing"}
            className={`rounded-lg px-3 py-2 text-sm font-semibold transition-colors ${accountMode === "existing" ? "bg-white text-[#0A0A0A] shadow-sm" : "text-[#696969]"}`}
          >
            {copy("linkAccount")}
          </button>
        </div>
        <div className="mt-5 grid gap-4 sm:grid-cols-2">
          <Input
            label={copy("representativeName")}
            name="representativeName"
            value={representativeName}
            onChange={(event) => setRepresentativeName(event.target.value)}
            autoComplete="name"
            maxLength={80}
            required
          />
          <Input
            label={copy("representativeEmail")}
            name="representativeEmail"
            type="email"
            value={representativeEmail}
            onChange={(event) => setRepresentativeEmail(event.target.value)}
            autoComplete="email"
            required
          />
          <Input
            label={copy("representativeUsername")}
            name="representativeUsername"
            value={username}
            onChange={(event) => setUsername(event.target.value.toLowerCase())}
            autoComplete="username"
            minLength={3}
            maxLength={30}
            required
          />
          <div />
          <Input
            label={copy("password")}
            name="password"
            type="password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            autoComplete={accountMode === "new" ? "new-password" : "current-password"}
            minLength={accountMode === "new" ? 8 : 1}
            required
          />
          <Input
            label={copy("confirmPassword")}
            name="confirmPassword"
            type="password"
            value={confirmPassword}
            onChange={(event) => setConfirmPassword(event.target.value)}
            autoComplete={accountMode === "new" ? "new-password" : "current-password"}
            minLength={accountMode === "new" ? 8 : 1}
            required
          />
        </div>
      </section>

      <section className="rounded-2xl border border-[#E4E1D8] bg-white p-5 shadow-sm sm:p-6">
        <h2 className="text-lg font-semibold text-[#0A0A0A]">{copy("clubSection")}</h2>
        <div className="mt-5 grid gap-4 sm:grid-cols-2">
          <label className="block sm:col-span-2">
            <span className="mb-2 block text-xs font-semibold uppercase tracking-[0.08em] text-[#696969]">{copy("university")}</span>
            <select
              name="universityId"
              value={universityId}
              onChange={(event) => setUniversityId(event.target.value)}
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
          <Input label={copy("clubSlug")} name="preferredSlug" maxLength={80} required />
          <Input
            label={copy("officialEmail")}
            name="officialEmail"
            type="email"
            value={officialEmail}
            onChange={(event) => setOfficialEmail(event.target.value)}
            required
          />
          <Input label={copy("contactPhone")} name="contactPhone" type="tel" maxLength={40} />
          <Input label={copy("instagram")} name="instagramUrl" type="url" required />
          <Input label={copy("website")} name="websiteUrl" type="url" required />
          <div className="sm:col-span-2">
            <Input label={copy("universityPage")} name="universityPageUrl" type="url" />
          </div>
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
        </div>
      </section>

      <section className="rounded-2xl border border-[#E4E1D8] bg-white p-5 shadow-sm sm:p-6">
        <h2 className="text-lg font-semibold text-[#0A0A0A]">{copy("verificationSection")}</h2>
        <div className="mt-5 grid gap-4 sm:grid-cols-2">
          <label className="block">
            <span className="mb-2 block text-xs font-semibold uppercase tracking-[0.08em] text-[#696969]">{copy("logo")}</span>
            <input name="logo" type="file" accept="image/jpeg,image/png,image/webp" required className="block w-full text-sm text-[#696969] file:mr-3 file:rounded-lg file:border-0 file:bg-[#F7F5EF] file:px-3 file:py-2 file:font-semibold file:text-[#0A0A0A]" />
          </label>
          <label className="block">
            <span className="mb-2 block text-xs font-semibold uppercase tracking-[0.08em] text-[#696969]">{copy("recognitionDocument")}</span>
            <input name="recognitionDocument" type="file" accept="application/pdf,image/jpeg,image/png" required className="block w-full text-sm text-[#696969] file:mr-3 file:rounded-lg file:border-0 file:bg-[#F7F5EF] file:px-3 file:py-2 file:font-semibold file:text-[#0A0A0A]" />
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
            onVerify={onTurnstileVerify}
            errorMessage={copy("securityLoadFailed")}
          />
        </div>
        <div className="mt-4 grid gap-3 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-end">
          <Input
            label={copy("otp")}
            name="otp"
            inputMode="numeric"
            pattern="[0-9]{6}"
            maxLength={6}
            value={otp}
            onChange={(event) => setOtp(event.target.value.replace(/\D/g, ""))}
          />
          <Button
            type="button"
            onClick={sendCode}
            disabled={isSendingCode || cooldown > 0}
            className="h-11 w-full border-[#FFD84D] bg-[#FFD84D] text-[#0A0A0A] hover:bg-[#F2C230] sm:w-auto"
          >
            {cooldown > 0 ? `${copy("resendCode")} (${cooldown})` : codeSentAt ? copy("resendCode") : copy("sendCode")}
          </Button>
        </div>
      </section>

      {error ? <p role="alert" className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm font-medium text-red-800">{error}</p> : null}
      {feedback ? <p role="status" className="rounded-xl border border-[#E4E1D8] bg-[#FFF3B8] p-4 text-sm font-medium text-[#0A0A0A]">{feedback}</p> : null}

      <Button
        type="submit"
        disabled={isSubmitting || !codeSentAt || otpExpiresIn <= 0 || !turnstileToken}
        className="h-12 w-full border-[#FFD84D] bg-[#FFD84D] text-[#0A0A0A] hover:bg-[#F2C230]"
      >
        {isSubmitting ? copy("submitting") : copy("submit")}
      </Button>
    </form>
  );
}
