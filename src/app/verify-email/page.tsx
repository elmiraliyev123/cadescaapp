import { AuthShell } from "@/components/auth/AuthShell";

export const dynamic = "force-dynamic";

export default function VerifyEmailPage() {
  return (
    <AuthShell title="Verify your email" subtitle="Enter the verification code from signup to continue.">
      <div className="space-y-4">
        <p className="rounded-lg border border-outline-variant/70 bg-surface-container-low p-3 text-label-md font-semibold text-primary">
          Start signup with your university email. We will send the verification code before account details are collected.
        </p>
        <a
          className="block rounded-lg border border-outline-variant/70 bg-primary px-4 py-3 text-center text-label-md font-semibold text-on-primary transition-opacity hover:opacity-90"
          href="/signup"
        >
          Sign up
        </a>
      </div>
    </AuthShell>
  );
}
