import Link from "next/link";
import { Logo } from "@/components/ui/Logo";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Community Guidelines - Cadesca",
};

export default function GuidelinesPage() {
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
        <h1 className="text-headline-lg-mobile font-bold text-primary mb-2">Community Guidelines</h1>
        <p className="text-body-md text-secondary mb-10">Last updated: July 2026</p>

        <section className="mb-10">
          <h2 className="text-body-lg font-bold text-primary mb-3">Be Respectful</h2>
          <p className="text-body-md text-on-surface-variant leading-relaxed mb-4">
            Treat every member of the Cadesca community with respect and kindness. Disagree constructively and avoid personal attacks. Remember that behind every profile is a real student.
          </p>
        </section>

        <section className="mb-10">
          <h2 className="text-body-lg font-bold text-primary mb-3">Keep It Real</h2>
          <p className="text-body-md text-on-surface-variant leading-relaxed mb-4">
            Use your real name and university identity. Cadesca is built on trust and verified student communities. Impersonation, fake accounts, and misleading profiles are not allowed.
          </p>
        </section>

        <section className="mb-10">
          <h2 className="text-body-lg font-bold text-primary mb-3">No Harassment</h2>
          <p className="text-body-md text-on-surface-variant leading-relaxed mb-4">
            Harassment, bullying, hate speech, and discrimination of any kind are strictly prohibited. This includes targeting someone based on their race, gender, religion, sexual orientation, disability, or national origin.
          </p>
        </section>

        <section className="mb-10">
          <h2 className="text-body-lg font-bold text-primary mb-3">No Spam or Self-Promotion</h2>
          <p className="text-body-md text-on-surface-variant leading-relaxed mb-4">
            Do not spam the feed with repetitive posts, unsolicited advertisements, or commercial promotions. Student club and event announcements are welcome when relevant to the campus community.
          </p>
        </section>

        <section className="mb-10">
          <h2 className="text-body-lg font-bold text-primary mb-3">Respect Privacy</h2>
          <p className="text-body-md text-on-surface-variant leading-relaxed mb-4">
            Do not share others&apos; personal information, private messages, or photos without their consent. Screenshots of private conversations shared publicly violate this policy.
          </p>
        </section>

        <section className="mb-10">
          <h2 className="text-body-lg font-bold text-primary mb-3">Academic Integrity</h2>
          <p className="text-body-md text-on-surface-variant leading-relaxed mb-4">
            Do not use Cadesca to facilitate academic dishonesty, share exam answers, or promote cheating services.
          </p>
        </section>

        <section className="mb-10">
          <h2 className="text-body-lg font-bold text-primary mb-3">Report, Don&apos;t Retaliate</h2>
          <p className="text-body-md text-on-surface-variant leading-relaxed mb-4">
            If you see something that violates these guidelines, report it using the in-app reporting tool. Do not engage in retaliatory behavior or public shaming.
          </p>
        </section>

        <section className="mb-10">
          <h2 className="text-body-lg font-bold text-primary mb-3">Consequences</h2>
          <p className="text-body-md text-on-surface-variant leading-relaxed mb-4">
            Violations of these guidelines may result in content removal, temporary suspension, or permanent account ban, depending on the severity and frequency of the violation.
          </p>
        </section>

        <section className="mb-10">
          <h2 className="text-body-lg font-bold text-primary mb-3">Contact</h2>
          <p className="text-body-md text-on-surface-variant leading-relaxed mb-4">
            If you have questions about these guidelines, contact us at hello@cadesca.com.
          </p>
        </section>
      </main>

      <footer className="border-t border-outline-variant/30 py-8 text-center">
        <p className="text-body-md text-secondary">© 2026 Cadesca. All rights reserved.</p>
      </footer>
    </div>
  );
}
