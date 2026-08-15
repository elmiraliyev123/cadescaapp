import { redirect } from "next/navigation";

import { getAuthUrl } from "@/lib/appConfig";
import { PRIVATE_ROUTE_METADATA } from "@/lib/seo/metadata";
import { OAuthError, authorizeClient } from "@/lib/server/oauth";

export const metadata = { ...PRIVATE_ROUTE_METADATA, title: "Authorize | Cadesca" };
export const dynamic = "force-dynamic";

type Search = Record<string, string | string[] | undefined>;

function value(search: Search, key: string) {
  const candidate = search[key];
  return Array.isArray(candidate) ? candidate[0] || "" : candidate || "";
}

function authorizeUrl(search: Search) {
  const url = new URL("/authorize", getAuthUrl());
  for (const [key, candidate] of Object.entries(search)) {
    const normalized = Array.isArray(candidate) ? candidate[0] : candidate;
    if (normalized) url.searchParams.set(key, normalized);
  }
  return url.toString();
}

export default async function AuthorizePage({ searchParams }: { searchParams: Promise<Search> }) {
  const search = await searchParams;
  try {
    const result = await authorizeClient({
      clientId: value(search, "client_id"),
      redirectUri: value(search, "redirect_uri"),
      responseType: value(search, "response_type"),
      scope: value(search, "scope") || null,
      state: value(search, "state") || null,
      nonce: value(search, "nonce") || null,
      codeChallenge: value(search, "code_challenge") || null,
      codeChallengeMethod: value(search, "code_challenge_method") || null
    });
    const destination = new URL(result.redirectUri);
    destination.searchParams.set("state", result.state);
    if ("code" in result && result.code) destination.searchParams.set("code", result.code);
    if ("error" in result && result.error) {
      destination.searchParams.set("error", result.error);
      destination.searchParams.set("error_description", result.errorDescription);
    }
    redirect(destination.toString());
  } catch (error) {
    if (error instanceof OAuthError && error.code === "login_required") {
      const login = new URL("/login", getAuthUrl());
      login.searchParams.set("next", authorizeUrl(search));
      redirect(login.toString());
    }
    if (error instanceof OAuthError) {
      return (
        <main className="flex min-h-dvh items-center justify-center bg-[#fafafa] px-5 py-12">
          <section className="w-full max-w-lg rounded-2xl border border-black/15 bg-white p-7 text-center">
            <span className="material-symbols-outlined text-[42px]" aria-hidden="true">gpp_bad</span>
            <h1 className="mt-3 text-2xl font-black">Authorization unavailable</h1>
            <p className="mt-2 text-sm leading-6 text-black/65">The client request is invalid or is not registered with Cadesca.</p>
          </section>
        </main>
      );
    }
    throw error;
  }
}

