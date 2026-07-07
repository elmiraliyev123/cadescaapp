"use client";

import { useState } from "react";
import type { FormEvent } from "react";

import { AuthShell } from "@/components/auth/AuthShell";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";

function strongPassword(value: string) {
  return value.length >= 8 && /[A-Za-z]/.test(value) && /\d/.test(value) && /[^A-Za-z0-9]/.test(value);
}

export function ResetPasswordPageClient({ initialEmail = "" }: { initialEmail?: string }) {
  const [email, setEmail] = useState(initialEmail);
  const [code, setCode] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [status, setStatus] = useState<"idle" | "submitting" | "done">("idle");
  const [error, setError] = useState("");

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");

    if (password !== confirmPassword) {
      setError("Passwords do not match.");
      return;
    }
    if (!strongPassword(password)) {
      setError("Use at least 8 characters with a letter, number, and symbol.");
      return;
    }

    setStatus("submitting");
    const response = await fetch("/api/auth/user/reset-password", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, code, password })
    });

    if (!response.ok) {
      setStatus("idle");
      setError("Invalid or expired code. Request a new reset code and try again.");
      return;
    }

    setStatus("done");
  }

  return (
    <AuthShell title="Reset password" subtitle="Enter your verification code and choose a new password.">
      {status === "done" ? (
        <div className="space-y-4">
          <p className="rounded-lg border border-outline-variant/70 bg-surface-container-low p-3 text-label-md font-semibold text-primary">
            Your password has been updated.
          </p>
          <a
            className="block rounded-lg border border-outline-variant/70 bg-primary px-4 py-3 text-center text-label-md font-semibold text-on-primary transition-opacity hover:opacity-90"
            href="/login"
          >
            Log in
          </a>
        </div>
      ) : (
        <form className="space-y-4" onSubmit={submit}>
          <Input label="Email" icon="mail" name="email" type="email" value={email} onChange={(event) => setEmail(event.target.value)} autoComplete="email" required />
          <Input label="Verification code" icon="pin" name="code" value={code} onChange={(event) => setCode(event.target.value)} inputMode="numeric" maxLength={6} required />
          <Input label="New password" icon="lock" name="password" type="password" value={password} onChange={(event) => setPassword(event.target.value)} autoComplete="new-password" required />
          <Input label="Confirm password" icon="lock_reset" name="confirmPassword" type="password" value={confirmPassword} onChange={(event) => setConfirmPassword(event.target.value)} autoComplete="new-password" required />
          <Button type="submit" size="lg" className="w-full" icon="lock_reset" disabled={status === "submitting"}>
            {status === "submitting" ? "Resetting" : "Reset password"}
          </Button>
          <a className="block text-center text-label-md font-semibold text-secondary transition-colors hover:text-primary" href="/forgot-password">
            Request a new code
          </a>
          {error ? <p className="rounded-lg border border-outline-variant/70 bg-surface-container-low p-3 text-caption font-semibold text-secondary">{error}</p> : null}
        </form>
      )}
    </AuthShell>
  );
}
