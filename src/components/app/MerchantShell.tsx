import { redirect } from "next/navigation";

import { RoleBasedAppShell } from "@/components/app/RoleBasedAppShell";
import { roleNavItems } from "@/components/app/role-navigation";
import { merchantPortalEnabled } from "@/lib/appConfig";

export function MerchantShell({ children }: { children: React.ReactNode }) {
  if (!merchantPortalEnabled) {
    redirect("/login");
  }

  return (
    <RoleBasedAppShell role="merchant" navItems={roleNavItems.merchant}>
      {children}
    </RoleBasedAppShell>
  );
}
