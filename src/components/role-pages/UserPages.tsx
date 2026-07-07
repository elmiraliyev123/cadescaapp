"use client";

import { useOptimistic, useState, useTransition } from "react";
import { useRouter } from "next/navigation";

import { updateLanguagePreference } from "@/app/app/user/profile/actions";
import { ScreenHeader } from "@/components/screens/ScreenHeader";
import { useLanguage, type Language } from "@/lib/i18n";

const LANGUAGE_OPTIONS: ReadonlyArray<{ value: Language; label: string }> = [
  { value: "az", label: "Azərbaycan dili" },
  { value: "tr", label: "Türkçe" },
  { value: "en", label: "English" },
  { value: "ru", label: "Русский" }
];

export function UserPassPage() {
  const { t } = useLanguage();
  return (
    <section>
      <ScreenHeader title={t("student.studentPass") || "Student Pass"} description="Cadesca QR" />
      <div className="p-8 text-center text-secondary">
        QR sisteminə yeniliklər edilir.
      </div>
    </section>
  );
}

export function UserStudentMenusPage() {
  const { t } = useLanguage();
  return (
    <section>
      <ScreenHeader title={t("student.nearbyStudentMenus") || "Student Menus"} description="" />
      <div className="p-8 text-center text-secondary">Tezliklə...</div>
    </section>
  );
}

export function UserActivityPage() {
  const { t } = useLanguage();
  return (
    <section>
      <ScreenHeader title={t("student.latestCheckIn") || "Activity"} description="" />
      <div className="p-8 text-center text-secondary">Tezliklə...</div>
    </section>
  );
}

export function UserMenusPage() {
  const { t } = useLanguage();
  return (
    <section>
      <ScreenHeader title="Restoranlar" description="" />
      <div className="p-8 text-center text-secondary">Tezliklə...</div>
    </section>
  );
}

export function UserProfilePage() {
  const router = useRouter();
  const { language, t } = useLanguage();
  const [selectedLanguage, setSelectedLanguage] = useOptimistic(language);
  const [message, setMessage] = useState("");
  const [isPending, startTransition] = useTransition();

  function changeLanguage(locale: Language) {
    setMessage("");

    startTransition(async () => {
      setSelectedLanguage(locale);
      try {
        await updateLanguagePreference(locale);
        setMessage("Language preference saved.");
        router.refresh();
      } catch {
        setMessage("Language preference could not be saved.");
      }
    });
  }

  return (
    <section>
      <ScreenHeader title={t("common.profile")} description="" />
      <div className="mx-auto w-full max-w-2xl p-4 md:p-8">
        <div className="rounded-2xl border border-outline-variant/70 bg-surface-container-lowest p-5 shadow-sm">
          <label className="block text-label-lg font-semibold text-primary" htmlFor="profile-language">
            {t("common.language")}
          </label>
          <p className="mt-1 text-body-sm text-secondary">
            Choose the language used across Cadesca.
          </p>
          <select
            id="profile-language"
            value={selectedLanguage}
            disabled={isPending}
            onChange={(event) => changeLanguage(event.target.value as Language)}
            className="mt-4 w-full rounded-xl border border-outline-variant bg-background px-4 py-3 text-body-md text-primary outline-none transition focus:border-primary disabled:cursor-wait disabled:opacity-60"
          >
            {LANGUAGE_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
          {message ? (
            <p className="mt-3 text-caption font-semibold text-secondary" role="status">
              {message}
            </p>
          ) : null}
        </div>
      </div>
    </section>
  );
}
