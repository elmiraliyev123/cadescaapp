"use client";

import React, { useState, useEffect } from "react";

const REGION_OPTIONS = [
  { code: "tr" as const, label: "Türkiye", flag: "🇹🇷" },
  { code: "az" as const, label: "Azərbaycan", flag: "🇦🇿" },
  { code: "en" as const, label: "English (Global)", flag: "🇬🇧" },
  { code: "ru" as const, label: "Русский", flag: "🇷🇺" }
] as const;

type RegionCode = (typeof REGION_OPTIONS)[number]["code"];

const BANNER_DISMISSED_KEY = "cadesca_region_banner_dismissed";
const SHOW_BANNER_COOKIE = "cadesca_show_region_banner";
const DETECTED_LOCALE_COOKIE = "cadesca_detected_locale";

const BANNER_TRANSLATIONS: Record<string, { text: string; continueBtn: string; selectLabel: string }> = {
  en: {
    text: "To view content specific to your location, select another country or region.",
    continueBtn: "Continue",
    selectLabel: "Select region"
  },
  az: {
    text: "Məkanınıza məxsus məzmunu görmək üçün başqa ölkə və ya region seçin.",
    continueBtn: "Davam et",
    selectLabel: "Region seçin"
  },
  tr: {
    text: "Konumunuza özel içerikleri görmek için başka bir ülkeyi veya bölgeyi seçin.",
    continueBtn: "Devam Et",
    selectLabel: "Bölge seçin"
  },
  ru: {
    text: "Чтобы просмотреть контент, соответствующий вашему местоположению, выберите другую страну или регион.",
    continueBtn: "Продолжить",
    selectLabel: "Выберите регион"
  }
};

function getCookie(name: string): string | null {
  if (typeof document === "undefined") return null;
  const match = document.cookie.match(new RegExp(`(?:^|; )${name}=([^;]*)`));
  return match ? decodeURIComponent(match[1]) : null;
}

