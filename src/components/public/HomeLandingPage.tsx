"use client";

import { useState } from "react";
import Link from "next/link";
import { Logo } from "@/components/ui/Logo";
import { authUrl } from "@/lib/appConfig";
import { useLanguage, type Language } from "@/lib/i18n";

const LANGUAGE_LABELS: ReadonlyArray<{ value: Language; label: string; short: string }> = [
  { value: "az", label: "Azərbaycan", short: "AZ" },
  { value: "en", label: "English", short: "EN" },
  { value: "ru", label: "Русский", short: "RU" },
  { value: "tr", label: "Türkçe", short: "TR" }
];

function LanguageSwitcher() {
  const { language, setLanguage } = useLanguage();
  const [open, setOpen] = useState(false);
  const current = LANGUAGE_LABELS.find((l) => l.value === language);

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex items-center gap-1.5 rounded-full px-3 py-1.5 text-primary transition-colors hover:bg-surface-container-low active:scale-95"
      >
        <span className="material-symbols-outlined text-[20px]">language</span>
        <span className="text-label-md font-medium uppercase tracking-wider">{current?.short || "EN"}</span>
        <span className="material-symbols-outlined text-[16px]">expand_more</span>
      </button>
      {open ? (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
          <div className="absolute left-0 top-full z-50 mt-1 w-44 overflow-hidden rounded-2xl border border-outline-variant/30 bg-surface-container-lowest shadow-lg">
            {LANGUAGE_LABELS.map((lang) => (
              <button
                key={lang.value}
                type="button"
                onClick={() => {
                  setLanguage(lang.value);
                  setOpen(false);
                }}
                className={`flex w-full items-center gap-3 px-4 py-3 text-left text-body-md transition-colors hover:bg-surface-container-low ${
                  lang.value === language ? "font-bold text-primary" : "text-secondary"
                }`}
              >
                <span className="w-6 text-center text-label-md font-bold">{lang.short}</span>
                <span>{lang.label}</span>
                {lang.value === language ? (
                  <span className="material-symbols-outlined ml-auto text-[18px] text-primary">check</span>
                ) : null}
              </button>
            ))}
          </div>
        </>
      ) : null}
    </div>
  );
}

