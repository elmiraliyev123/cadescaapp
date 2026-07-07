"use client";

import React from "react";
import { useLanguage } from "@/lib/i18n";
import { cn } from "@/lib/utils";

interface LanguageSwitcherProps {
  className?: string;
}

export function LanguageSwitcher({ className }: LanguageSwitcherProps) {
  const { language, setLanguage } = useLanguage();
  const options = [
    { code: "tr" as const, label: "TR" },
    { code: "az" as const, label: "AZ" },
    { code: "en" as const, label: "EN" },
    { code: "ru" as const, label: "RU" }
  ];

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
