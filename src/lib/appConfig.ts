const normalizePublicUrl = (value: string | undefined, fallback: string) => {
  const url = (value || fallback).trim();
  return url.replace(/\/+$/, "");
};

export function getAppUrl() {
  return normalizePublicUrl(process.env.NEXT_PUBLIC_APP_ORIGIN || process.env.NEXT_PUBLIC_APP_URL, "https://app.cadesca.com");
}

export function getPublicUrl() {
  return normalizePublicUrl(process.env.NEXT_PUBLIC_SITE_ORIGIN, "https://cadesca.com");
}

export function getAuthUrl() {
  return normalizePublicUrl(process.env.NEXT_PUBLIC_AUTH_ORIGIN || process.env.NEXT_PUBLIC_AUTH_URL, "https://auth.cadesca.com");
}

export function getMerchantUrl() {
  return normalizePublicUrl(process.env.NEXT_PUBLIC_MERCHANT_URL, "https://merchant.cadesca.com");
}

export function getAdminUrl() {
  return normalizePublicUrl(process.env.NEXT_PUBLIC_ADMIN_URL, "https://adminlog.cadesca.com");
}

export function getApiUrl() {
  return normalizePublicUrl(process.env.NEXT_PUBLIC_API_URL, "https://api.cadesca.com");
}

export const appUrl = getAppUrl();
export const publicUrl = getPublicUrl();
export const authUrl = getAuthUrl();
export const merchantUrl = getMerchantUrl();
export const adminUrl = getAdminUrl();
export const apiUrl = getApiUrl();

export {
  adminConsoleEnabled,
  demoModeEnabled,
  employeeFeaturesEnabled,
  employerDashboardEnabled,
  employerFeaturesEnabled,
  featureFlags,
  merchantPortalEnabled,
  publicUserAppEnabled,
  studentFeaturesEnabled
} from "@/lib/featureFlags";