export function HomeLandingPage() {
  const { t } = useLanguage();

  return (
    <div className="flex min-h-dvh flex-col bg-surface-container-lowest font-sans antialiased">
      {/* TopAppBar */}
      <header className="fixed top-0 z-50 w-full border-b border-outline-variant/20 bg-surface-container-lowest/90 backdrop-blur-xl">
        <div className="mx-auto flex h-16 w-full max-w-[1200px] items-center justify-between px-5">
          <LanguageSwitcher />
          <div className="absolute left-1/2 -translate-x-1/2">
            <Logo maxWidth={120} imgClassName="h-auto w-[100px] object-contain" />
          </div>
          <Link
            href={`${authUrl}/login`}
            className="hidden text-label-md font-medium text-primary transition-opacity hover:opacity-70 sm:inline-flex"
          >
            {t("landing.navLogin")}
          </Link>
          <span className="sm:hidden" />
        </div>
      </header>

      {/* Main Content */}
      <main className="mx-auto flex w-full max-w-[500px] flex-1 flex-col items-center px-5 pb-32 pt-24">
        {/* Hero Section */}
        <section className="mb-12 mt-6 w-full text-center">
          <h1 className="text-[32px] font-bold leading-10 tracking-[-0.01em] text-primary">
            {t("landing.heroTitleNew")}
          </h1>
          <p className="mt-3 px-4 text-body-lg text-secondary">
            {t("landing.heroDescNew")}
          </p>
        </section>

        {/* Visual Mockup Section — Stacked Cards */}
        <section className="group relative mb-16 flex h-[420px] w-full items-center justify-center">
          {/* Card 3 (Back Right) */}
          <div className="absolute h-[360px] w-4/5 max-w-[280px] translate-x-12 translate-y-4 rotate-6 overflow-hidden rounded-[24px] border border-outline-variant/20 bg-surface-container-lowest shadow-[0_8px_30px_rgb(0,0,0,0.08)] transition-transform duration-500 ease-out group-hover:translate-x-[18px] group-hover:translate-y-[-10px] group-hover:rotate-[7deg]">
            <div className="flex h-full w-full items-center justify-center bg-surface-container-low">
              <div className="text-center">
                <span className="material-symbols-outlined text-[48px] text-secondary/40">groups</span>
                <p className="mt-2 text-label-md text-secondary/60">Community</p>
              </div>
            </div>
          </div>
          {/* Card 1 (Back Left) */}
          <div className="absolute h-[360px] w-4/5 max-w-[280px] -translate-x-12 translate-y-4 -rotate-6 overflow-hidden rounded-[24px] border border-outline-variant/20 bg-surface-container-lowest shadow-[0_8px_30px_rgb(0,0,0,0.08)] transition-transform duration-500 ease-out group-hover:-translate-x-[18px] group-hover:translate-y-[-10px] group-hover:-rotate-[7deg]">
            <div className="flex h-full w-full items-center justify-center bg-surface-container-low">
              <div className="text-center">
                <span className="material-symbols-outlined text-[48px] text-secondary/40">school</span>
                <p className="mt-2 text-label-md text-secondary/60">Campus</p>
              </div>
            </div>
          </div>
          {/* Card 2 (Front Center) */}
          <div className="relative z-10 h-[400px] w-[85%] max-w-[300px] overflow-hidden rounded-[24px] border border-outline-variant/20 bg-surface-container-lowest shadow-[0_20px_40px_rgb(0,0,0,0.12)] transition-transform duration-500 ease-out group-hover:-translate-y-5">
            <div className="flex h-full w-full flex-col items-center justify-center bg-surface p-6">
              <Logo maxWidth={160} imgClassName="h-auto w-[140px] object-contain mb-6" />
              <div className="w-full space-y-3">
                <div className="flex items-center gap-3 rounded-2xl bg-surface-container-low p-3">
                  <div className="flex h-9 w-9 items-center justify-center rounded-full bg-primary text-on-primary">
                    <span className="material-symbols-outlined text-[18px]">person</span>
                  </div>
                  <div>
                    <p className="text-label-md font-bold text-primary">Student Feed</p>
                    <p className="text-[11px] text-secondary">Posts from verified students</p>
                  </div>
                </div>
                <div className="flex items-center gap-3 rounded-2xl bg-surface-container-low p-3">
                  <div className="flex h-9 w-9 items-center justify-center rounded-full bg-primary text-on-primary">
                    <span className="material-symbols-outlined text-[18px]">explore</span>
                  </div>
                  <div>
                    <p className="text-label-md font-bold text-primary">Explore</p>
                    <p className="text-[11px] text-secondary">Roommates, events, more</p>
                  </div>
                </div>
                <div className="flex items-center gap-3 rounded-2xl bg-surface-container-low p-3">
                  <div className="flex h-9 w-9 items-center justify-center rounded-full bg-primary text-on-primary">
                    <span className="material-symbols-outlined text-[18px]">qr_code_2</span>
                  </div>
                  <div>
                    <p className="text-label-md font-bold text-primary">Student Pass</p>
                    <p className="text-[11px] text-secondary">Verified digital ID</p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Auth Section */}
        <section className="mt-auto flex w-full flex-col gap-4">
          <Link
            href={`${authUrl}/login`}
            className="flex w-full items-center justify-center rounded-full bg-primary py-4 text-[20px] font-semibold text-on-primary transition-transform active:scale-[0.98]"
          >
            {t("landing.loginBtn")}
          </Link>
          <Link
            href={`${authUrl}/signup`}
            className="flex w-full items-center justify-center rounded-full border border-primary bg-transparent py-4 text-[20px] font-semibold text-primary transition-all hover:bg-surface-container-low active:scale-[0.98]"
          >
            {t("landing.createAccountBtn")}
          </Link>
          <p className="mt-2 text-center text-body-md text-secondary">
            {t("landing.universityEmailHint")}
          </p>
        </section>
      </main>

      {/* Footer */}
      <footer className="mt-auto w-full border-t border-outline-variant/20 bg-surface py-8">
        <div className="mx-auto flex max-w-[600px] flex-col items-center gap-4 px-5">
          <Logo maxWidth={100} imgClassName="h-auto w-[80px] object-contain" />
          <div className="flex flex-wrap items-center justify-center gap-4 text-label-md text-secondary">
            <Link href="/privacy" className="transition-colors hover:text-primary">{t("landing.privacy")}</Link>
            <Link href="/terms" className="transition-colors hover:text-primary">{t("landing.terms")}</Link>
            <Link href="/safety" className="transition-colors hover:text-primary">{t("landing.safety")}</Link>
            <Link href="/guidelines" className="transition-colors hover:text-primary">{t("landing.guidelines")}</Link>
            <a href="mailto:hello@cadesca.com" className="transition-colors hover:text-primary">{t("landing.contact")}</a>
          </div>
          <p className="text-label-md text-secondary/70">{t("landing.footerCopyright")}</p>
        </div>
      </footer>
    </div>
  );
}
