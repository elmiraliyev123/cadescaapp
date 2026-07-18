"use client";

import Link from "next/link";

import { ClubApplicationForm } from "@/components/clubs/ClubApplicationForm";
import { LanguageSwitcher } from "@/components/ui/LanguageSwitcher";
import { Logo } from "@/components/ui/Logo";
import { clubCopy } from "@/lib/clubs/localization";
import { useLanguage } from "@/lib/i18n";

type UniversityOption = { id: string; name: string };

export function ClubApplicationScreen({ universities }: { universities: UniversityOption[] }) {
  const { language } = useLanguage();
  const copy = (key: Parameters<typeof clubCopy>[1]) => clubCopy(language, key);

  return (
    <main className="min-h-screen bg-[#F7F5EF] text-[#0A0A0A]">
      <header className="border-b border-[#E4E1D8] bg-white/90 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-5 py-4 sm:px-8">
          <Logo maxWidth={132} />
          <div className="flex items-center gap-3">
            <Link href="/student-club/status" className="hidden text-sm font-semibold text-[#0A0A0A] hover:underline sm:inline">
              {copy("viewStatus")}
            </Link>
            <LanguageSwitcher />
          </div>
        </div>
      </header>

      <div className="mx-auto grid max-w-6xl gap-10 px-5 py-10 sm:px-8 lg:grid-cols-[minmax(0,0.72fr)_minmax(0,1.28fr)] lg:py-16">
        <aside className="lg:sticky lg:top-8 lg:self-start">
          <p className="text-xs font-bold uppercase tracking-[0.16em] text-[#696969]">{copy("eyebrow")}</p>
          <h1 className="mt-4 max-w-xl text-4xl font-semibold leading-tight tracking-[-0.04em] sm:text-5xl">
            {copy("title")}
          </h1>
          <p className="mt-5 max-w-xl text-base leading-7 text-[#696969]">{copy("subtitle")}</p>

          <div className="mt-8 rounded-2xl bg-[#0A0A0A] p-6 text-white">
            <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-[#FFD84D] text-[#0A0A0A]">
              <span className="material-symbols-outlined" aria-hidden="true">verified_user</span>
            </div>
            <p className="mt-4 text-sm leading-6 text-white/75">{copy("restrictedNotice")}</p>
          </div>
        </aside>

        <section>
          {universities.length ? (
            <ClubApplicationForm universities={universities} />
          ) : (
            <div className="rounded-2xl border border-[#E4E1D8] bg-white p-8 text-center shadow-sm">
              <span className="material-symbols-outlined text-4xl text-[#696969]" aria-hidden="true">school</span>
              <p className="mx-auto mt-4 max-w-md text-sm leading-6 text-[#696969]">{copy("universityUnavailable")}</p>
            </div>
          )}
        </section>
      </div>
    </main>
  );
}
