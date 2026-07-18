import { createRemoteJWKSet } from "jose/jwks/remote";
import { jwtVerify } from "jose/jwt/verify";
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

import { ADMIN_SESSION_COOKIE, verifyAdminSessionToken } from "@/lib/server/adminSession";
import { USER_SESSION_COOKIE, verifyUserSessionToken } from "@/lib/server/userSession";
import {
  countryToLocale,
  DEFAULT_LOCALE,
  isSupportedLocale,
  LOCALE_COOKIE_DOMAIN,
  LOCALE_COOKIE_MAX_AGE,
  LOCALE_HEADER,
  NEXT_LOCALE_COOKIE_NAME,
  type SupportedLocale
} from "@/lib/localization";
import { refreshSupabaseAuth } from "@/lib/supabase/middleware";

type LocaleResolution = {
  locale: SupportedLocale;
  persistDetectedLocale: boolean;
};

function resolveLocale(request: NextRequest): LocaleResolution {
  const selectedLocale = request.cookies.get(NEXT_LOCALE_COOKIE_NAME)?.value;
  if (isSupportedLocale(selectedLocale)) {
    return { locale: selectedLocale, persistDetectedLocale: false };
  }

  const country = request.headers.get("x-vercel-ip-country");
  const locale = country ? countryToLocale(country) : DEFAULT_LOCALE;

  return { locale, persistDetectedLocale: true };
}

const ADMIN_DENIED_BODY = [
  "403 Access denied",
  "Bu admin panelə giriş icazəniz yoxdur.",
  "You do not have permission to access this admin panel."
].join("\n");

let cfAccessJwks:
  | {
      domain: string;
      jwks: ReturnType<typeof createRemoteJWKSet>;
    }
  | null = null;

function normalizedHost(request: NextRequest) {
  return (request.headers.get("host") || request.nextUrl.host).split(":")[0].toLowerCase();
}

function hasFileExtension(pathname: string) {
  return /\/[^/?]+\.[^/?]+$/.test(pathname);
}

function isStaticBypass(pathname: string) {
  return (
    pathname.startsWith("/_next/") ||
    pathname === "/favicon.ico" ||
    pathname === "/cadesca-logo.png" ||
    pathname === "/cadesca-logo.svg" ||
    pathname === "/cadesca-mark.png" ||
    pathname === "/cadesca-mark.svg" ||
    hasFileExtension(pathname)
  );
}

function isAppPath(pathname: string) {
  return pathname === "/app" || pathname.startsWith("/app/");
}

function isPublicPostPath(pathname: string) {
  return pathname === "/post" || pathname.startsWith("/post/");
}

function isPublicProfilePath(pathname: string) {
  return pathname === "/user" || pathname.startsWith("/user/");
}

function isPublicMediaPath(pathname: string) {
  return pathname === "/media" || pathname.startsWith("/media/");
}

function isNavigationMethod(method: string) {
  return method === "GET" || method === "HEAD";
}

function isNextActionRequest(request: NextRequest) {
  return request.headers.has("next-action");
}

function isRscRequest(request: NextRequest) {
  const accept = request.headers.get("accept") || "";
  const contentType = request.headers.get("content-type") || "";

  return (
    request.headers.get("rsc") === "1" ||
    request.headers.has("next-router-state-tree") ||
    request.headers.has("next-router-prefetch") ||
    accept.includes("text/x-component") ||
    contentType.includes("text/x-component")
  );
}

function isNextInternalRequest(request: NextRequest) {
  return (
    request.nextUrl.pathname.startsWith("/_next/") ||
    request.headers.has("next-url") ||
    request.headers.get("purpose") === "prefetch" ||
    request.headers.get("sec-purpose") === "prefetch"
  );
}

function appRequestPassThroughReason(request: NextRequest) {
  if (!isAppPath(request.nextUrl.pathname)) return null;
  if (isNextActionRequest(request)) return "next_action";
  if (isRscRequest(request)) return "rsc";
  if (isNextInternalRequest(request)) return "next_internal";
  if (!isNavigationMethod(request.method)) return "non_navigation_method";
  return null;
}

