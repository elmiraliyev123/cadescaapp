import { cn } from "@/lib/utils";

export function LoadingSkeleton({ className }: { className?: string }) {
  return <span className={cn("block animate-pulse rounded-lg bg-surface-container", className)} aria-hidden="true" />;
}
