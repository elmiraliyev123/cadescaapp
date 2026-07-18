import Link from "next/link";

import { Logo } from "@/components/ui/Logo";
import { cn } from "@/lib/utils";

export function AppTopBar({
  variant = "student",
  className,
  eventsHref,
  eventsLabel
}: {
  variant?: "student" | "public";
  className?: string;
  eventsHref?: string;
  eventsLabel?: string;
}) {
  const isPublic = variant === "public";

  return (
    <header
      className={cn(
        "left-0 right-0 top-0 z-50 border-b border-outline-variant/25 bg-surface/95 backdrop-blur",
        isPublic
          ? "sticky flex h-[76px] items-center"
          : "fixed flex h-[calc(112px+env(safe-area-inset-top))] items-center pt-[env(safe-area-inset-top)] md:hidden",
        className
      )}
    >
      <div
        className={cn(
          "relative mx-auto flex w-full items-center justify-center px-4",
          isPublic ? "max-w-[720px] justify-start sm:px-6" : "max-w-[520px]"
        )}
      >
        <Link
          href={isPublic ? "/" : "/app/user/home"}
          aria-label="Cadesca"
          className="inline-flex shrink-0 items-center justify-center focus-visible:rounded-lg"
        >
          <Logo
            maxWidth={isPublic ? 148 : 196}
            imgClassName="block h-auto max-w-full object-contain"
          />
        </Link>
        {!isPublic && eventsHref && eventsLabel ? (
          <Link
            href={eventsHref}
            aria-label={eventsLabel}
            title={eventsLabel}
            className="absolute right-4 inline-flex h-11 w-11 items-center justify-center rounded-full border border-black bg-[#ffd400] text-black shadow-[2px_2px_0_#000] transition-transform active:translate-y-0.5 active:shadow-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-black focus-visible:ring-offset-2"
          >
            <span className="material-symbols-outlined text-[22px]" aria-hidden="true">event</span>
          </Link>
        ) : null}
      </div>
    </header>
  );
}
