import { createServerClient, type CookieOptions } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

import { withSharedCookieDomain } from "@/lib/cookieDomain";
import { getSupabasePublicEnv } from "./env";

export async function refreshSupabaseAuth(request: NextRequest, response: NextResponse) {
  const env = getSupabasePublicEnv();
  if (!env) return response;

  const supabase = createServerClient(env.url, env.publishableKey, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet, headers = {}) {
        cookiesToSet.forEach(({ name, value, options }) => {
          request.cookies.set(name, value);
          response.cookies.set(name, value, withSharedCookieDomain(options as CookieOptions));
        });

        Object.entries(headers).forEach(([key, value]) => {
          response.headers.set(key, value);
        });
      }
    }
  });

  try {
    await supabase.auth.getClaims();
  } catch {
    // Invalid or expired cookies should not break unrelated routes.
    // Downstream Supabase calls still authorize with verified claims.
  }

  return response;
}
