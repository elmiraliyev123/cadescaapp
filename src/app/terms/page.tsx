import Link from "next/link";
import { Logo } from "@/components/ui/Logo";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Terms of Use - Cadesca",
};

export default function TermsPage() {
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
        <h1 className="text-headline-lg-mobile font-bold text-primary mb-2">Terms of Use</h1>
        <p className="text-body-md text-secondary mb-10">Last updated: July 2026</p>

        <section className="mb-10">
          <h2 className="text-body-lg font-bold text-primary mb-3">Acceptance of Terms</h2>
          <p className="text-body-md text-on-surface-variant leading-relaxed mb-4">
            By creating a Cadesca account, you agree to these Terms of Use. If you do not agree, please do not use our services.
          </p>
        </section>

        <section className="mb-10">
          <h2 className="text-body-lg font-bold text-primary mb-3">Eligibility</h2>
          <p className="text-body-md text-on-surface-variant leading-relaxed mb-4">
            Cadesca is available to students enrolled at supported universities. You must use a valid university email address to register and verify your account.
          </p>
        </section>

        <section className="mb-10">
          <h2 className="text-body-lg font-bold text-primary mb-3">Your Account</h2>
          <p className="text-body-md text-on-surface-variant leading-relaxed mb-4">
            You are responsible for maintaining the confidentiality of your account credentials. You must provide accurate information and keep your profile up to date. You may not share your account or impersonate another person.
          </p>
        </section>

        <section className="mb-10">
          <h2 className="text-body-lg font-bold text-primary mb-3">Acceptable Use</h2>
          <p className="text-body-md text-on-surface-variant leading-relaxed mb-4">
            You agree to use Cadesca respectfully and lawfully. You may not post content that is abusive, threatening, discriminatory, sexually explicit, or violates the rights of others. You may not spam, advertise commercial products, or engage in activities that disrupt the platform.
          </p>
        </section>

        <section className="mb-10">
          <h2 className="text-body-lg font-bold text-primary mb-3">Content Ownership</h2>
          <p className="text-body-md text-on-surface-variant leading-relaxed mb-4">
            You retain ownership of content you post on Cadesca. By posting, you grant Cadesca a non-exclusive license to display your content within the platform. We do not claim ownership of your posts, photos, or comments.
          </p>
        </section>

        <section className="mb-10">
          <h2 className="text-body-lg font-bold text-primary mb-3">Termination</h2>
          <p className="text-body-md text-on-surface-variant leading-relaxed mb-4">
            We reserve the right to suspend or terminate accounts that violate these terms. You may delete your account at any time through settings.
          </p>
        </section>

        <section className="mb-10">
          <h2 className="text-body-lg font-bold text-primary mb-3">Limitation of Liability</h2>
          <p className="text-body-md text-on-surface-variant leading-relaxed mb-4">
            Cadesca is provided &quot;as is&quot; without warranties of any kind. We are not liable for any indirect, incidental, or consequential damages arising from your use of the platform.
          </p>
        </section>

        <section className="mb-10">
          <h2 className="text-body-lg font-bold text-primary mb-3">Contact</h2>
          <p className="text-body-md text-on-surface-variant leading-relaxed mb-4">
            For questions about these terms, contact us at hello@cadesca.com.
          </p>
        </section>
      </main>

      <footer className="border-t border-outline-variant/30 py-8 text-center">
        <p className="text-body-md text-secondary">© 2026 Cadesca. All rights reserved.</p>
      </footer>
    </div>
  );
}
