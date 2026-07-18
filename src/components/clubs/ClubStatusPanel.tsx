"use client";

import Link from "next/link";

import type { ClubApplicationView } from "@/lib/server/studentClubs";
import { LanguageSwitcher } from "@/components/ui/LanguageSwitcher";
import { Logo } from "@/components/ui/Logo";
import { clubCopy } from "@/lib/clubs/localization";
import { useLanguage } from "@/lib/i18n";
import { ClubApplicationUpdateForm } from "@/components/clubs/ClubApplicationUpdateForm";

const STATUS_BODY = {
  pending_review: "pendingBody",
  clarification_requested: "clarificationBody",
  approved: "approvedBody",
  rejected: "rejectedBody",
  suspended: "suspendedBody",
  archived: "archivedBody"
} as const;

function formatDate(value: string, language: string) {
  const locale = language === "az" ? "az-AZ" : language === "tr" ? "tr-TR" : language === "ru" ? "ru-RU" : "en-US";
  return new Intl.DateTimeFormat(locale, { dateStyle: "medium", timeStyle: "short" }).format(new Date(value));
}

export function ClubStatusPanel({
  application,
  authenticated,
  authHref,
  dashboardHref
}: {
  application: ClubApplicationView | null;
  authenticated: boolean;
  authHref: string;
  dashboardHref: string;
}) {
  const { language } = useLanguage();
  const copy = (key: Parameters<typeof clubCopy>[1]) => clubCopy(language, key);

  return (
    <main className="min-h-screen bg-[#F7F5EF] text-[#0A0A0A]">
      <header className="border-b border-[#E4E1D8] bg-white">
        <div className="mx-auto flex max-w-4xl items-center justify-between px-5 py-4 sm:px-8">
          <Logo maxWidth={132} />
          <LanguageSwitcher />
        </div>
      </header>

      <div className="mx-auto max-w-4xl px-5 py-12 sm:px-8 sm:py-16">
        <p className="text-xs font-bold uppercase tracking-[0.16em] text-[#696969]">{copy("eyebrow")}</p>
        <h1 className="mt-3 text-3xl font-semibold tracking-[-0.035em] sm:text-4xl">{copy("statusTitle")}</h1>
        <p className="mt-3 text-sm leading-6 text-[#696969]">{copy("statusSubtitle")}</p>

        {!authenticated ? (
          <div className="mt-8 rounded-2xl border border-[#E4E1D8] bg-white p-8 text-center shadow-sm">
            <span className="material-symbols-outlined text-4xl text-[#696969]" aria-hidden="true">lock</span>
            <p className="mt-4 text-sm font-medium text-[#696969]">{copy("loginRequired")}</p>
            <Link href={authHref} className="mt-5 inline-flex h-11 items-center justify-center rounded-xl bg-[#FFD84D] px-5 text-sm font-semibold text-[#0A0A0A] hover:bg-[#F2C230]">
              {copy("login")}
            </Link>
          </div>
        ) : !application ? (
          <div className="mt-8 rounded-2xl border border-[#E4E1D8] bg-white p-8 text-center shadow-sm">
            <span className="material-symbols-outlined text-4xl text-[#696969]" aria-hidden="true">assignment</span>
            <p className="mt-4 text-sm font-medium text-[#696969]">{copy("noApplication")}</p>
            <Link href="/student-club" className="mt-5 inline-flex h-11 items-center justify-center rounded-xl bg-[#FFD84D] px-5 text-sm font-semibold text-[#0A0A0A] hover:bg-[#F2C230]">
              {copy("newApplication")}
            </Link>
          </div>
        ) : (
          <div className="mt-8 space-y-5">
            <section className="overflow-hidden rounded-2xl border border-[#E4E1D8] bg-white shadow-sm">
              <div className="flex flex-wrap items-start justify-between gap-4 border-b border-[#E4E1D8] p-6">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.1em] text-[#696969]">{application.universityName}</p>
                  <h2 className="mt-2 text-2xl font-semibold tracking-[-0.025em]">{application.name}</h2>
                </div>
                <span className={`rounded-full px-3 py-1.5 text-xs font-bold ${application.status === "approved" ? "bg-emerald-100 text-emerald-900" : application.status === "rejected" || application.status === "suspended" ? "bg-red-100 text-red-900" : "bg-[#FFF3B8] text-[#0A0A0A]"}`}>
                  {copy(application.status)}
                </span>
              </div>
              <div className="p-6">
                <p className="text-sm leading-6 text-[#696969]">{copy(STATUS_BODY[application.status])}</p>
                <dl className="mt-6 grid gap-4 border-t border-[#E4E1D8] pt-5 text-sm sm:grid-cols-2">
                  <div>
                    <dt className="text-xs font-semibold uppercase tracking-[0.08em] text-[#696969]">{copy("submittedOn")}</dt>
                    <dd className="mt-1.5 font-medium">{formatDate(application.createdAt, language)}</dd>
                  </div>
                  <div>
                    <dt className="text-xs font-semibold uppercase tracking-[0.08em] text-[#696969]">{copy("representative")}</dt>
                    <dd className="mt-1.5 font-medium">{application.representative.name}</dd>
                  </div>
                </dl>
              </div>
            </section>

            {application.clarificationMessage || application.rejectionReason || application.suspensionReason ? (
              <section className="rounded-2xl border border-[#E4E1D8] bg-[#FFF3B8] p-6">
                <h2 className="text-sm font-semibold">{copy("decisionNote")}</h2>
                <p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-[#4A4A4A]">
                  {application.clarificationMessage || application.rejectionReason || application.suspensionReason}
                </p>
              </section>
            ) : null}

            {application.status === "pending_review" || application.status === "clarification_requested" ? (
              <ClubApplicationUpdateForm application={application} />
            ) : null}

            <p className="rounded-xl bg-[#0A0A0A] p-5 text-sm leading-6 text-white/75">{copy("restrictedNotice")}</p>

            {application.status === "approved" ? (
              <Link href={dashboardHref} className="inline-flex h-12 w-full items-center justify-center rounded-xl bg-[#FFD84D] px-5 font-semibold text-[#0A0A0A] hover:bg-[#F2C230]">
                {copy("dashboard")}
              </Link>
            ) : null}
          </div>
        )}
      </div>
    </main>
  );
}
