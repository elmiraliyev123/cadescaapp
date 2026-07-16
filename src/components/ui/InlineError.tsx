import { cn } from "@/lib/utils";

export function InlineError({ message, className }: { message?: string; className?: string }) {
  if (!message) return null;

  return (
    <p className={cn("flex items-start gap-2 text-[14px] leading-5 text-error", className)} role="alert">
      <span className="material-symbols-outlined icon-inline mt-0.5" aria-hidden="true">error</span>
      <span>{message}</span>
    </p>
  );
}