function logAppRequestHandling(request: NextRequest, event: "pass_through" | "auth_redirect", reason: string) {
  console.info("[middleware] app_request", {
    event,
    reason,
    method: request.method,
    pathname: request.nextUrl.pathname,
    hasNextAction: isNextActionRequest(request),
    isRsc: isRscRequest(request),
    hasRouterState: request.headers.has("next-router-state-tree")
  });
}

function isAdminAccessPath(pathname: string) {
  return (
    pathname === "/admin/login" ||
    pathname.startsWith("/api/admin/") ||
    pathname === "/app/admin" ||
    pathname.startsWith("/app/admin/")
  );
}

function requiresAdminSession(pathname: string) {
  if (pathname === "/api/admin/login" || pathname === "/api/admin/logout") return false;
  return pathname === "/app/admin" || pathname.startsWith("/app/admin/") || pathname.startsWith("/api/admin/");
}

function adminSessionRequiredResponse(request: NextRequest) {
  if (request.nextUrl.pathname.startsWith("/api/")) {
    return NextResponse.json({ error: "admin_session_required" }, { status: 401 });
  }

  const loginUrl = request.nextUrl.clone();
  loginUrl.pathname = "/admin/login";
  loginUrl.search = "";
  return NextResponse.redirect(loginUrl);
}

function forbiddenResponse() {
  return new NextResponse(ADMIN_DENIED_BODY, {
    status: 403,
    headers: { "content-type": "text/plain; charset=utf-8" }
  });
}

function normalizeIp(value: string | undefined | null) {
  const raw = (value || "").trim();
  if (!raw) return "";

  const bracketed = raw.match(/^\[([^\]]+)\](?::\d+)?$/);
  if (bracketed) return bracketed[1].toLowerCase();

  const withoutPort = /^\d{1,3}(?:\.\d{1,3}){3}:\d+$/.test(raw) ? raw.replace(/:\d+$/, "") : raw;
  return withoutPort.toLowerCase().replace(/^::ffff:/, "");
}

function requestClientIp(request: NextRequest) {
  const forwardedFor = request.headers.get("x-forwarded-for");
  const firstForwardedIp = forwardedFor?.split(",")[0]?.trim();
  return normalizeIp(firstForwardedIp || request.headers.get("x-real-ip"));
}

function allowedIpSet() {
  return new Set(
    (process.env.ADMIN_ALLOWED_IPS || "")
      .split(",")
      .map((item) => normalizeIp(item))
      .filter(Boolean)
  );
}

function isIpAllowed(request: NextRequest) {
  const configuredIps = allowedIpSet();
  if (!configuredIps.size) return true;

  const clientIp = requestClientIp(request);
  return Boolean(clientIp && configuredIps.has(clientIp));
}

function cfAccessRequired() {
  return process.env.ADMIN_CF_ACCESS_REQUIRED?.trim().toLowerCase() === "true";
}

function normalizeCfAccessDomain(value: string | undefined) {
  const trimmed = (value || "").trim().replace(/\/+$/, "");
  if (!trimmed) return "";
  return trimmed.startsWith("http://") || trimmed.startsWith("https://") ? trimmed : `https://${trimmed}`;
}

function getCfAccessJwks(domain: string) {
  if (!cfAccessJwks || cfAccessJwks.domain !== domain) {
    cfAccessJwks = {
      domain,
      jwks: createRemoteJWKSet(new URL(`${domain}/cdn-cgi/access/certs`))
    };
  }

  return cfAccessJwks.jwks;
}

async function isCfAccessAllowed(request: NextRequest) {
  if (!cfAccessRequired()) return true;

  const domain = normalizeCfAccessDomain(process.env.CF_ACCESS_TEAM_DOMAIN || process.env.ADMIN_CF_ACCESS_TEAM_DOMAIN);
  const audience = (process.env.CF_ACCESS_AUD || process.env.ADMIN_CF_ACCESS_AUD || "").trim();
  const token = request.headers.get("cf-access-jwt-assertion");

  if (!domain || !audience || !token) return false;

  try {
    await jwtVerify(token, getCfAccessJwks(domain), {
      audience,
      issuer: domain
    });
    return true;
  } catch {
    return false;
  }
}

