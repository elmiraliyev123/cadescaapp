export function getSharedCookieDomain() {
  const configured = (process.env.NEXT_PUBLIC_COOKIE_DOMAIN || process.env.COOKIE_DOMAIN || "").trim();
  if (!configured || configured === "localhost" || configured.endsWith(".localhost")) return undefined;
  if (process.env.NODE_ENV !== "production") return undefined;
  return configured.startsWith(".") ? configured : `.${configured}`;
}

export function withSharedCookieDomain<const T extends object>(options: T): T & { domain?: string } {
  const domain = getSharedCookieDomain();
  return domain ? { ...options, domain } : options;
}
