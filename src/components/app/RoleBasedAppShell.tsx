"use client";

import { usePathname, useRouter } from "next/navigation";
import type { DemoRole, NavItem } from "@/lib/types";
import { Sidebar } from "@/components/app/Sidebar";
import { AppTopBar } from "@/components/app/AppTopBar";
import { MobileBottomNav } from "@/components/app/MobileBottomNav";
import { Toast } from "@/components/ui/Toast";
import { useDemoState } from "@/lib/demoStore";
import { RouteGuard } from "@/components/app/RouteGuard";
import { cn } from "@/lib/utils";
import { useLanguage } from "@/lib/i18n";

export function RoleBasedAppShell({
  role,
  navItems,
  children
}: {
  role: DemoRole;
  navItems: NavItem[];
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const { state, dispatch } = useDemoState();
  const { t } = useLanguage();
  
  const loginRoute = role === "merchant" ? "/merchant/login" : role === "admin" ? "/admin/login" : "/login";
  const hasBottomNav = role === "employee" || role === "user" || role === "merchant";
  async function handleLogout() {
    if (role === "admin") {
      await fetch("/api/admin/logout", { method: "POST" }).catch(() => undefined);
    } else if (role === "user" || role === "merchant") {
      await fetch("/api/auth/logout", { method: "POST" }).catch(() => undefined);
    }

    dispatch({ type: "LOGOUT" });
    router.push(loginRoute);
  }

  return (
    <RouteGuard role={role}>
      <div className="min-h-dvh bg-background text-on-background">
        <Sidebar currentPath={pathname} navItems={navItems} role={role} onLogout={handleLogout} />
        <AppTopBar />
        <main className={cn("mx-auto min-h-dvh max-w-[1280px] px-4 pt-[calc(128px+env(safe-area-inset-top))] md:ml-[260px] md:px-7 md:py-7 lg:px-9", hasBottomNav ? "pb-[calc(88px+env(safe-area-inset-bottom))]" : "pb-8", "md:pb-8")}>
          {children}
        </main>
        {hasBottomNav && <MobileBottomNav navItems={navItems} currentPath={pathname} />}
        <Toast message={state.toast} visible={Boolean(state.toast)} />
      </div>
    </RouteGuard>
  );
}
