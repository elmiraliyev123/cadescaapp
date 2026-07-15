"use client";

import { useEffect, useState } from "react";

import { ScreenHeader } from "@/components/screens/ScreenHeader";
import { AppleWalletButton } from "@/components/ui/AppleWalletButton";
import { GoogleWalletButton } from "@/components/ui/GoogleWalletButton";
import { useLanguage } from "@/lib/i18n";
import type { CurrentStudentContext } from "@/lib/server/social";

const APPLE_PASS_URL = "/api/user/wallet/apple";
const GOOGLE_PASS_URL = "/api/user/wallet/google";

export type DeviceType = "ios" | "android" | "desktop";

type WalletStatusResponse = {
  ok: boolean;
  wallet?: {
    configured: boolean;
    eligible: boolean;
    reason?: string;
    pass: {
      id: string;
      googleObjectId: string;
      status: "pending" | "active" | "revoked" | "expired";
      uniqueWalletPassId: string;
      expiresAt: string | null;
      lastSync: string | null;
      revoked: boolean;
    } | null;
  };
};

function passInitials(name: string) {
  return name.split(/\s+/).slice(0, 2).map((part) => part[0]?.toUpperCase()).join("") || "CS";
}

export function WalletPassSection({
  device,
  user,
  showHeader = true
}: {
  device: DeviceType;
  user?: CurrentStudentContext | null;
  showHeader?: boolean;
}) {
  const { t } = useLanguage();
  const [status, setStatus] = useState<WalletStatusResponse["wallet"] | null>(null);
  const [loading, setLoading] = useState(true);
  const [walletError, setWalletError] = useState(false);

  useEffect(() => {
    if (device !== "android") {
      setLoading(false);
      return;
    }

    let cancelled = false;
    setLoading(true);
    setWalletError(false);

    void fetch("/api/user/wallet/google/status", { cache: "no-store" })
      .then(async (response) => {
        const payload = (await response.json().catch(() => ({}))) as WalletStatusResponse;
        if (cancelled) return;
        setStatus(payload.wallet || null);
        setWalletError(!response.ok);
      })
      .catch(() => {
        if (!cancelled) setWalletError(true);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [device]);

  const walletReady = Boolean(status?.configured && status.eligible);
  const unavailableMessage = device === "android" && (walletError || (!loading && !walletReady))
    ? t("social.walletUnavailable")
    : "";

  return (
    <section>
      {showHeader ? (
        <ScreenHeader
          title={t("social.studentPass")}
          description={t("social.walletDescription")}
        />
      ) : null}

      <div className="mx-auto max-w-2xl space-y-3">
        <div className="relative overflow-hidden rounded-xl bg-primary p-5 text-on-primary sm:p-6">
          <div className="absolute -right-10 -top-10 h-36 w-36 rounded-full border border-white/20" aria-hidden="true" />
          <div className="absolute -bottom-16 right-16 h-40 w-40 rounded-full border border-white/10" aria-hidden="true" />
          <div className="relative flex items-start justify-between gap-4">
            <div className="flex min-w-0 items-center gap-3">
              <div className="flex h-12 w-12 shrink-0 items-center justify-center overflow-hidden rounded-full border border-white/30 bg-white text-label-md font-semibold text-primary">
                {user?.avatarUrl ? <img src={user.avatarUrl} alt={user.displayName || user.name} className="h-full w-full object-cover" /> : passInitials(user?.displayName || user?.name || t("social.defaultStudentName"))}
              </div>
              <div className="min-w-0">
                <p className="truncate text-title-md font-semibold">{user?.displayName || user?.name || t("social.defaultStudentName")}</p>
                <p className="mt-0.5 truncate text-caption text-white/70">{user?.universityName || user?.legacyUniversityName || t("social.universityNotAssigned")}</p>
              </div>
            </div>
            <span className="material-symbols-outlined shrink-0 text-[22px] text-white/80" aria-hidden="true">verified</span>
          </div>
          <div className="relative mt-8 flex items-end justify-between gap-4">
            <div>
              <p className="text-caption font-semibold uppercase tracking-[0.12em] text-white/60">Cadesca</p>
              <h2 className="mt-1 text-headline-sm font-semibold">{t("social.studentPass")}</h2>
            </div>
            <span className="material-symbols-outlined text-[38px] text-white/80" aria-hidden="true">qr_code_2</span>
          </div>
        </div>

        <div className="rounded-xl border border-outline-variant/30 bg-surface-container-lowest p-4">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-label-md font-semibold text-primary">{t("social.campusVerification")}</p>
              <p className="mt-0.5 text-body-sm text-secondary">{t("social.verifiedStudent")}</p>
            </div>
            <span className="inline-flex h-7 items-center gap-1.5 rounded-full border border-outline-variant/50 px-2.5 text-caption font-semibold text-primary">
              <span className="h-1.5 w-1.5 rounded-full bg-primary" aria-hidden="true" />
              {t("social.verified")}
            </span>
          </div>

          <div className="mt-4">
          {loading ? (
            <p className="text-body-sm text-secondary">{t("social.walletChecking")}</p>
          ) : unavailableMessage ? (
            <p className="rounded-lg border border-outline-variant/50 bg-surface-container-low p-3 text-body-sm text-secondary">
              {unavailableMessage}
            </p>
          ) : device === "ios" ? (
            <AppleWalletButton passUrl={APPLE_PASS_URL} className="w-full sm:w-auto" />
          ) : device === "android" ? (
            <div className="w-full sm:max-w-xs">
              <GoogleWalletButton passUrl={GOOGLE_PASS_URL} className="w-full" />
            </div>
          ) : (
            <p className="rounded-lg border border-outline-variant/50 bg-surface-container-low p-3 text-body-sm text-secondary">
              {t("social.walletDesktopHint")}
            </p>
          )}
          </div>
        </div>
      </div>
    </section>
  );
}
