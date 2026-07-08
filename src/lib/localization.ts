export const SUPPORTED_LOCALES = ["tr", "az", "en", "ru"] as const;
export type SupportedLocale = (typeof SUPPORTED_LOCALES)[number];

export const DEFAULT_LOCALE: SupportedLocale = "en";

export const NEXT_LOCALE_COOKIE_NAME = "NEXT_LOCALE";
export const LANGUAGE_BANNER_DISMISSED_COOKIE_NAME = "lang_banner_dismissed";
export const LOCALE_COOKIE_DOMAIN = ".cadesca.com";
export const LOCALE_COOKIE_MAX_AGE = 60 * 60 * 24 * 365;

export const LOCALE_HEADER = "x-cadesca-locale";

export function getLocaleCookieDomain() {
  return process.env.NODE_ENV === "production" ? LOCALE_COOKIE_DOMAIN : undefined;
}

export function countryToLocale(countryCode: string | null | undefined): SupportedLocale {
  switch ((countryCode || "").toUpperCase()) {
    case "TR":
    case "AZ":
      return "tr";
    case "RU":
      return "ru";
    default:
      return DEFAULT_LOCALE;
  }
}

export function isSupportedLocale(value: unknown): value is SupportedLocale {
  return typeof value === "string" && (SUPPORTED_LOCALES as readonly string[]).includes(value);
}
