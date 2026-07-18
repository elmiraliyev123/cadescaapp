"use client";

import { useRouter, useSearchParams } from "next/navigation";

import { LoginScreen } from "@/components/screens/LoginScreen";
import { safePostAuthHref } from "@/lib/authOrigins";
import { useDemoState } from "@/lib/demoStore";

type LoginPageClientProps = {
  turnstileSiteKey: string;
  initialMode?: "login" | "signup" | "verify";
};

export function LoginPageClient({ turnstileSiteKey, initialMode = "login" }: LoginPageClientProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { dispatch } = useDemoState();

  function postAuthDestination() {
    return safePostAuthHref(searchParams.get("next"));
  }

  async function loginUser(input: { email: string; password: string; turnstileToken?: string }) {
    const response = await fetch("/api/auth/user/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(input)
    });

    if (!response.ok) {
      const data = await response.json().catch(() => ({}));
      if (data.error === "account_inactive") {
        return { status: "error" as const, message: "common.accountSuspended" as const };
      }
      if (data.error === "email_not_verified" && data.user?.email) {
        return {
          status: "unverified" as const,
          user: {
            name: typeof data.user.name === "string" ? data.user.name : input.email,
            email: data.user.email
          }
        };
      }
      return { status: "error" as const, message: "login.invalidCredentials" as const };
    }

    const data = await response.json().catch(() => ({})) as {
      clubAccess?: {
        available?: boolean;
        hasActiveMembership?: boolean;
        invitationCount?: number;
        gatewayHref?: string;
      };
    };

    if (process.env.NODE_ENV === "development") {
      dispatch({ type: "SET_SELECTED_ROLE", payload: { role: "user", userId: "user_mock" } });
    }

    const requestedDestination = searchParams.get("next");
    const clubAccessAvailable = data.clubAccess?.available !== false;
    const shouldSurfaceClubAccess = clubAccessAvailable && (
      data.clubAccess?.hasActiveMembership === true || Number(data.clubAccess?.invitationCount || 0) > 0
    );
    const destination = !requestedDestination && shouldSurfaceClubAccess && data.clubAccess?.gatewayHref === "/app/user/club"
      ? data.clubAccess.gatewayHref
      : postAuthDestination();
    window.setTimeout(() => router.push(destination), 0);
    return { status: "authenticated" as const };
  }

  async function registerUserAccount(input: {
    name: string;
    displayName?: string;
    username?: string;
    email: string;
    password?: string;
    turnstileToken?: string;
    verifiedVia?: string;
    acceptedTermsAt?: string;
    emailVerificationCode?: string;
    emailVerificationToken?: string;
  }) {
    const response = await fetch("/api/auth/user/register", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(input)
    });

    if (!response.ok) {
      const data = await response.json().catch(() => ({}));
      if (data.error === "email_in_use") {
        throw new Error("duplicate_email");
      }
      if (typeof data.error === "string") {
        throw new Error(data.error);
      }
      throw new Error("Registration failed");
    }

    if (process.env.NODE_ENV === "development") {
      dispatch({
        type: "REGISTER_USER_ACCOUNT",
        payload: {
          name: input.name,
          email: input.email,
          password: input.password || "",
          accountType: "user"
        }
      });
      dispatch({ type: "SET_SELECTED_ROLE", payload: { role: "user", userId: "user_mock" } });
    }

    window.setTimeout(() => router.push(postAuthDestination()), 0);
  }

  function verifyUserEmail() {
    window.setTimeout(() => router.push(postAuthDestination()), 0);
  }

  return (
    <LoginScreen
      initialMode={initialMode}
      turnstileSiteKey={turnstileSiteKey}
      onLogin={loginUser}
      onAccountSubmit={registerUserAccount}
      onEmailVerified={verifyUserEmail}
    />
  );
}
