"use client";

import { useEffect, useState } from "react";

import { ScreenHeader } from "@/components/screens/ScreenHeader";
import { AppleWalletButton } from "@/components/ui/AppleWalletButton";
import { GoogleWalletButton } from "@/components/ui/GoogleWalletButton";
import { useLanguage } from "@/lib/i18n";

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

export function WalletPassSection({ device, showHeader = true }: { device: DeviceType; showHeader?: boolean }) {
  const { t } = useLanguage();
  const [status, setStatus] = useState<WalletStatusResponse["wallet"] | null>(null);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState<string | null>(null);

  async function loadStatus() {
    setLoading(true);
    setMessage(null);
    try {
      const response = await fetch("/api/user/wallet/google/status", { cache: "no-store" });
      const payload = (await response.json().catch(() => ({}))) as WalletStatusResponse;
      setStatus(payload.wallet || null);
      if (!response.ok) setMessage("Wallet is not available right now.");
    } catch {
      setMessage("Wallet is not available right now.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadStatus();
  }, []);

  const walletReady = Boolean(status?.configured && status.eligible);
  const unavailableMessage = message || (!loading && !walletReady ? "Wallet is not available right now." : "");

  return (
    <section>
      {showHeader ? (
        <ScreenHeader
          title={t("student.studentPass") || "Student Pass"}
          description="Cadesca Wallet"
        />
      ) : null}

      <div className="rounded-2xl border border-outline-variant/70 bg-surface-container-lowest p-5">
        <div className="flex items-start gap-3">
          <span className="material-symbols-outlined text-[24px] text-primary" aria-hidden="true">wallet</span>
          <div>
            <h2 className="text-title-md font-semibold text-primary">Student Pass</h2>
            <p className="mt-1 text-body-sm text-secondary">Use your verified student pass with Wallet.</p>
          </div>
        </div>

        <div className="mt-5">
          {loading ? (
            <p className="text-body-sm text-secondary">Checking Wallet availability...</p>
          ) : unavailableMessage ? (
            <p className="rounded-lg border border-outline-variant/70 bg-surface-container-low p-3 text-body-sm text-secondary">
              {unavailableMessage}
            </p>
          ) : device === "ios" ? (
            <AppleWalletButton passUrl={APPLE_PASS_URL} className="w-full sm:w-auto" />
          ) : device === "android" ? (
            <div className="w-full sm:max-w-xs">
              <GoogleWalletButton passUrl={GOOGLE_PASS_URL} className="w-full" />
            </div>
          ) : (
            <p className="rounded-lg border border-outline-variant/70 bg-surface-container-low p-3 text-body-sm text-secondary">
              Open Cadesca on your phone to add your pass to Wallet.
            </p>
          )}
        </div>
      </div>
    </section>
  );
}