async function adminAccessGuard(request: NextRequest) {
  if (!isAdminAccessPath(request.nextUrl.pathname)) return null;

  // Browser JavaScript cannot prove a MacBook serial number or MAC address.
  // True device-only admin access should be enforced with Cloudflare Zero Trust
  // device posture or an mTLS client certificate before requests reach Vercel.
  if (!isIpAllowed(request)) return forbiddenResponse();
  if (!(await isCfAccessAllowed(request))) return forbiddenResponse();

  if (!requiresAdminSession(request.nextUrl.pathname)) return null;

  const session = await verifyAdminSessionToken(
    request.cookies.get(ADMIN_SESSION_COOKIE)?.value,
    process.env.AUTH_SECRET || ""
  );

  if (session) return null;

  return adminSessionRequiredResponse(request);
}

function redirectTo(request: NextRequest, pathname: string) {
  const url = request.nextUrl.clone();
  url.pathname = pathname;
  url.search = "";
  return NextResponse.redirect(url);
}

function isLocalHost(host: string) {
  return host === "localhost" || host === "127.0.0.1" || host.endsWith(".localhost");
}

function publicOrigin(
  envKey: "NEXT_PUBLIC_AUTH_ORIGIN" | "NEXT_PUBLIC_APP_ORIGIN" | "NEXT_PUBLIC_STUDENT_CLUB_ORIGIN",
  fallback: string,
  request: NextRequest
) {
  if (isLocalHost(normalizedHost(request))) {
    return `${request.nextUrl.protocol}//${request.nextUrl.host}`;
  }

  const configured = process.env[envKey]?.trim();
  return (configured || fallback).replace(/\/+$/, "");
}

function authOrigin(request: NextRequest) {
  return publicOrigin("NEXT_PUBLIC_AUTH_ORIGIN", "https://auth.cadesca.com", request);
}

function appOrigin(request: NextRequest) {
  return publicOrigin("NEXT_PUBLIC_APP_ORIGIN", "https://app.cadesca.com", request);
}

function studentClubOrigin(request: NextRequest) {
  return publicOrigin("NEXT_PUBLIC_STUDENT_CLUB_ORIGIN", "https://studentclub.cadesca.com", request);
}

function publicSiteOrigin(request: NextRequest) {
  if (isLocalHost(normalizedHost(request))) {
    return `${request.nextUrl.protocol}//${request.nextUrl.host}`;
  }

  return (process.env.NEXT_PUBLIC_SITE_ORIGIN?.trim() || "https://cadesca.com").replace(/\/+$/, "");
}

function isAuthRoute(pathname: string) {
  return (
    pathname === "/login" ||
    pathname === "/signup" ||
    pathname === "/verify-email" ||
    pathname === "/forgot-password" ||
    pathname === "/reset-password" ||
    pathname === "/request-university" ||
    pathname === "/logout"
  );
}

function isStudentClubRoute(pathname: string) {
  return pathname === "/student-club" || pathname.startsWith("/student-club/");
}

function hasSupabaseAuthCookie(request: NextRequest) {
  return request.cookies.getAll().some((cookie) => cookie.name.startsWith("sb-") && cookie.name.includes("auth-token"));
}

async function hasStudentSession(request: NextRequest) {
  if (hasSupabaseAuthCookie(request)) return true;

  const secret = process.env.AUTH_SECRET || "";
  const token = request.cookies.get(USER_SESSION_COOKIE)?.value;
  const session = secret && token ? await verifyUserSessionToken(token, secret).catch(() => null) : null;
  return session?.role === "user";
}

function redirectAbsolute(url: string) {
  return NextResponse.redirect(new URL(url));
}

function authLoginRedirect(request: NextRequest) {
  const url = new URL("/login", authOrigin(request));
  url.searchParams.set("next", `${appOrigin(request)}/app/user/home`);
  return redirectAbsolute(url.toString());
}

