"use client";

import { useRouter } from "next/navigation";

import { PortalLoginScreen } from "@/components/screens/PortalLoginScreen";
import { roleHome } from "@/components/app/role-navigation";
import { useDemoState } from "@/lib/demoStore";

export default function MerchantLoginPage() {
  const router = useRouter();
  const { state, dispatch } = useDemoState();

  return (
    <PortalLoginScreen
      portal="merchant"
      domain="merchant.cadesca.com"
      onSubmit={async (input) => {
        const email = input.email.trim().toLowerCase();

        try {
          const res = await fetch("/api/auth/merchant/login", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ email, password: input.password, turnstileToken: input.turnstileToken })
          });

          if (!res.ok) {
            const data = await res.json().catch(() => ({}));
            dispatch({
              type: "SHOW_TOAST",
              payload: {
                message:
                  data.error === "turnstile_missing" || data.error === "turnstile_invalid" || data.error === "turnstile_verification_failed"
                    ? "login.securityVerificationFailed"
                    : "login.invalidCredentials"
              }
            });
            return false;
          }

          const data = await res.json();
          dispatch({ 
            type: "POSTGRES_MERCHANT_LOGIN", 
            payload: { merchantId: data.merchantId, restaurantId: data.restaurantId, email, restaurant: data.restaurant }
          });
          window.setTimeout(() => router.push(roleHome.merchant), 0);
          return true;
        } catch (error) {
          dispatch({ type: "SHOW_TOAST", payload: { message: "login.invalidCredentials" } });
          return false;
        }
      }}
    />
  );
}
