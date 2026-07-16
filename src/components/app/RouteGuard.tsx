"use client";

import { useEffect, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import type { DemoRole } from "@/lib/types";
import { useDemoState } from "@/lib/demoStore";
import {
  adminConsoleEnabled,
  employeeFeaturesEnabled,
  employerFeaturesEnabled,
  merchantPortalEnabled,
  publicUserAppEnabled
} from "@/lib/appConfig";
import { authLoginHref } from "@/lib/authOrigins";
import { useLanguage } from "@/lib/i18n";

function loginRouteFor(role: DemoRole, pathname = "/app/user/home") {
  if (role === "merchant") return "/merchant/login";
  if (role === "admin") return "/admin/login";
  return authLoginHref(pathname);
}

function featureAvailable(role: DemoRole) {
  if (role === "user") return publicUserAppEnabled;
  if (role === "merchant") return merchantPortalEnabled;
  if (role === "admin") return adminConsoleEnabled;
  if (role === "employee") return employeeFeaturesEnabled;
  if (role === "employer") return employerFeaturesEnabled;
  return false;
}

type UserMeResponse = {
  ok?: boolean;
  user?: {
    id?: unknown;
    name?: unknown;
    email?: unknown;
    studentStatus?: unknown;
    studentMenuAccess?: unknown;
    universityName?: unknown;
    universityDomain?: unknown;
  };
};

function isStudentStatus(value: unknown): value is "not_verified" | "pending" | "verified" | "rejected" {
  return value === "not_verified" || value === "pending" || value === "verified" || value === "rejected";
}

export function RouteGuard({
  role,
  children
}: {
  role: DemoRole;
  children: React.ReactNode;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const [isAuthorized, setIsAuthorized] = useState(false);
  const { state, hydrated, dispatch } = useDemoState();
  const { t } = useLanguage();

  useEffect(() => {
    if (!hydrated) {
      return;
    }

    if (!featureAvailable(role)) {
      setIsAuthorized(false);
      router.push(loginRouteFor(role, pathname));
      return;
    }

    if (role === "user") {
      const shouldCheckServerSession =
        !state.session.authenticated ||
        state.session.currentRole !== "user" ||
        !state.session.currentUserId ||
        !(state.users || []).some((user) => user.id === state.session.currentUserId);

      if (shouldCheckServerSession && process.env.NODE_ENV !== "development") {
        let cancelled = false;
        setIsAuthorized(false);

        fetch("/api/user/me", {
          cache: "no-store",
          credentials: "same-origin"
        })
          .then(async (response) => {
            if (!response.ok) return null;
            return (await response.json().catch(() => null)) as UserMeResponse | null;
          })
          .then((data) => {
            if (cancelled) return;
            const user = data?.user;
            if (
              user &&
              typeof user.id === "string" &&
              typeof user.name === "string" &&
              typeof user.email === "string" &&
              isStudentStatus(user.studentStatus)
            ) {
              dispatch({
                type: "SYNC_AUTHENTICATED_USER",
                payload: {
                  id: user.id,
                  name: user.name,
                  email: user.email,
                  studentStatus: user.studentStatus,
                  studentMenuAccess: user.studentMenuAccess === true,
                  universityName: typeof user.universityName === "string" ? user.universityName : null,
                  universityDomain: typeof user.universityDomain === "string" ? user.universityDomain : null
                }
              });
              setIsAuthorized(true);
              return;
            }

            router.push(loginRouteFor(role, pathname));
          })
          .catch(() => {
            if (!cancelled) router.push(loginRouteFor(role, pathname));
          });

        return () => {
          cancelled = true;
        };
      }

      if (!state.session.authenticated || state.session.currentRole !== role) {
        setIsAuthorized(false);
        router.push(loginRouteFor(role, pathname));
        return;
      }

      const currentUser = (state.users || []).find((user) => user.id === state.session.currentUserId);
      if (!currentUser && !(state.session.currentUserId === "user_mock" && process.env.NODE_ENV === "development")) {
        setIsAuthorized(false);
        dispatch({
          type: "SHOW_TOAST",
          payload: { message: "common.accountUnavailable" }
        });
        router.push(loginRouteFor(role, pathname));
        return;
      }
      if (currentUser && currentUser.status !== "active") {
        setIsAuthorized(false);
        dispatch({
          type: "SHOW_TOAST",
          payload: { message: "common.accountSuspended" }
        });
        router.push(loginRouteFor(role));
        return;
      }
    }

    if (!state.session.authenticated || !state.session.currentRole) {
      setIsAuthorized(false);
      router.push(loginRouteFor(role, pathname));
      return;
    }

    if (state.session.currentRole !== role) {
      setIsAuthorized(false);
      router.push(loginRouteFor(role));
      return;
    }

    if (role === "merchant") {
      const currentMerchant = (state.merchantUsers || []).find((merchant) => merchant.id === state.session.currentUserId);
      const currentRestaurant = currentMerchant
        ? (state.restaurants || []).find((restaurant) => restaurant.id === currentMerchant.restaurantId)
        : null;
      if (
        !currentMerchant ||
        currentMerchant.status !== "active" ||
        !currentRestaurant ||
        currentRestaurant.ownerMerchantId !== currentMerchant.id ||
        currentRestaurant.status === "deleted" ||
        currentRestaurant.status === "suspended"
      ) {
        setIsAuthorized(false);
        dispatch({
          type: "SHOW_TOAST",
          payload: { message: currentMerchant?.status === "suspended" ? "common.merchantSuspended" : "common.restaurantUnavailable" }
        });
        router.push(loginRouteFor(role));
        return;
      }
    }

    if (role === "admin" && state.session.currentUserId) {
      const currentAdmin = (state.users || []).find((user) => user.id === state.session.currentUserId);
      if (currentAdmin && currentAdmin.status !== "active") {
        setIsAuthorized(false);
        router.push(loginRouteFor(role));
        return;
      }
    }

    setIsAuthorized(true);
  }, [dispatch, hydrated, role, router, pathname, state.merchantUsers, state.restaurants, state.session.authenticated, state.session.currentRole, state.session.currentUserId, state.users]);

  if (!isAuthorized) {
    return (
      <main className="flex min-h-dvh items-center justify-center bg-background px-margin-mobile text-on-background">
        <div className="flex items-center gap-3 rounded-lg border border-outline-variant/70 bg-surface-container-lowest px-4 py-3 text-label-md font-semibold text-secondary">
          <span className="material-symbols-outlined icon-ui animate-spin" aria-hidden="true">progress_activity</span>
          <span>{t("social.loading")}</span>
        </div>
      </main>
    );
  }

  return <>{children}</>;
}
