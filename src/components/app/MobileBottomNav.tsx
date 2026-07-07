import Link from "next/link";
import type { NavItem } from "@/lib/types";
import { cn } from "@/lib/utils";
import { useLanguage } from "@/lib/i18n";

export function MobileBottomNav({ navItems, currentPath }: { navItems: NavItem[]; currentPath: string }) {
  const { t } = useLanguage();
  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 border-t border-outline-variant/20 bg-surface/95 px-2 pb-[max(6px,env(safe-area-inset-bottom))] pt-1 backdrop-blur md:hidden">
      <div className="grid gap-0.5" style={{ gridTemplateColumns: `repeat(${navItems.length}, minmax(0, 1fr))` }}>
        {navItems.map((item) => {
          const active = currentPath === item.href || currentPath.startsWith(`${item.href}/`);
          const isCreate = item.href.endsWith("/create");

          if (isCreate) {
            return (
              <Link
                key={item.href}
                href={item.href}
                className="flex items-center justify-center py-1"
                aria-label={t(item.i18nKey)}
              >
                <span className="flex h-11 w-11 items-center justify-center rounded-full bg-primary text-on-primary shadow-md">
                  <span className="material-symbols-outlined text-[24px]" aria-hidden="true">add</span>
                </span>
              </Link>
            );
          }

          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "flex min-w-0 flex-col items-center justify-center gap-0.5 rounded-xl px-1 py-1.5 transition-colors",
                active ? "text-primary" : "text-secondary hover:text-primary"
              )}
            >
              <span
                className={cn(
                  "material-symbols-outlined flex h-7 w-7 items-center justify-center text-[20px]",
                  active && "material-symbols-filled"
                )}
                aria-hidden="true"
              >
                {item.icon}
              </span>
              <span className="max-w-full truncate text-center text-[11px] font-semibold leading-3">
                {t(item.i18nKey)}
              </span>
              {active ? <span className="mt-0.5 h-[3px] w-3 rounded-full bg-primary" /> : null}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
