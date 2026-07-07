"use client";

import { RoleBasedAppShell } from "@/components/app/RoleBasedAppShell";
import { roleNavItems } from "@/components/app/role-navigation";

export function UserShell({ children }: { children: React.ReactNode }) {
  return (
    <RoleBasedAppShell role="user" navItems={roleNavItems.user}>
      {children}
    </RoleBasedAppShell>
  );
}
