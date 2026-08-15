import Link from "next/link";

import { LanguageSwitcher } from "@/components/ui/LanguageSwitcher";
import { Logo } from "@/components/ui/Logo";

export function ClubLoginScreen({ authHref }: { authHref: string }) {
  return (
    <main className="min-h-screen bg-[#F7F5EF] text-[#0A0A0A]">
      <header className="border-b border-[#E4E1D8] bg-white/90 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-5 py-4 sm:px-8">
          <Logo maxWidth={132} />
          <LanguageSwitcher />
        </div>
      </header>

      <div className="mx-auto flex min-h-[calc(100vh-73px)] max-w-2xl items-center px-5 py-12 sm:px-8">
        <section className="w-full rounded-2xl border border-[#E4E1D8] bg-white p-7 shadow-sm sm:p-10">
          <span className="material-symbols-outlined flex h-12 w-12 items-center justify-center rounded-xl bg-[#FFF3B8] text-[#0A0A0A]" aria-hidden="true">groups</span>
          <p className="mt-6 text-xs font-bold uppercase tracking-[0.16em] text-[#696969]">Cadesca Student Club</p>
          <h1 className="mt-3 text-3xl font-semibold tracking-[-0.035em] sm:text-4xl">Student Club</h1>
          <p className="mt-4 max-w-xl text-sm leading-6 text-[#696969]">
            Sign in with your Cadesca account to apply for a club or access an approved club workspace.
          </p>
          <Link
            href={authHref}
            className="mt-8 inline-flex h-12 w-full items-center justify-center rounded-xl bg-[#0A0A0A] px-5 text-sm font-semibold text-white transition-colors hover:bg-[#252525] sm:w-auto"
          >
            Login via Cadesca
          </Link>
        </section>
      </div>
    </main>
  );
}
