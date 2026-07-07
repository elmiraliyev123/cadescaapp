"use client";

import { useEffect, useState } from "react";

import { useLanguage, type Language } from "@/lib/i18n";
import {
  LANGUAGE_BANNER_DISMISSED_COOKIE_NAME,
  LOCALE_COOKIE_DOMAIN,
  LOCALE_COOKIE_MAX_AGE
} from "@/lib/localization";

function hasDismissedBanner() {
  return document.cookie
    .split(";")
    .map((cookie) => cookie.trim())
    .some((cookie) => cookie === `${LANGUAGE_BANNER_DISMISSED_COOKIE_NAME}=true`);
}

function persistDismissal() {
  document.cookie = [
    `${LANGUAGE_BANNER_DISMISSED_COOKIE_NAME}=true`,
    `Domain=${LOCALE_COOKIE_DOMAIN}`,
    "Path=/",
    `Max-Age=${LOCALE_COOKIE_MAX_AGE}`,
    "SameSite=Lax",
    "Secure"
  ].join("; ");
}

export function LanguageBanner() {
  const { language, setLanguage, t } = useLanguage();
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    setVisible(!hasDismissedBanner());
  }, []);

  function dismiss() {
    persistDismissal();
    setVisible(false);
  }

  function chooseLanguage(locale: Extract<Language, "en" | "tr">) {
    persistDismissal();
    setLanguage(locale);
    setVisible(false);
  }

  if (!visible) return null;

  return (
    <aside
      className="fixed inset-x-0 top-0 z-[100] border-b border-white/10 bg-zinc-950/95 px-4 py-2 text-white shadow-sm backdrop-blur-md"
      aria-label={t("language_banner_prompt")}
    >
      <div className="mx-auto flex min-h-8 max-w-container-max items-center justify-center gap-3 pr-8 text-xs sm:gap-4 sm:text-sm">
        <span className="whitespace-nowrap text-zinc-200">{t("language_banner_prompt")}</span>
        <span
          className="flex shrink-0 items-center gap-1 rounded-lg border border-white/10 bg-white/5 p-0.5"
          aria-label={`${t("language_banner_current")}: ${language.toUpperCase()}`}
        >
          <button
            type="button"
            className={`rounded-md px-2 py-1 font-semibold transition-colors ${
              language === "en" ? "bg-white text-zinc-950 shadow-sm" : "text-zinc-300 hover:bg-white/10 hover:text-white"
            }`}
            aria-current={language === "en" ? "true" : undefined}
            onClick={() => chooseLanguage("en")}
          >
            EN
          </button>
          <button
            type="button"
            className={`rounded-md px-2 py-1 font-semibold transition-colors ${
              language === "tr" ? "bg-white text-zinc-950 shadow-sm" : "text-zinc-300 hover:bg-white/10 hover:text-white"
            }`}
            aria-current={language === "tr" ? "true" : undefined}
            onClick={() => chooseLanguage("tr")}
          >
            TR
          </button>
        </span>
      </div>
      <button
        type="button"
        className="absolute right-3 top-1/2 -translate-y-1/2 rounded-md p-1.5 text-zinc-400 transition-colors hover:bg-white/10 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/70"
        aria-label={t("language_banner_close")}
        onClick={dismiss}
      >
        <svg
          aria-hidden="true"
          className="h-4 w-4"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
        >
          <path d="M18 6 6 18" />
          <path d="m6 6 12 12" />
        </svg>
      </button>
    </aside>
  );
}
