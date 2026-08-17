"use client";

import { useRouter } from "next/navigation";
import { useMemo, useState, type ChangeEvent, type FormEvent } from "react";

import { TurnstileWidget } from "@/components/ui/TurnstileWidget";
import {
  CLUB_DOCUMENT_ACCEPT,
  CLUB_IMAGE_ACCEPT,
  ClubUploadValidationError,
  validateClubDocumentFile,
  validateClubImageFile,
  type ValidatedClubUpload
} from "@/lib/clubs/uploadValidation";
import type { ClubApplicationDraftPayload, ClubApplicationDraftView } from "@/lib/server/studentClubs";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";

type UniversityOption = { id: string; name: string };

const STEPS = ["Club information", "Contact", "Leadership", "Verification", "Review"] as const;

const EMPTY_PAYLOAD: ClubApplicationDraftPayload = {
  universityId: "",
  clubName: "",
  acronym: "",
  category: "",
  description: "",
  officialEmail: "",
  contactPhone: "",
  websiteUrl: "",
  instagramUrl: "",
  linkedinUrl: "",
  otherSocialUrl: "",
  foundedYear: "",
  recognitionStatus: "not_declared",
  president: "",
  vicePresident: "",
  boardMembers: "",
  facultyAdvisor: "",
  additionalNote: ""
};

const inputClass = "min-h-12 w-full rounded-xl border border-black/20 bg-white px-3.5 py-2.5 text-[15px] text-black outline-none placeholder:text-black/40 focus:border-black focus:ring-2 focus:ring-[#FFD84D]";
const labelClass = "mb-2 block text-[11px] font-extrabold uppercase tracking-[0.1em] text-black/55";
const primaryButton = "inline-flex min-h-12 items-center justify-center rounded-xl border border-black bg-black px-5 py-3 text-sm font-bold text-white transition-colors hover:bg-black/80 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#FFD84D] focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-45";
const secondaryButton = "inline-flex min-h-12 items-center justify-center rounded-xl border border-black bg-white px-5 py-3 text-sm font-bold text-black transition-colors hover:bg-[#FFF3B8] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#FFD84D] focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-45";

function errorMessage(code: string) {
  if (code === "authentication_required") return "Your Cadesca session expired. Sign in again to continue.";
  if (code === "application_conflict") return "An active club application already exists for this account.";
  if (code === "logo_required") return "Select a club logo before submitting.";
  if (code === "unsupported_image_type" || code === "unsupported_file_type") return "Unsupported file type. Use JPG, PNG, WebP, HEIC, or HEIF.";
  if (code === "unsupported_document_type") return "Unsupported document type. Use PDF, JPG, PNG, WebP, HEIC, or HEIF.";
  if (code === "image_file_too_large") return "An image is larger than 4 MB.";
  if (code === "document_file_too_large") return "The document is larger than 9 MB.";
  if (code === "upload_request_too_large") return "The selected files are too large to process.";
  if (code === "image_upload_failed" || code === "upload_failed") return "Image upload failed. Please try again.";
  if (code === "document_upload_failed") return "Document upload failed. Please try again.";
  if (code === "image_moderation_unavailable") return "The image safety check is temporarily unavailable. Please try again.";
  if (code === "image_rejected") return "This image cannot be uploaded because it did not pass the safety check.";
  if (code === "application_save_failed" || code === "application_invalid") return "Could not save application. Review the fields and try again.";
  if (code === "network_error") return "Network error, please try again.";
  if (code === "turnstile_missing" || code === "turnstile_invalid") return "The security check expired. Complete it again and retry.";
  if (code === "turnstile_verification_failed") return "The security check is temporarily unavailable. Please try again.";
  if (code === "rate_limited") return "Too many attempts. Wait a moment and try again.";
  if (code === "invalid_multipart") return "The files could not be processed. Select them again and retry.";
  return "An unexpected error occurred. Please try again.";
}

type BrowserUpload = {
  kind: "logo" | "cover" | "recognitionDocument";
  file: File;
  validated: ValidatedClubUpload;
};

type UploadTicket = {
  kind: BrowserUpload["kind"];
  path: string;
  token: string;
};

