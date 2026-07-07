import "server-only";

import { createServerClient, type CookieOptions } from "@supabase/ssr";
import { cookies } from "next/headers";

import { withSharedCookieDomain } from "@/lib/cookieDomain";
import { requireSupabasePublicEnv } from "./env";

export async function createSupabaseServerClient() {
  const { url, publishableKey } = requireSupabasePublicEnv();
  const cookieStore = await cookies();

  return createServerClient(url, publishableKey, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        try {
          cookiesToSet.forEach(({ name, value, options }) => {
            cookieStore.set(name, value, withSharedCookieDomain(options as CookieOptions));
          });
        } catch {
          // Server Components cannot write cookies. Middleware refreshes the
          // session and persists refreshed auth cookies on navigations.
        }
      }
    }
  });
}
