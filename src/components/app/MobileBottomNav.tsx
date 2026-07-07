import Link from "next/link";
import type { NavItem } from "@/lib/types";
import { cn } from "@/lib/utils";
import { useLanguage } from "@/lib/i18n";

export function MobileBottomNav({ navItems, currentPath }: { navItems: NavItem[]; currentPath: string }) {
  const { t } = useLanguage();
  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 border-t border-outline-variant/70 bg-surface/95 px-2 pb-[max(6px,env(safe-area-inset-bottom))] pt-1 shadow-[0_-12px_28px_rgba(0,0,0,0.08)] backdrop-blur md:hidden">
      <div className="grid gap-0.5" style={{ gridTemplateColumns: `repeat(${navItems.length}, minmax(0, 1fr))` }}>
        {navItems.map((item) => {
          const active = currentPath === item.href || currentPath.startsWith(`${item.href}/`);
          const isCreate = item.href.endsWith("/create");
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "flex min-w-0 flex-col items-center justify-center gap-0.5 rounded-xl px-1 py-1.5 transition-colors",
                active ? "text-primary" : "text-secondary hover:text-primary",
                isCreate && "-mt-5 text-primary"
              )}
              aria-label={isCreate ? t(item.i18nKey) : undefined}
            >
              <span
                className={cn(
                  "material-symbols-outlined flex h-7 w-7 items-center justify-center text-[20px]",
                  active && "material-symbols-filled",
                  isCreate && "h-12 w-12 rounded-full border-4 border-surface bg-primary text-[28px] text-on-primary shadow-soft"
                )}
                aria-hidden="true"
              >
                {isCreate ? "add" : item.icon}
              </span>
              {isCreate ? (
                <span className="sr-only">{t(item.i18nKey)}</span>
              ) : (
                <span className="max-w-full truncate text-center text-[11px] font-semibold leading-3">
                  {t(item.i18nKey)}
                </span>
              )}
              {active && !isCreate ? <span className="mt-0.5 h-[2px] w-4 rounded-full bg-primary" /> : null}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