function selectedFile(formData: FormData, key: BrowserUpload["kind"]) {
  const value = formData.get(key);
  return value instanceof File && value.size ? value : null;
}

async function browserUploads(formData: FormData) {
  const logo = selectedFile(formData, "logo");
  if (!logo) throw new Error("logo_required");
  const entries: Array<{ kind: BrowserUpload["kind"]; file: File }> = [{ kind: "logo", file: logo }];
  const cover = selectedFile(formData, "cover");
  const recognitionDocument = selectedFile(formData, "recognitionDocument");
  if (cover) entries.push({ kind: "cover", file: cover });
  if (recognitionDocument) entries.push({ kind: "recognitionDocument", file: recognitionDocument });

  try {
    return await Promise.all(entries.map(async ({ kind, file }) => ({
      kind,
      file,
      validated: kind === "recognitionDocument"
        ? await validateClubDocumentFile(file)
        : await validateClubImageFile(file)
    })));
  } catch (error) {
    if (error instanceof ClubUploadValidationError) throw new Error(error.code);
    throw error;
  }
}

async function cleanupStagedUploads(paths: string[]) {
  if (!paths.length) return;
  await fetch("/api/student-club/application/uploads", {
    method: "DELETE",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ paths })
  }).catch(() => undefined);
}

async function stageBrowserUploads(uploads: BrowserUpload[]) {
  let ticketResponse: Response;
  try {
    ticketResponse = await fetch("/api/student-club/application/uploads", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        uploads: uploads.map(({ kind, file, validated }) => ({
          kind,
          byteSize: file.size,
          contentType: validated.contentType,
          extension: validated.extension
        }))
      })
    });
  } catch {
    throw new Error("network_error");
  }
  const ticketBody = await ticketResponse.json().catch(() => ({})) as { ok?: boolean; error?: string; bucket?: string; tickets?: UploadTicket[] };
  if (!ticketResponse.ok || !ticketBody.ok || !ticketBody.bucket || !ticketBody.tickets) {
    throw new Error(ticketBody.error || "image_upload_failed");
  }

  const ticketByKind = new Map(ticketBody.tickets.map((ticket) => [ticket.kind, ticket]));
  const paths = ticketBody.tickets.map((ticket) => ticket.path);
  const supabase = createSupabaseBrowserClient();
  try {
    await Promise.all(uploads.map(async ({ kind, file, validated }) => {
      const ticket = ticketByKind.get(kind);
      if (!ticket) throw new Error(kind === "recognitionDocument" ? "document_upload_failed" : "image_upload_failed");
      const { error } = await supabase.storage.from(ticketBody.bucket!).uploadToSignedUrl(ticket.path, ticket.token, file, {
        cacheControl: "0",
        contentType: validated.contentType
      });
      if (error) throw new Error(kind === "recognitionDocument" ? "document_upload_failed" : "image_upload_failed");
    }));
  } catch (error) {
    await cleanupStagedUploads(paths);
    throw error instanceof Error ? error : new Error("image_upload_failed");
  }

  return {
    paths,
    references: Object.fromEntries(ticketBody.tickets.map((ticket) => [ticket.kind, { path: ticket.path }]))
  };
}

function Field({ label, children, className = "" }: { label: string; children: React.ReactNode; className?: string }) {
  return <label className={`block ${className}`}><span className={labelClass}>{label}</span>{children}</label>;
}

