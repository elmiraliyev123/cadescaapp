"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import type { NavItem } from "@/lib/types";
import { cn } from "@/lib/utils";
import { useLanguage } from "@/lib/i18n";

export function MobileBottomNav({ navItems, currentPath }: { navItems: NavItem[]; currentPath: string }) {
  const { t } = useLanguage();
  const [unreadNotifications, setUnreadNotifications] = useState(0);

  useEffect(() => {
    const updateCount = (event?: Event) => {
      const eventCount = event instanceof CustomEvent && typeof event.detail?.count === "number" ? event.detail.count : null;
      const storedCount = Number(window.localStorage.getItem("cadesca:unread-notification-count") || "0");
      setUnreadNotifications(Math.max(0, eventCount ?? (Number.isFinite(storedCount) ? storedCount : 0)));
    };
    updateCount();
    window.addEventListener("cadesca:notification-count", updateCount);
    return () => window.removeEventListener("cadesca:notification-count", updateCount);
  }, []);
  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 border-t border-outline-variant/25 bg-surface/95 px-1 pb-[max(8px,env(safe-area-inset-bottom))] pt-1.5 backdrop-blur md:hidden">
      <div className="grid min-h-[68px] items-center" style={{ gridTemplateColumns: `repeat(${navItems.length}, minmax(0, 1fr))` }}>
        {navItems.map((item) => {
          const active = currentPath === item.href || currentPath.startsWith(`${item.href}/`);
          const isCreate = item.href.endsWith("/create");

          if (isCreate) {
            return (
              <Link
                key={item.href}
                href={item.href}
                className="flex min-h-14 min-w-0 items-center justify-center"
                aria-label={t(item.i18nKey)}
                aria-current={active ? "page" : undefined}
              >
                <span className="flex h-[60px] w-[60px] aspect-square shrink-0 items-center justify-center rounded-full bg-primary p-0 text-on-primary shadow-md transition-transform active:scale-95">
                  <span className="material-symbols-outlined icon-create leading-none" aria-hidden="true">add</span>
                </span>
              </Link>
            );
          }

          return (
            <Link
              key={item.href}
              href={item.href}
              aria-current={active ? "page" : undefined}
              className={cn(
                "flex min-h-14 min-w-0 flex-col items-center justify-center gap-0.5 rounded-lg px-0.5 py-1 transition-colors active:scale-95",
                active ? "text-primary" : "text-secondary hover:text-primary"
              )}
            >
              <span
                className={cn(
                  "material-symbols-outlined icon-nav relative flex h-7 w-7 items-center justify-center",
                  active && "material-symbols-filled"
                )}
                aria-hidden="true"
              >
                {item.icon}
                {item.href.endsWith("/activity") && unreadNotifications > 0 && !active ? (
                  <span className="absolute right-0 top-0 h-1.5 w-1.5 rounded-full bg-primary ring-2 ring-surface" aria-hidden="true" />
                ) : null}
              </span>
              <span className="max-w-full whitespace-normal text-center text-[11.5px] font-medium leading-[14px] [overflow-wrap:anywhere]">
                {t(item.i18nKey)}
              </span>
              {active ? <span className="h-0.5 w-3 rounded-full bg-primary" /> : null}
              {item.href.endsWith("/activity") && unreadNotifications > 0 ? <span className="sr-only">{t("social.unreadActivity")}</span> : null}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
