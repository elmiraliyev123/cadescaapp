"use client";

import { useState } from "react";
import type { FormEvent } from "react";

import { AuthShell } from "@/components/auth/AuthShell";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";

export function ForgotPasswordPageClient() {
  const [email, setEmail] = useState("");
  const [status, setStatus] = useState<"idle" | "sending" | "sent">("idle");
  const [error, setError] = useState("");

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setStatus("sending");

    const response = await fetch("/api/auth/send-verification-code", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, purpose: "password_reset", locale: "en" })
    });

    if (!response.ok) {
      setStatus("idle");
      setError("We could not send a reset code. Check the email and try again.");
      return;
    }

    setStatus("sent");
  }

  return (
    <AuthShell title="Forgot password?" subtitle="Enter your account email and we'll send a verification code.">
      {status === "sent" ? (
        <div className="space-y-4">
          <p className="rounded-lg border border-outline-variant/70 bg-surface-container-low p-3 text-label-md font-semibold text-primary">
            Check your email for a six-digit reset code.
          </p>
          <a
            className="block rounded-lg border border-outline-variant/70 bg-primary px-4 py-3 text-center text-label-md font-semibold text-on-primary transition-opacity hover:opacity-90"
            href={`/reset-password?email=${encodeURIComponent(email)}`}
          >
            Enter reset code
          </a>
        </div>
      ) : (
        <form className="space-y-4" onSubmit={submit}>
          <Input label="Email" icon="mail" name="email" type="email" autoComplete="email" value={email} onChange={(event) => setEmail(event.target.value)} required />
          <Button type="submit" size="lg" className="w-full" icon="arrow_forward" disabled={status === "sending"}>
            {status === "sending" ? "Sending" : "Send reset code"}
          </Button>
          <a className="block text-center text-label-md font-semibold text-secondary transition-colors hover:text-primary" href="/login">
            Back to login
          </a>
          {error ? <p className="rounded-lg border border-outline-variant/70 bg-surface-container-low p-3 text-caption font-semibold text-secondary">{error}</p> : null}
        </form>
      )}
    </AuthShell>
  );
}
