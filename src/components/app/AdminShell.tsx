import { redirect } from "next/navigation";

import { RoleBasedAppShell } from "@/components/app/RoleBasedAppShell";
import { roleNavItems } from "@/components/app/role-navigation";
import { adminConsoleEnabled } from "@/lib/appConfig";

export function AdminShell({ children }: { children: React.ReactNode }) {
  if (!adminConsoleEnabled) {
    redirect("/login");
  }

  return (
    <RoleBasedAppShell role="admin" navItems={roleNavItems.admin}>
      {children}
    </RoleBasedAppShell>
  );
}
