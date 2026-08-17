"use client";

import React from "react";
import { useLanguage } from "@/lib/i18n";
import { cn } from "@/lib/utils";

interface LanguageSwitcherProps {
  className?: string;
  variant?: "tabs" | "menu";
}

export function LanguageSwitcher({ className, variant = "tabs" }: LanguageSwitcherProps) {
  const { language, setLanguage } = useLanguage();
  const options = [
    { code: "tr" as const, label: "TR" },
    { code: "az" as const, label: "AZ" },
    { code: "en" as const, label: "EN" },
    { code: "ru" as const, label: "RU" }
  ];

  if (variant === "menu") {
    return (
      <details className={cn("group relative", className)}>
        <summary className="flex min-h-9 list-none cursor-pointer items-center gap-1.5 rounded-lg border border-[#E4E1D8] bg-white px-3 py-1.5 text-[13px] font-semibold text-[#45413C] shadow-sm transition hover:border-[#CBC6BC] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#FFD84D] focus-visible:ring-offset-2 [&::-webkit-details-marker]:hidden">
          <span>{language.toUpperCase()}</span>
          <span className="material-symbols-outlined text-[15px] text-[#7A756D] transition-transform group-open:rotate-180" aria-hidden="true">
            expand_more
          </span>
          <span className="sr-only">Change language</span>
        </summary>
        <div className="absolute right-0 z-20 mt-2 w-44 overflow-hidden rounded-xl border border-[#E4E1D8] bg-white p-1.5 shadow-[0_12px_30px_rgba(20,18,14,0.12)]">
          {options.map((option) => {
            const active = language === option.code;
            return (
              <button
                key={option.code}
                type="button"
                onClick={() => {
                  setLanguage(option.code);
                  const menu = document.activeElement?.closest("details");
                  menu?.removeAttribute("open");
                }}
                className={cn(
                  "flex min-h-10 w-full items-center justify-between rounded-lg px-3 text-left text-[13px] transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#FFD84D]",
                  active ? "bg-[#F7F5EF] font-semibold text-[#0A0A0A]" : "font-medium text-[#69655F] hover:bg-[#F7F5EF] hover:text-[#0A0A0A]"
                )}
                aria-pressed={active}
              >
                <span>{option.label}</span>
                {active ? <span className="material-symbols-outlined text-[16px]" aria-hidden="true">check</span> : null}
              </button>
            );
          })}
        </div>
      </details>
    );
  }

  return (
    <div className={cn("flex items-center gap-1 rounded-md border border-outline-variant/70 bg-surface-container-lowest p-1", className)}>
      {options.map((option) => (
        <button
          key={option.code}
          type="button"
          onClick={() => setLanguage(option.code)}
          className={cn(
            "rounded px-2 py-1 text-xs font-semibold transition-colors",
            language === option.code ? "bg-primary text-on-primary" : "text-secondary hover:bg-surface-container-low hover:text-primary"
          )}
        >
          {option.label}
        </button>
      ))}
    </div>
  );
}
