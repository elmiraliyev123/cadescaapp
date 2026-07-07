import Link from "next/link";
import { Logo } from "@/components/ui/Logo";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Privacy Policy - Cadesca",
};

export default function PrivacyPage() {
  return (
    <div className="min-h-dvh bg-surface text-on-surface font-sans antialiased">
      <header className="border-b border-outline-variant/30 bg-surface-container-lowest">
        <div className="mx-auto flex h-16 max-w-3xl items-center justify-between px-5">
          <Link href="/" aria-label="Cadesca home">
            <Logo maxWidth={120} imgClassName="h-auto w-[100px] object-contain" />
          </Link>
          <Link href="/" className="text-label-md text-secondary hover:text-primary transition-colors">← Back</Link>
        </div>
      </header>

      <main className="mx-auto max-w-3xl px-5 py-12">
        <h1 className="text-headline-lg-mobile font-bold text-primary mb-2">Privacy Policy</h1>
        <p className="text-body-md text-secondary mb-10">Last updated: July 2026</p>

        <section className="mb-10">
          <h2 className="text-body-lg font-bold text-primary mb-3">Information We Collect</h2>
          <p className="text-body-md text-on-surface-variant leading-relaxed mb-4">
            We collect your name, university email address, and profile information when you create a Cadesca account. We also collect usage data such as posts, likes, comments, and interactions within your university community. We do not sell your personal data to third parties.
          </p>
        </section>

        <section className="mb-10">
          <h2 className="text-body-lg font-bold text-primary mb-3">How We Use Your Information</h2>
          <p className="text-body-md text-on-surface-variant leading-relaxed mb-4">
            Your information is used to verify your student status, connect you with your university community, personalize your feed, and improve our services. Your university email is used solely for verification and account security.
          </p>
        </section>

        <section className="mb-10">
          <h2 className="text-body-lg font-bold text-primary mb-3">Data Storage and Security</h2>
          <p className="text-body-md text-on-surface-variant leading-relaxed mb-4">
            Your data is stored securely using industry-standard encryption and access controls. We use Supabase as our database provider with Row Level Security (RLS) policies to ensure your data is only accessible to authorized users.
          </p>
        </section>

        <section className="mb-10">
          <h2 className="text-body-lg font-bold text-primary mb-3">Your Rights</h2>
          <p className="text-body-md text-on-surface-variant leading-relaxed mb-4">
            You can update or delete your profile information at any time through your account settings. You may request a full export or deletion of your data by contacting us at hello@cadesca.com.
          </p>
        </section>

        <section className="mb-10">
          <h2 className="text-body-lg font-bold text-primary mb-3">Cookies and Tracking</h2>
          <p className="text-body-md text-on-surface-variant leading-relaxed mb-4">
            Cadesca uses essential cookies for authentication and language preferences. We do not use third-party advertising trackers or analytics that identify individual users.
          </p>
        </section>

        <section className="mb-10">
          <h2 className="text-body-lg font-bold text-primary mb-3">Changes to This Policy</h2>
          <p className="text-body-md text-on-surface-variant leading-relaxed mb-4">
            We may update this policy from time to time. We will notify you of significant changes through the app or via email.
          </p>
        </section>

        <section className="mb-10">
          <h2 className="text-body-lg font-bold text-primary mb-3">Contact</h2>
          <p className="text-body-md text-on-surface-variant leading-relaxed mb-4">
            For privacy-related questions, contact us at hello@cadesca.com.
          </p>
        </section>
      </main>

      <footer className="border-t border-outline-variant/30 py-8 text-center">
        <p className="text-body-md text-secondary">© 2026 Cadesca. All rights reserved.</p>
      </footer>
    </div>
  );
}
