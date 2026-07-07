import { redirect } from "next/navigation";

import { RoleBasedAppShell } from "@/components/app/RoleBasedAppShell";
import { roleNavItems } from "@/components/app/role-navigation";
import { employeeFeaturesEnabled } from "@/lib/appConfig";

export function EmployeeShell({ children }: { children: React.ReactNode }) {
  if (!employeeFeaturesEnabled) {
    redirect("/login");
  }

  return (
    <RoleBasedAppShell role="employee" navItems={roleNavItems.employee}>
      {children}
    </RoleBasedAppShell>
  );
}
