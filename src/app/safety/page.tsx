import Link from "next/link";
import { Logo } from "@/components/ui/Logo";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Safety Center - Cadesca",
};

export default function SafetyPage() {
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
        <h1 className="text-headline-lg-mobile font-bold text-primary mb-2">Safety Center</h1>
        <p className="text-body-md text-secondary mb-10">Last updated: July 2026</p>

        <section className="mb-10">
          <h2 className="text-body-lg font-bold text-primary mb-3">Your Safety Matters</h2>
          <p className="text-body-md text-on-surface-variant leading-relaxed mb-4">
            Cadesca is committed to creating a safe and respectful environment for all university students. Your well-being is our top priority.
          </p>
        </section>

        <section className="mb-10">
          <h2 className="text-body-lg font-bold text-primary mb-3">Verified Community</h2>
          <p className="text-body-md text-on-surface-variant leading-relaxed mb-4">
            Every Cadesca user is verified through their university email. This means you always know you&apos;re interacting with real students from your campus, creating a trusted and accountable community.
          </p>
        </section>

        <section className="mb-10">
          <h2 className="text-body-lg font-bold text-primary mb-3">Reporting</h2>
          <p className="text-body-md text-on-surface-variant leading-relaxed mb-4">
            If you encounter content or behavior that makes you feel unsafe, you can report it directly from the app. Tap the flag icon on any post to submit a report. Our team reviews all reports promptly.
          </p>
        </section>

        <section className="mb-10">
          <h2 className="text-body-lg font-bold text-primary mb-3">Blocking and Muting</h2>
          <p className="text-body-md text-on-surface-variant leading-relaxed mb-4">
            You have full control over your experience. You can block or mute other users to prevent them from interacting with you or appearing in your feed.
          </p>
        </section>

        <section className="mb-10">
          <h2 className="text-body-lg font-bold text-primary mb-3">Content Moderation</h2>
          <p className="text-body-md text-on-surface-variant leading-relaxed mb-4">
            We actively moderate content to ensure it meets our Community Guidelines. Posts that contain harassment, hate speech, threats, or explicit material are removed and may result in account suspension.
          </p>
        </section>

        <section className="mb-10">
          <h2 className="text-body-lg font-bold text-primary mb-3">Data Protection</h2>
          <p className="text-body-md text-on-surface-variant leading-relaxed mb-4">
            Your personal information is protected with enterprise-grade security. We never share your email, location, or private data with other users without your explicit consent.
          </p>
        </section>

        <section className="mb-10">
          <h2 className="text-body-lg font-bold text-primary mb-3">Emergency Resources</h2>
          <p className="text-body-md text-on-surface-variant leading-relaxed mb-4">
            If you or someone you know is in immediate danger, please contact local emergency services. Cadesca is not an emergency service.
          </p>
        </section>

        <section className="mb-10">
          <h2 className="text-body-lg font-bold text-primary mb-3">Contact</h2>
          <p className="text-body-md text-on-surface-variant leading-relaxed mb-4">
            For safety concerns, reach out to our team at hello@cadesca.com. We aim to respond within 24 hours.
          </p>
        </section>
      </main>

      <footer className="border-t border-outline-variant/30 py-8 text-center">
        <p className="text-body-md text-secondary">© 2026 Cadesca. All rights reserved.</p>
      </footer>
    </div>
  );
}
