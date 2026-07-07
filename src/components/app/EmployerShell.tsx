import { redirect } from "next/navigation";

import { RoleBasedAppShell } from "@/components/app/RoleBasedAppShell";
import { roleNavItems } from "@/components/app/role-navigation";
import { employerDashboardEnabled } from "@/lib/appConfig";

export function EmployerShell({ children }: { children: React.ReactNode }) {
  if (!employerDashboardEnabled) {
    redirect("/login");
  }

  return (
    <RoleBasedAppShell role="employer" navItems={roleNavItems.employer}>
      {children}
    </RoleBasedAppShell>
  );
}
