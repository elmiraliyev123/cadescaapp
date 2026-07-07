import Link from "next/link";
import type { DemoRole, NavItem } from "@/lib/types";
import { Logo } from "@/components/ui/Logo";
import { Button } from "@/components/ui/Button";
import { cn } from "@/lib/utils";
import { DemoRoleSwitcher } from "@/components/app/DemoRoleSwitcher";
import { getCurrentMerchantRestaurant, getCurrentMerchant, useDemoState } from "@/lib/demoStore";
import { useLanguage } from "@/lib/i18n";
import { demoModeEnabled } from "@/lib/appConfig";

export function Sidebar({
  currentPath,
  navItems,
  role,
  onLogout
}: {
  currentPath: string;
  navItems: NavItem[];
  role: DemoRole;
  onLogout: () => void | Promise<void>;
}) {
  const { state } = useDemoState();
  const { t } = useLanguage();
  const currentMerchant = role === "merchant" ? getCurrentMerchant(state) : null;
  const currentRestaurant = role === "merchant" ? getCurrentMerchantRestaurant(state) : null;

  return (
    <aside className="fixed inset-y-0 left-0 hidden w-[260px] border-r border-outline-variant/70 bg-surface md:flex md:flex-col">
      <div className="border-b border-outline-variant/70 px-5 py-4">
        <Logo maxWidth={140} />
      </div>
      <nav className="flex-1 space-y-1 px-3 py-4">
        {navItems.map((item) => {
          const active = currentPath === item.href || currentPath.startsWith(`${item.href}/`);
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "flex h-10 w-full items-center gap-2.5 rounded-lg px-3 text-left text-[13px] font-semibold leading-5 transition-colors",
                active
                  ? "bg-surface-container-lowest text-primary ring-1 ring-outline-variant/70"
                  : "text-secondary hover:bg-surface-container-low hover:text-primary"
              )}
            >
              <span className={cn("material-symbols-outlined text-[19px]", active ? "text-primary" : "text-secondary")} aria-hidden="true">{item.icon}</span>
              <span>{t(item.i18nKey)}</span>
            </Link>
          );
        })}
      </nav>
      <div className="space-y-3 border-t border-outline-variant/70 p-3">
        {demoModeEnabled && !state.presentationMode ? <DemoRoleSwitcher role={role} /> : null}
        <div className="rounded-xl border border-outline-variant/70 bg-surface-container-lowest p-3">
          <div className="mb-3 min-w-0">
            <p className="truncate text-[13px] font-semibold leading-5 text-primary">
              {role === "merchant" ? currentRestaurant?.name || t("merchant.restaurantNotAssigned") : t(`common.${role}` as any)}
            </p>
            {role === "merchant" && currentMerchant ? (
              <p className="truncate text-caption font-medium text-secondary">{currentMerchant.email}</p>
            ) : null}
          </div>
          <Button variant="secondary" size="sm" className="w-full" icon="logout" onClick={onLogout}>
            {t("common.logout")}
          </Button>
        </div>
      </div>
    </aside>
  );
}
