"use client";

import { useMemo, useState } from "react";
import type { FormEvent } from "react";
import { useSearchParams } from "next/navigation";

import { AuthShell } from "@/components/auth/AuthShell";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";

function emailDomain(email: string) {
  if (!email.includes("@")) return "";
  return email.split("@").pop()?.trim().toLowerCase() || "";
}

export function RequestUniversityPageClient() {
  const searchParams = useSearchParams();
  const initialEmail = searchParams.get("email") || "";
  const initialDomain = searchParams.get("domain") || emailDomain(initialEmail);
  const [email, setEmail] = useState(initialEmail);
  const [universityName, setUniversityName] = useState("");
  const [country, setCountry] = useState("");
  const [websiteUrl, setWebsiteUrl] = useState("");
  const [note, setNote] = useState("");
  const [status, setStatus] = useState<"idle" | "submitting" | "sent">("idle");
  const [error, setError] = useState("");
  const domain = useMemo(() => emailDomain(email) || initialDomain, [email, initialDomain]);

  async function submitRequest(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setStatus("submitting");

    const response = await fetch("/api/auth/university-access", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, universityName, country, websiteUrl, note })
    });

    if (!response.ok) {
      setStatus("idle");
      setError("We could not submit this request. Check the email and try again.");
      return;
    }

    setStatus("sent");
  }

  return (
    <AuthShell
      title="University not listed yet"
      subtitle="Cadesca is expanding university by university. Request access and we'll review your campus domain."
    >
      {status === "sent" ? (
        <div className="space-y-4">
          <p className="rounded-lg border border-outline-variant/70 bg-surface-container-low p-3 text-label-md font-semibold text-primary">
            Request submitted. We will review this campus domain before enabling signups.
          </p>
          <a className="block text-center text-label-md font-semibold text-secondary transition-colors hover:text-primary" href="/login">
            Back to login
          </a>
        </div>
      ) : (
        <form className="space-y-4" onSubmit={submitRequest}>
          <Input label="University email" icon="mail" type="email" value={email} onChange={(event) => setEmail(event.target.value)} required />
          <Input label="University email domain" icon="alternate_email" value={domain} readOnly />
          <Input label="University name" icon="school" value={universityName} onChange={(event) => setUniversityName(event.target.value)} />
          <Input label="Country" icon="public" value={country} onChange={(event) => setCountry(event.target.value)} />
          <Input label="University website" icon="language" type="url" value={websiteUrl} onChange={(event) => setWebsiteUrl(event.target.value)} />
          <textarea
            className="min-h-[96px] w-full rounded-lg border border-outline-variant/70 bg-surface-container-lowest px-3 py-3 text-label-md text-primary outline-none transition-colors placeholder:text-secondary focus:border-primary"
            placeholder="Optional note"
            value={note}
            onChange={(event) => setNote(event.target.value)}
          />
          <Button type="submit" size="lg" className="w-full" icon="send" disabled={status === "submitting"}>
            {status === "submitting" ? "Submitting" : "Request access"}
          </Button>
          <a className="block text-center text-label-md font-semibold text-secondary transition-colors hover:text-primary" href="/signup">
            Back to signup
          </a>
          {error ? <p className="rounded-lg border border-outline-variant/70 bg-surface-container-low p-3 text-caption font-semibold text-secondary">{error}</p> : null}
        </form>
      )}
    </AuthShell>
  );
}
