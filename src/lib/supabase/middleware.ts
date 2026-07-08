import { createHash } from "node:crypto";

import { createServerClient, type CookieOptions } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

import { withSharedCookieDomain } from "@/lib/cookieDomain";
import { getSupabasePublicEnv } from "./env";

type CookieToSet = {
  name: string;
  value: string;
  options: CookieOptions;
};

type RefreshResult = {
  cookiesToSet: CookieToSet[];
  headersToSet: Array<[string, string]>;
  errorCode?: string;
  errorMessage?: string;
};

type RefreshLock = {
  promise: Promise<RefreshResult>;
  expiresAt: number;
};

const REFRESH_LOCK_TTL_MS = 5_000;
const refreshLocks = new Map<string, RefreshLock>();

function supabaseAuthCookies(request: NextRequest) {
  return request.cookies
    .getAll()
    .filter((cookie) => cookie.name.startsWith("sb-") && cookie.name.includes("auth-token"))
    .sort((a, b) => a.name.localeCompare(b.name));
}

function refreshLockKey(request: NextRequest) {
  const cookies = supabaseAuthCookies(request);
  if (!cookies.length) return null;

  return createHash("sha256")
    .update(cookies.map((cookie) => `${cookie.name}=${cookie.value}`).join(";"))
    .digest("hex");
}

function pruneRefreshLocks(now: number) {
  for (const [key, entry] of refreshLocks) {
    if (entry.expiresAt <= now) {
      refreshLocks.delete(key);
    }
  }
}

function applyRefreshResult(request: NextRequest, response: NextResponse, result: RefreshResult) {
  result.cookiesToSet.forEach(({ name, value, options }) => {
    request.cookies.set(name, value);
    response.cookies.set(name, value, withSharedCookieDomain(options));
  });

  result.headersToSet.forEach(([key, value]) => {
    response.headers.set(key, value);
  });

  if (result.cookiesToSet.length) {
    response.headers.set("cache-control", "private, no-store");
  }
}

function authErrorDetails(error: unknown) {
  const record = error && typeof error === "object" ? error as Record<string, unknown> : null;
  return {
    code: typeof record?.code === "string" ? record.code : undefined,
    message: error instanceof Error ? error.message : "unknown"
  };
}

async function performSupabaseRefresh(request: NextRequest): Promise<RefreshResult> {
  const env = getSupabasePublicEnv();
  const cookiesToSet: CookieToSet[] = [];
  const headersToSet: Array<[string, string]> = [];

  if (!env || !supabaseAuthCookies(request).length) {
    return { cookiesToSet, headersToSet };
  }

  const supabase = createServerClient(env.url, env.publishableKey, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(nextCookiesToSet, headers = {}) {
        nextCookiesToSet.forEach(({ name, value, options }) => {
          cookiesToSet.push({ name, value, options: options as CookieOptions });
        });

        Object.entries(headers).forEach(([key, value]) => {
          headersToSet.push([key, value]);
        });
      }
    }
  });

  try {
    await supabase.auth.getClaims();
  } catch (error) {
    const details = authErrorDetails(error);
    console.warn("[supabase_auth_refresh]", {
      event: "failed",
      code: details.code,
      message: details.message
    });
    return {
      cookiesToSet,
      headersToSet,
      errorCode: details.code,
      errorMessage: details.message
    };
  }

  return { cookiesToSet, headersToSet };
}

export async function refreshSupabaseAuth(request: NextRequest, response: NextResponse) {
  const env = getSupabasePublicEnv();
  if (!env) return response;

  const lockKey = refreshLockKey(request);
  if (!lockKey) return response;

  const now = Date.now();
  pruneRefreshLocks(now);

  let entry = refreshLocks.get(lockKey);
  if (!entry) {
    entry = {
      promise: performSupabaseRefresh(request).finally(() => {
        setTimeout(() => refreshLocks.delete(lockKey), REFRESH_LOCK_TTL_MS).unref?.();
      }),
      expiresAt: now + REFRESH_LOCK_TTL_MS
    };
    refreshLocks.set(lockKey, entry);
  } else {
    console.info("[supabase_auth_refresh]", {
      event: "coalesced",
      pathname: request.nextUrl.pathname
    });
  }

  const result = await entry.promise;
  applyRefreshResult(request, response, result);
  return response;
}