export function RegionBanner() {
  const [visible, setVisible] = useState(false);
  const [selectedRegion, setSelectedRegion] = useState<RegionCode>("en");
  const [submitting, setSubmitting] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [detectedLocale, setDetectedLocale] = useState<string>("en");

  useEffect(() => {
    setMounted(true);

    // Read IP-detected locale from middleware cookie
    const detected = getCookie(DETECTED_LOCALE_COOKIE) || "en";
    setDetectedLocale(detected);

    // Only show if middleware set the banner cookie and user hasn't dismissed it this session
    const showCookie = getCookie(SHOW_BANNER_COOKIE);
    const dismissed = sessionStorage.getItem(BANNER_DISMISSED_KEY);

    if (showCookie === "1" && !dismissed) {
      setVisible(true);
    }
  }, []);

  const handleDismiss = () => {
    setVisible(false);
    sessionStorage.setItem(BANNER_DISMISSED_KEY, "1");
  };

  const handleContinue = async () => {
    if (submitting) return;
    setSubmitting(true);

    try {
      const response = await fetch("/api/user/locale", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ locale: selectedRegion })
      });

      if (response.ok) {
        // Clear the dismissed flag since user made an explicit choice
        sessionStorage.removeItem(BANNER_DISMISSED_KEY);
        // Reload to apply the new locale
        window.location.reload();
      }
    } catch {
      console.error("[RegionBanner] Failed to update locale");
      setSubmitting(false);
    }
  };

  if (!mounted || !visible) return null;

  const strings = BANNER_TRANSLATIONS[detectedLocale] || BANNER_TRANSLATIONS.en;

  return (
    <div
      className="region-banner"
      role="banner"
      aria-label="Region selection"
    >
      <div className="region-banner__backdrop" />
      <div className="region-banner__content">
        <div className="region-banner__inner">
          {/* Globe icon */}
          <div className="region-banner__icon">
            <svg
              width="20"
              height="20"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <circle cx="12" cy="12" r="10" />
              <path d="M2 12h20" />
              <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z" />
            </svg>
          </div>

          {/* Text */}
          <p className="region-banner__text">
            {strings.text}
          </p>

          {/* Controls */}
          <div className="region-banner__controls">
            <div className="region-banner__select-wrapper">
              <select
                value={selectedRegion}
                onChange={(e) => setSelectedRegion(e.target.value as RegionCode)}
                className="region-banner__select"
                aria-label={strings.selectLabel}
              >
                {REGION_OPTIONS.map((option) => (
                  <option key={option.code} value={option.code}>
                    {option.flag}  {option.label}
                  </option>
                ))}
              </select>
              <div className="region-banner__select-chevron">
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                  <path d="M6 9l6 6 6-6" />
                </svg>
              </div>
            </div>

            <button
              onClick={handleContinue}
              disabled={submitting}
              className="region-banner__continue"
            >
              {submitting ? (
                <span className="region-banner__spinner" />
              ) : (
                strings.continueBtn
              )}
            </button>
          </div>

          {/* Dismiss button */}
          <button
            onClick={handleDismiss}
            className="region-banner__dismiss"
            aria-label="Dismiss region banner"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
              <path d="M18 6L6 18" />
              <path d="M6 6l12 12" />
            </svg>
          </button>
        </div>
      </div>

      <style jsx>{`
        .region-banner {
          position: relative;
          z-index: 9999;
          animation: regionBannerSlideDown 0.4s cubic-bezier(0.16, 1, 0.3, 1) forwards;
        }

        @keyframes regionBannerSlideDown {
          from {
            opacity: 0;
            transform: translateY(-100%);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }

        .region-banner__backdrop {
          position: absolute;
          inset: 0;
          background: linear-gradient(
            135deg,
            rgba(15, 15, 20, 0.97) 0%,
            rgba(25, 25, 35, 0.95) 50%,
            rgba(15, 15, 20, 0.97) 100%
          );
          backdrop-filter: blur(24px) saturate(180%);
          -webkit-backdrop-filter: blur(24px) saturate(180%);
        }

        .region-banner__content {
          position: relative;
          max-width: 1280px;
          margin: 0 auto;
          padding: 14px 20px;
        }

        @media (min-width: 768px) {
          .region-banner__content {
            padding: 14px 64px;
          }
        }

        .region-banner__inner {
          display: flex;
          align-items: center;
          gap: 12px;
          flex-wrap: wrap;
        }

        @media (min-width: 768px) {
          .region-banner__inner {
            flex-wrap: nowrap;
          }
        }

        .region-banner__icon {
          display: none;
          color: rgba(255, 255, 255, 0.6);
          flex-shrink: 0;
        }

        @media (min-width: 768px) {
          .region-banner__icon {
            display: flex;
          }
        }

        .region-banner__text {
          flex: 1;
          min-width: 0;
          font-size: 13px;
          line-height: 1.45;
          color: rgba(255, 255, 255, 0.85);
          margin: 0;
          letter-spacing: -0.01em;
        }

        @media (min-width: 768px) {
          .region-banner__text {
            font-size: 13.5px;
          }
        }

        .region-banner__controls {
          display: flex;
          align-items: center;
          gap: 8px;
          flex-shrink: 0;
          width: 100%;
        }

        @media (min-width: 768px) {
          .region-banner__controls {
            width: auto;
          }
        }

        .region-banner__select-wrapper {
          position: relative;
          flex: 1;
        }

        @media (min-width: 768px) {
          .region-banner__select-wrapper {
            flex: none;
          }
        }

        .region-banner__select {
          appearance: none;
          -webkit-appearance: none;
          width: 100%;
          background: rgba(255, 255, 255, 0.08);
          border: 1px solid rgba(255, 255, 255, 0.12);
          border-radius: 8px;
          color: #ffffff;
          font-size: 13px;
          font-weight: 500;
          padding: 8px 32px 8px 12px;
          cursor: pointer;
          outline: none;
          transition: all 0.2s ease;
          font-family: inherit;
        }

        @media (min-width: 768px) {
          .region-banner__select {
            min-width: 180px;
          }
        }

        .region-banner__select:hover {
          background: rgba(255, 255, 255, 0.12);
          border-color: rgba(255, 255, 255, 0.2);
        }

        .region-banner__select:focus {
          border-color: rgba(255, 255, 255, 0.3);
          box-shadow: 0 0 0 2px rgba(255, 255, 255, 0.06);
        }

        .region-banner__select option {
          background: #1a1a24;
          color: #ffffff;
          padding: 8px;
        }

        .region-banner__select-chevron {
          position: absolute;
          right: 10px;
          top: 50%;
          transform: translateY(-50%);
          color: rgba(255, 255, 255, 0.5);
          pointer-events: none;
        }

        .region-banner__continue {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          min-width: 90px;
          height: 36px;
          padding: 0 18px;
          background: #ffffff;
          color: #0a0a0a;
          border: none;
          border-radius: 8px;
          font-size: 13px;
          font-weight: 600;
          font-family: inherit;
          cursor: pointer;
          transition: all 0.2s ease;
          flex-shrink: 0;
          letter-spacing: -0.01em;
        }

        .region-banner__continue:hover {
          background: rgba(255, 255, 255, 0.92);
          transform: scale(1.02);
        }

        .region-banner__continue:active {
          transform: scale(0.98);
        }

        .region-banner__continue:disabled {
          opacity: 0.6;
          cursor: not-allowed;
          transform: none;
        }

        .region-banner__spinner {
          width: 16px;
          height: 16px;
          border: 2px solid rgba(0, 0, 0, 0.15);
          border-top-color: #0a0a0a;
          border-radius: 50%;
          animation: regionBannerSpin 0.6s linear infinite;
        }

        @keyframes regionBannerSpin {
          to {
            transform: rotate(360deg);
          }
        }

        .region-banner__dismiss {
          display: flex;
          align-items: center;
          justify-content: center;
          width: 28px;
          height: 28px;
          margin-left: auto;
          background: transparent;
          border: none;
          border-radius: 6px;
          color: rgba(255, 255, 255, 0.4);
          cursor: pointer;
          transition: all 0.2s ease;
          flex-shrink: 0;
          padding: 0;
        }

        @media (min-width: 768px) {
          .region-banner__dismiss {
            margin-left: 4px;
          }
        }

        .region-banner__dismiss:hover {
          color: rgba(255, 255, 255, 0.8);
          background: rgba(255, 255, 255, 0.08);
        }
      `}</style>
    </div>
  );
}
