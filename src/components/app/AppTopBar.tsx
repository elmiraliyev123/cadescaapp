import Link from "next/link";

import { Logo } from "@/components/ui/Logo";
import { cn } from "@/lib/utils";

export function AppTopBar({
  variant = "student",
  className
}: {
  variant?: "student" | "public";
  className?: string;
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
          "mx-auto flex w-full items-center justify-center px-4",
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
      </div>
    </header>
  );
}
