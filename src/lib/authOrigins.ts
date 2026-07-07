import { getAppUrl, getAuthUrl } from "@/lib/appConfig";

function isLocalBrowser() {
  if (typeof window === "undefined") return false;
  return window.location.hostname === "localhost" || window.location.hostname === "127.0.0.1";
}

export function studentAppHomeHref() {
  if (isLocalBrowser()) return "/app/user/home";
  return `${getAppUrl()}/app/user/home`;
}

export function authLoginHref(next = studentAppHomeHref()) {
  const normalizedNext = !isLocalBrowser() && next.startsWith("/") ? `${getAppUrl()}${next}` : next;

  if (isLocalBrowser()) {
    const url = new URL("/login", window.location.origin);
    url.searchParams.set("next", normalizedNext);
    return `${url.pathname}${url.search}`;
  }

  const url = new URL("/login", getAuthUrl());
  url.searchParams.set("next", normalizedNext);
  return url.toString();
}

export function safePostAuthHref(next: string | null | undefined) {
  if (!next) return studentAppHomeHref();

  try {
    const base = typeof window !== "undefined" ? window.location.origin : getAppUrl();
    const parsed = new URL(next, base);
    const appOrigin = new URL(getAppUrl()).origin;
    const localOrigin = typeof window !== "undefined" ? window.location.origin : "";

    if (
      parsed.pathname.startsWith("/app/user/") &&
      (parsed.origin === appOrigin || (isLocalBrowser() && parsed.origin === localOrigin))
    ) {
      return isLocalBrowser() ? `${parsed.pathname}${parsed.search}` : parsed.toString();
    }
  } catch {
    return studentAppHomeHref();
  }

  return studentAppHomeHref();
}