async function finalizeResponse(request: NextRequest, response: NextResponse) {
  if (isNextActionRequest(request) || isRscRequest(request) || isNextInternalRequest(request)) {
    return response;
  }

  return refreshSupabaseAuth(request, response);
}

function applyLocaleToResponse(response: NextResponse, resolution: LocaleResolution) {
  response.headers.set(LOCALE_HEADER, resolution.locale);

  if (resolution.persistDetectedLocale) {
    response.cookies.set(NEXT_LOCALE_COOKIE_NAME, resolution.locale, {
      domain: LOCALE_COOKIE_DOMAIN,
      path: "/",
      maxAge: LOCALE_COOKIE_MAX_AGE,
      sameSite: "lax",
      httpOnly: false,
      secure: process.env.NODE_ENV === "production"
    });
  }

  return response;
}

function localizedNextResponse(request: NextRequest, resolution: LocaleResolution) {
  const requestHeaders = new Headers(request.headers);
  requestHeaders.set(LOCALE_HEADER, resolution.locale);

  return applyLocaleToResponse(
    NextResponse.next({
      request: {
        headers: requestHeaders
      }
    }),
    resolution
  );
}

export async function middleware(request: NextRequest) {
  const pathname = request.nextUrl.pathname;
  const host = normalizedHost(request);
  const adminResponse = await adminAccessGuard(request);

  if (adminResponse) return finalizeResponse(request, adminResponse);

  if (host === "api.cadesca.com") {
    return finalizeResponse(
      request,
      pathname.startsWith("/api/") ? NextResponse.next() : new NextResponse("Not found", { status: 404 })
    );
  }

  if (isStaticBypass(pathname)) {
    return NextResponse.next();
  }

  if (pathname.startsWith("/api/")) {
    return finalizeResponse(request, NextResponse.next());
  }

  const localeResolution = resolveLocale(request);
  const passThroughReason = appRequestPassThroughReason(request);
  const authenticatedAppHost =
    host === "app.cadesca.com" ||
    host === "cadesca-app.vercel.app";
  const nonCanonicalPortalHost =
    host === "auth.cadesca.com" ||
    host === "studentclub.cadesca.com" ||
    host === "merchant.cadesca.com" ||
    host === "adminlog.cadesca.com";

  if (host === "studentclub.cadesca.com") {
    if (pathname === "/") {
      return finalizeResponse(
        request,
        applyLocaleToResponse(redirectTo(request, "/student-club"), localeResolution)
      );
    }

    if (pathname.startsWith("/app/")) {
      const target = new URL(`${pathname}${request.nextUrl.search}`, appOrigin(request));
      return finalizeResponse(
        request,
        applyLocaleToResponse(redirectAbsolute(target.toString()), localeResolution)
      );
    }

    if (isAuthRoute(pathname)) {
      const target = new URL(`${pathname}${request.nextUrl.search}`, authOrigin(request));
      return finalizeResponse(
        request,
        applyLocaleToResponse(redirectAbsolute(target.toString()), localeResolution)
      );
    }

    if (
      !isStudentClubRoute(pathname) &&
      !isPublicProfilePath(pathname) &&
      !isPublicPostPath(pathname) &&
      !isPublicMediaPath(pathname)
    ) {
      return finalizeResponse(
        request,
        applyLocaleToResponse(redirectTo(request, "/student-club"), localeResolution)
      );
    }
  } else if (
    isStudentClubRoute(pathname) &&
    !isLocalHost(host) &&
    (host === "cadesca.com" ||
      host === "www.cadesca.com" ||
      authenticatedAppHost ||
      host === "auth.cadesca.com" ||
      host === "merchant.cadesca.com" ||
      host === "adminlog.cadesca.com")
  ) {
    const target = new URL(`${pathname}${request.nextUrl.search}`, studentClubOrigin(request));
    return finalizeResponse(
      request,
      applyLocaleToResponse(redirectAbsolute(target.toString()), localeResolution)
    );
  }

  if (isPublicProfilePath(pathname)) {
    if (nonCanonicalPortalHost) {
      const target = new URL(`${pathname}${request.nextUrl.search}`, publicSiteOrigin(request));
      return finalizeResponse(
        request,
        applyLocaleToResponse(redirectAbsolute(target.toString()), localeResolution)
      );
    }

    if (authenticatedAppHost && !(await hasStudentSession(request))) {
      const target = new URL(`${pathname}${request.nextUrl.search}`, publicSiteOrigin(request));
      return finalizeResponse(
        request,
        applyLocaleToResponse(redirectAbsolute(target.toString()), localeResolution)
      );
    }

    return finalizeResponse(request, localizedNextResponse(request, localeResolution));
  }

  if (isPublicPostPath(pathname) || isPublicMediaPath(pathname)) {
    const shouldUseCanonicalHost =
      authenticatedAppHost ||
      nonCanonicalPortalHost;

    if (shouldUseCanonicalHost) {
      const target = new URL(`${pathname}${request.nextUrl.search}`, publicSiteOrigin(request));
      return finalizeResponse(
        request,
        applyLocaleToResponse(redirectAbsolute(target.toString()), localeResolution)
      );
    }

    return finalizeResponse(request, localizedNextResponse(request, localeResolution));
  }

  if (passThroughReason) {
    logAppRequestHandling(request, "pass_through", passThroughReason);
    return finalizeResponse(request, localizedNextResponse(request, localeResolution));
  }

  if (host === "auth.cadesca.com") {
    const authenticated = await hasStudentSession(request);

    if ((pathname === "/login" || pathname === "/signup" || pathname === "/verify-email") && authenticated) {
      return finalizeResponse(
        request,
        applyLocaleToResponse(redirectAbsolute(`${appOrigin(request)}/app/user/home`), localeResolution)
      );
    }

    if (pathname === "/") {
      return finalizeResponse(request, applyLocaleToResponse(redirectTo(request, "/login"), localeResolution));
    }

    if (pathname.startsWith("/app/")) {
      const target = new URL(`${pathname}${request.nextUrl.search}`, appOrigin(request));
      return finalizeResponse(request, applyLocaleToResponse(redirectAbsolute(target.toString()), localeResolution));
    }

    if (!isAuthRoute(pathname)) {
      return finalizeResponse(request, applyLocaleToResponse(redirectTo(request, "/login"), localeResolution));
    }
  }

  if ((host === "app.cadesca.com" || host === "cadesca-app.vercel.app") && pathname === "/") {
    const response = (await hasStudentSession(request))
      ? redirectAbsolute(`${appOrigin(request)}/app/user/home`)
      : authLoginRedirect(request);
    return finalizeResponse(request, applyLocaleToResponse(response, localeResolution));
  }

  if (host === "app.cadesca.com" || host === "cadesca-app.vercel.app") {
    if (isAuthRoute(pathname)) {
      const target = new URL(`${pathname}${request.nextUrl.search}`, authOrigin(request));
      return finalizeResponse(request, applyLocaleToResponse(redirectAbsolute(target.toString()), localeResolution));
    }

    if (pathname.startsWith("/app/") && !(await hasStudentSession(request))) {
      logAppRequestHandling(request, "auth_redirect", "missing_student_session");
      return finalizeResponse(request, applyLocaleToResponse(authLoginRedirect(request), localeResolution));
    }
  }

  if (host === "merchant.cadesca.com" && (pathname === "/" || pathname === "/login")) {
    return finalizeResponse(
      request,
      applyLocaleToResponse(redirectTo(request, "/merchant/login"), localeResolution)
    );
  }

  if (host === "adminlog.cadesca.com" && (pathname === "/" || pathname === "/login")) {
    return finalizeResponse(
      request,
      applyLocaleToResponse(redirectTo(request, "/admin/login"), localeResolution)
    );
  }

  return finalizeResponse(request, localizedNextResponse(request, localeResolution));
}

export const config = {
  matcher: "/:path*",
  runtime: "nodejs"
};
