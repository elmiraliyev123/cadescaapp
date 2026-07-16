"use client";

import { useEffect, useState } from "react";
import { QRCodeSVG } from "qrcode.react";

import { SocialPageHeader, UserAvatar, VerifiedBadge } from "@/components/social/SocialPrimitives";
import { Button, IconButton } from "@/components/ui/Button";
import { AppleWalletButton } from "@/components/ui/AppleWalletButton";
import { GoogleWalletButton } from "@/components/ui/GoogleWalletButton";
import { InlineError } from "@/components/ui/InlineError";
import { LoadingSkeleton } from "@/components/ui/LoadingSkeleton";
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

export function StudentPassCard({ user }: { user?: CurrentStudentContext | null }) {
  const { t } = useLanguage();
  const name = user?.displayName || user?.name || t("social.defaultStudentName");
  const university = user?.universityName || user?.legacyUniversityName || t("social.universityNotAssigned");

  return (
    <div className="relative aspect-[1.62/1] w-full overflow-hidden rounded-2xl bg-primary p-5 text-on-primary sm:p-6">
      <div className="absolute -right-10 -top-10 h-36 w-36 rounded-full border border-white/15" aria-hidden="true" />
      <div className="absolute -bottom-16 right-16 h-40 w-40 rounded-full border border-white/10" aria-hidden="true" />
      <div className="relative flex items-start justify-between gap-4">
        <div className="flex min-w-0 items-center gap-3">
          <UserAvatar name={name} src={user?.avatarUrl} size="md" className="border-white/25 bg-white text-primary" />
          <div className="min-w-0">
            <div className="flex min-w-0 items-center">
              <p className="truncate text-[16px] font-semibold leading-6">{name}</p>
              <VerifiedBadge inverse />
            </div>
            <p className="truncate text-[12px] font-normal leading-4 text-white/70">{university}</p>
          </div>
        </div>
      </div>
      <div className="absolute bottom-5 left-5 right-5 flex items-end justify-between gap-4 sm:bottom-6 sm:left-6 sm:right-6">
        <div>
          <p className="text-[11px] font-semibold uppercase leading-4 tracking-[0.12em] text-white/60">Cadesca</p>
          <p className="mt-0.5 text-[15px] font-semibold leading-5 text-white">
            {user?.username ? `@${user.username}` : t("social.verifiedStudent")}
          </p>
        </div>
        <span className="material-symbols-outlined icon-pass text-white/75" aria-hidden="true">qr_code_2</span>
      </div>
    </div>
  );
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
  const [loading, setLoading] = useState(device === "android");
  const [walletError, setWalletError] = useState(false);
  const [qrToken, setQrToken] = useState("");
  const [qrOpen, setQrOpen] = useState(false);
  const [qrLoading, setQrLoading] = useState(false);
  const [qrError, setQrError] = useState("");

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

  useEffect(() => {
    if (!qrOpen) return;
    const previousOverflow = document.body.style.overflow;
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") setQrOpen(false);
    };
    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", closeOnEscape);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", closeOnEscape);
    };
  }, [qrOpen]);

  const walletReady = Boolean(status?.configured && status.eligible);
  const unavailableMessage = device === "android" && (walletError || (!loading && !walletReady))
    ? t("social.walletUnavailable")
    : "";

  async function showQr() {
    setQrLoading(true);
    setQrError("");
    try {
      const response = await fetch("/api/user/qr", { cache: "no-store" });
      const payload = (await response.json().catch(() => ({}))) as { token?: string };
      if (!response.ok || !payload.token) throw new Error("qr_unavailable");
      setQrToken(payload.token);
      setQrOpen(true);
    } catch {
      setQrError(t("social.qrUnavailable"));
    } finally {
      setQrLoading(false);
    }
  }

  return (
    <section>
      {showHeader ? (
        <SocialPageHeader title={t("social.studentPass")} />
      ) : null}

      <div className="mx-auto max-w-[560px] space-y-4">
        <StudentPassCard user={user} />

        <div>
          <div className="grid grid-cols-1 gap-2 sm:flex sm:flex-wrap">
            {device === "android" && loading ? (
              <LoadingSkeleton className="h-11 w-full sm:w-44" />
            ) : null}
            {device === "ios" ? (
              <AppleWalletButton passUrl={APPLE_PASS_URL} label={t("social.addToAppleWallet")} className="w-full sm:w-auto" />
            ) : null}
            {device === "android" && !loading && walletReady ? (
              <GoogleWalletButton passUrl={GOOGLE_PASS_URL} label={t("social.addToGoogleWallet")} className="w-full sm:w-auto" />
            ) : null}
            <Button
              variant={device === "ios" || (device === "android" && walletReady) ? "secondary" : "primary"}
              icon="qr_code_2"
              className="w-full sm:w-auto"
              disabled={qrLoading}
              onClick={showQr}
            >
              {t("social.showQr")}
            </Button>
          </div>
          <InlineError message={unavailableMessage} className="mt-3" />
          <InlineError message={qrError} className="mt-3" />
        </div>
      </div>

      {qrOpen && qrToken ? (
        <div
          className="fixed inset-0 z-[100] flex items-center justify-center bg-black/55 p-4"
          role="dialog"
          aria-modal="true"
          aria-label={t("social.showQr")}
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) setQrOpen(false);
          }}
        >
          <div className="w-full max-w-xs rounded-xl bg-white p-5 text-center shadow-md">
            <div className="flex items-center justify-between gap-3">
              <h2 className="text-[20px] font-semibold leading-7 text-primary">{t("social.showQr")}</h2>
              <IconButton icon="close" label={t("common.close")} autoFocus onClick={() => setQrOpen(false)} />
            </div>
            <div className="mt-4 flex justify-center rounded-xl border border-outline-variant/30 bg-white p-4">
              <QRCodeSVG value={qrToken} size={220} level="M" aria-label={t("social.studentPass")} />
            </div>
          </div>
        </div>
      ) : null}
    </section>
  );
}