export function ClubApplicationForm({
  universities,
  draft,
  applicant,
  defaultUniversityId
}: {
  universities: UniversityOption[];
  draft: ClubApplicationDraftView | null;
  applicant: { name: string; email: string };
  defaultUniversityId?: string | null;
}) {
  const router = useRouter();
  const [draftId, setDraftId] = useState(draft?.id || "");
  const [step, setStep] = useState(draft?.currentStep || 1);
  const [payload, setPayload] = useState<ClubApplicationDraftPayload>({
    ...EMPTY_PAYLOAD,
    universityId: defaultUniversityId || "",
    ...(draft?.payload || {})
  });
  const [saving, setSaving] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [submitPhase, setSubmitPhase] = useState<"idle" | "uploading" | "submitting">("idle");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [turnstileToken, setTurnstileToken] = useState("");
  const [turnstileReset, setTurnstileReset] = useState(0);
  const [logoSelected, setLogoSelected] = useState(false);

  const selectedUniversity = useMemo(
    () => universities.find((university) => university.id === payload.universityId)?.name || "Not selected",
    [payload.universityId, universities]
  );

  function update<K extends keyof ClubApplicationDraftPayload>(key: K, value: ClubApplicationDraftPayload[K]) {
    setPayload((current) => ({ ...current, [key]: value }));
    setMessage("");
  }

  async function validateFileSelection(
    event: ChangeEvent<HTMLInputElement>,
    kind: "logo" | "cover" | "recognitionDocument"
  ) {
    const input = event.currentTarget;
    const file = input.files?.[0] || null;
    if (kind === "logo") setLogoSelected(false);
    if (!file) return;
    try {
      if (kind === "recognitionDocument") {
        await validateClubDocumentFile(file);
      } else {
        await validateClubImageFile(file);
      }
      if (kind === "logo") setLogoSelected(true);
      setError("");
    } catch (caught) {
      input.value = "";
      const code = caught instanceof ClubUploadValidationError ? caught.code : "unsupported_file_type";
      setError(errorMessage(code));
    }
  }

  async function saveDraft(nextStep = step) {
    setSaving(true);
    setError("");
    try {
      const response = await fetch("/api/student-club/application/draft", {
        method: "PUT",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ id: draftId || null, currentStep: nextStep, payload })
      });
      const body = await response.json() as { ok?: boolean; error?: string; draft?: ClubApplicationDraftView };
      if (!response.ok || !body.ok || !body.draft) throw new Error(body.error || "application_invalid");
      setDraftId(body.draft.id);
      setMessage("Draft saved");
      if (!draftId) window.history.replaceState(window.history.state, "", `/application/${body.draft.id}`);
      return true;
    } catch (caught) {
      setError(errorMessage(caught instanceof Error ? caught.message : "application_invalid"));
      return false;
    } finally {
      setSaving(false);
    }
  }

  async function nextStep() {
    const validation = validateStep(step);
    if (validation) {
      setError(validation);
      return;
    }
    const next = Math.min(5, step + 1);
    if (await saveDraft(next)) {
      setStep(next);
      window.scrollTo({ top: 0, behavior: "smooth" });
    }
  }

  async function submitApplication(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    for (const requiredStep of [1, 2] as const) {
      const validation = validateStep(requiredStep);
      if (validation) {
        setStep(requiredStep);
        setError(validation);
        return;
      }
    }
    if (!turnstileToken) {
      setError("Complete the security check before submitting.");
      return;
    }
    setSubmitting(true);
    setSubmitPhase("uploading");
    let stagedPaths: string[] = [];
    try {
      const data = new FormData(event.currentTarget);
      const uploads = await browserUploads(data);
      const staged = await stageBrowserUploads(uploads);
      stagedPaths = staged.paths;
      setSubmitPhase("submitting");
      let response: Response;
      try {
        response = await fetch("/api/student-club/application", {
          method: "POST",
          headers: {
            "content-type": "application/json",
            "x-cadesca-turnstile": turnstileToken
          },
          body: JSON.stringify({
            fields: {
              ...payload,
              draftId,
              agreementAccepted: data.get("agreementAccepted") === "true"
            },
            uploads: staged.references
          })
        });
      } catch {
        throw new Error("network_error");
      }
      const body = await response.json() as { ok?: boolean; error?: string; clubId?: string };
      if (!response.ok || !body.ok || !body.clubId) throw new Error(body.error || "application_invalid");
      router.replace(`/application/${body.clubId}/status`);
      router.refresh();
    } catch (caught) {
      await cleanupStagedUploads(stagedPaths);
      setError(errorMessage(caught instanceof Error ? caught.message : "application_invalid"));
      setTurnstileToken("");
      setTurnstileReset((value) => value + 1);
    } finally {
      setSubmitting(false);
      setSubmitPhase("idle");
    }
  }

  function validateStep(stepNumber: number) {
    if (stepNumber === 1) {
      if (!payload.universityId) return "Select your university.";
      if (payload.clubName.trim().length < 2) return "Enter the club name.";
      if (payload.description.trim().length < 20) return "Add a club description of at least 20 characters.";
      if (!logoSelected) return "Select a club logo before continuing. Files are not stored in saved drafts.";
    }
    if (stepNumber === 2 && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(payload.officialEmail.trim())) {
      return "Enter a valid official club email.";
    }
    return "";
  }

  async function navigateToStep(number: number) {
    if (number <= step) {
      setStep(number);
      setError("");
      return;
    }
    const validation = validateStep(step);
    if (validation) {
      setError(validation);
      return;
    }
    if (await saveDraft(number)) setStep(number);
  }

  return (
    <form onSubmit={submitApplication} className="min-w-0">
      <nav aria-label="Application progress" className="mb-6 overflow-x-auto pb-1">
        <ol className="flex min-w-max items-center gap-2">
          {STEPS.map((label, index) => {
            const number = index + 1;
            return <li key={label}>
              <button type="button" onClick={() => void navigateToStep(number)} aria-current={step === number ? "step" : undefined} className={`inline-flex min-h-10 items-center gap-2 rounded-full border px-3 text-xs font-bold ${step === number ? "border-black bg-black text-white" : "border-black/20 bg-white text-black"}`}>
                <span className={`flex h-5 w-5 items-center justify-center rounded-full text-[10px] ${step === number ? "bg-[#FFD84D] text-black" : "bg-black/5"}`}>{number}</span>
                {label}
              </button>
            </li>;
          })}
        </ol>
      </nav>

      <section className="rounded-2xl border border-[#E4E1D8] bg-white p-5 shadow-sm sm:p-7">
        <div className={step === 1 ? "block" : "hidden"} aria-hidden={step !== 1}>
          <p className="text-xs font-bold uppercase tracking-[0.14em] text-black/45">Step 1 of 5</p>
          <h2 className="mt-2 text-2xl font-semibold tracking-[-0.025em]">Club information</h2>
          <p className="mt-2 text-sm leading-6 text-black/55">Tell us how the club should appear across Cadesca.</p>
          <div className="mt-6 grid gap-4 sm:grid-cols-2">
            <Field label="University" className="sm:col-span-2">
              <select required value={payload.universityId} onChange={(event) => update("universityId", event.target.value)} className={inputClass}>
                <option value="">Select a university</option>
                {universities.map((university) => <option key={university.id} value={university.id}>{university.name}</option>)}
              </select>
            </Field>
            <Field label="Club name"><input required maxLength={140} value={payload.clubName} onChange={(event) => update("clubName", event.target.value)} className={inputClass} /></Field>
            <Field label="Short name / acronym"><input maxLength={20} value={payload.acronym} onChange={(event) => update("acronym", event.target.value)} className={inputClass} placeholder="e.g. BILMUN" /></Field>
            <Field label="Category"><input maxLength={80} value={payload.category} onChange={(event) => update("category", event.target.value)} className={inputClass} placeholder="Academic, culture, sports…" /></Field>
            <Field label="Founded year"><input inputMode="numeric" pattern="[0-9]{4}" maxLength={4} value={payload.foundedYear} onChange={(event) => update("foundedYear", event.target.value.replace(/\D/g, "").slice(0, 4))} className={inputClass} /></Field>
            <Field label="Description" className="sm:col-span-2"><textarea required minLength={20} maxLength={4000} rows={6} value={payload.description} onChange={(event) => update("description", event.target.value)} className={`${inputClass} resize-y`} /></Field>
            <Field label="Club logo"><input name="logo" required={step === 1} onChange={(event) => void validateFileSelection(event, "logo")} type="file" accept={CLUB_IMAGE_ACCEPT} className={`${inputClass} file:mr-3 file:rounded-lg file:border-0 file:bg-black file:px-3 file:py-2 file:text-sm file:font-bold file:text-white`} /><span className="mt-2 block text-xs leading-5 text-black/45">JPG, PNG, WebP, HEIC or HEIF, up to 4 MB.</span></Field>
            <Field label="Cover image (optional)"><input name="cover" onChange={(event) => void validateFileSelection(event, "cover")} type="file" accept={CLUB_IMAGE_ACCEPT} className={`${inputClass} file:mr-3 file:rounded-lg file:border-0 file:bg-black file:px-3 file:py-2 file:text-sm file:font-bold file:text-white`} /><span className="mt-2 block text-xs leading-5 text-black/45">JPG, PNG, WebP, HEIC or HEIF, up to 4 MB.</span></Field>
          </div>
        </div>

        <div className={step === 2 ? "block" : "hidden"} aria-hidden={step !== 2}>
          <p className="text-xs font-bold uppercase tracking-[0.14em] text-black/45">Step 2 of 5</p>
          <h2 className="mt-2 text-2xl font-semibold tracking-[-0.025em]">Contact information</h2>
          <div className="mt-6 rounded-xl bg-[#F7F5EF] p-4">
            <p className="text-xs font-bold uppercase tracking-[0.08em] text-black/45">Applicant</p>
            <p className="mt-2 font-semibold">{applicant.name}</p><p className="mt-1 text-sm text-black/55">{applicant.email}</p>
          </div>
          <div className="mt-5 grid gap-4 sm:grid-cols-2">
            <Field label="Official club email"><input required type="email" autoComplete="email" maxLength={254} value={payload.officialEmail} onChange={(event) => update("officialEmail", event.target.value)} className={inputClass} /></Field>
            <Field label="Phone (optional)"><input type="tel" autoComplete="tel" maxLength={40} value={payload.contactPhone} onChange={(event) => update("contactPhone", event.target.value)} className={inputClass} /></Field>
            <Field label="Website"><input type="url" inputMode="url" value={payload.websiteUrl} onChange={(event) => update("websiteUrl", event.target.value)} className={inputClass} placeholder="https://" /></Field>
            <Field label="Instagram"><input type="url" inputMode="url" value={payload.instagramUrl} onChange={(event) => update("instagramUrl", event.target.value)} className={inputClass} placeholder="https://instagram.com/…" /></Field>
            <Field label="LinkedIn"><input type="url" inputMode="url" value={payload.linkedinUrl} onChange={(event) => update("linkedinUrl", event.target.value)} className={inputClass} placeholder="https://linkedin.com/…" /></Field>
            <Field label="Other social link"><input type="url" inputMode="url" value={payload.otherSocialUrl} onChange={(event) => update("otherSocialUrl", event.target.value)} className={inputClass} placeholder="https://" /></Field>
          </div>
        </div>

        <div className={step === 3 ? "block" : "hidden"} aria-hidden={step !== 3}>
          <p className="text-xs font-bold uppercase tracking-[0.14em] text-black/45">Step 3 of 5</p>
          <h2 className="mt-2 text-2xl font-semibold tracking-[-0.025em]">Club leadership</h2>
          <p className="mt-2 text-sm leading-6 text-black/55">These names help Cadesca verify the organization. Team accounts can be linked after approval.</p>
          <div className="mt-6 grid gap-4 sm:grid-cols-2">
            <Field label="President"><input maxLength={120} value={payload.president} onChange={(event) => update("president", event.target.value)} className={inputClass} /></Field>
            <Field label="Vice president"><input maxLength={120} value={payload.vicePresident} onChange={(event) => update("vicePresident", event.target.value)} className={inputClass} /></Field>
            <Field label="Board members / organizers" className="sm:col-span-2"><textarea rows={5} maxLength={2000} value={payload.boardMembers} onChange={(event) => update("boardMembers", event.target.value)} className={`${inputClass} resize-y`} placeholder="One person per line" /></Field>
            <Field label="Faculty advisor (optional)" className="sm:col-span-2"><input maxLength={160} value={payload.facultyAdvisor} onChange={(event) => update("facultyAdvisor", event.target.value)} className={inputClass} /></Field>
          </div>
        </div>

        <div className={step === 4 ? "block" : "hidden"} aria-hidden={step !== 4}>
          <p className="text-xs font-bold uppercase tracking-[0.14em] text-black/45">Step 4 of 5</p>
          <h2 className="mt-2 text-2xl font-semibold tracking-[-0.025em]">Verification</h2>
          <div className="mt-6 grid gap-4">
            <Field label="University recognition status">
              <select value={payload.recognitionStatus} onChange={(event) => update("recognitionStatus", event.target.value as ClubApplicationDraftPayload["recognitionStatus"])} className={inputClass}>
                <option value="not_declared">Not declared</option><option value="recognized">Officially recognized</option><option value="pending_confirmation">Pending university confirmation</option><option value="not_recognized">Not officially recognized</option>
              </select>
            </Field>
            <Field label="Proof of affiliation (optional)"><input name="recognitionDocument" onChange={(event) => void validateFileSelection(event, "recognitionDocument")} type="file" accept={CLUB_DOCUMENT_ACCEPT} className={`${inputClass} file:mr-3 file:rounded-lg file:border-0 file:bg-black file:px-3 file:py-2 file:text-sm file:font-bold file:text-white`} /><span className="mt-2 block text-xs leading-5 text-black/45">PDF, JPG, PNG, WebP, HEIC or HEIF, up to 9 MB. This file is private and visible only to authorized Cadesca reviewers.</span></Field>
            <Field label="Additional context"><textarea rows={5} maxLength={2000} value={payload.additionalNote} onChange={(event) => update("additionalNote", event.target.value)} className={`${inputClass} resize-y`} /></Field>
          </div>
        </div>

        <div className={step === 5 ? "block" : "hidden"} aria-hidden={step !== 5}>
          <p className="text-xs font-bold uppercase tracking-[0.14em] text-black/45">Step 5 of 5</p>
          <h2 className="mt-2 text-2xl font-semibold tracking-[-0.025em]">Review application</h2>
          <dl className="mt-6 divide-y divide-black/10 rounded-xl border border-black/10 bg-[#F7F5EF] px-4">
            {[["Club", payload.clubName || "Not provided"], ["University", selectedUniversity], ["Official email", payload.officialEmail || "Not provided"], ["Category", payload.category || "Not provided"], ["Applicant", `${applicant.name} · ${applicant.email}`]].map(([term, value]) => <div key={term} className="grid gap-1 py-3 sm:grid-cols-[150px_1fr]"><dt className="text-xs font-bold uppercase tracking-[0.08em] text-black/45">{term}</dt><dd className="break-words text-sm font-semibold">{value}</dd></div>)}
          </dl>
          <label className="mt-5 flex items-start gap-3 rounded-xl border border-black/10 p-4 text-sm leading-6">
            <input name="agreementAccepted" type="checkbox" value="true" required className="mt-1 h-4 w-4 shrink-0 accent-black" />
            <span>I confirm that this information is accurate and I am authorized to submit it for the club.</span>
          </label>
          <div className="mt-5">{step === 5 ? <TurnstileWidget action="club_application" resetSignal={turnstileReset} onVerify={setTurnstileToken} errorMessage="The security check could not load. Refresh and try again." /> : null}</div>
        </div>
      </section>

      <div className="sticky bottom-0 z-10 -mx-2 mt-5 flex flex-wrap items-center justify-between gap-3 border-t border-black/10 bg-[#F7F5EF]/95 px-2 py-4 pb-[max(1rem,env(safe-area-inset-bottom))] backdrop-blur">
        <div className="flex items-center gap-2">
          {step > 1 ? <button type="button" onClick={() => setStep((value) => Math.max(1, value - 1))} className={secondaryButton}>Back</button> : null}
          <button type="button" onClick={() => void saveDraft()} disabled={saving || submitting} className={secondaryButton}>{saving ? "Saving…" : "Save draft"}</button>
        </div>
        {step < 5 ? <button type="button" onClick={() => void nextStep()} disabled={saving} className={primaryButton}>Continue</button> : <button type="submit" disabled={submitting || !turnstileToken} className={`${primaryButton} bg-[#FFD84D] text-black hover:bg-[#F2C230]`}>{submitPhase === "uploading" ? "Uploading files…" : submitPhase === "submitting" ? "Submitting…" : "Submit application"}</button>}
      </div>
      <div aria-live="polite" className="min-h-6 text-sm font-semibold">{error ? <p role="alert" className="text-red-700">{error}</p> : message ? <p className="text-emerald-700">{message}</p> : null}</div>
    </form>
  );
}
