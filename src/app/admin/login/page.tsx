"use client";

import { useRouter } from "next/navigation";

import { PortalLoginScreen } from "@/components/screens/PortalLoginScreen";
import { roleHome } from "@/components/app/role-navigation";
import { useDemoState } from "@/lib/demoStore";

export default function AdminLoginPage() {
  const router = useRouter();
  const { dispatch } = useDemoState();

  return (
    <PortalLoginScreen
      portal="admin"
      domain="adminlog.cadesca.com"
      onSubmit={async (input) => {
        if (!input.email.trim() || !input.password.trim()) {
          dispatch({ type: "SHOW_TOAST", payload: { message: "login.invalidCredentials" } });
          return;
        }

        const response = await fetch("/api/admin/login", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(input)
        });

        if (!response.ok) {
          dispatch({ type: "SHOW_TOAST", payload: { message: response.status === 503 ? "login.adminAuthNotConfigured" : "login.invalidCredentials" } });
          return;
        }

        dispatch({ type: "ADMIN_LOGIN", payload: { ...input, verified: true } });
        window.setTimeout(() => router.push(roleHome.admin), 0);
      }}
    />
  );
}
