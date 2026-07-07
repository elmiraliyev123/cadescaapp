import { cn } from "@/lib/utils";

type BadgeTone = "default" | "inverse" | "muted" | "success" | "warning";

const tones: Record<BadgeTone, string> = {
  default: "border-outline-variant/80 bg-surface-container-low text-primary",
  inverse: "border-primary bg-primary text-on-primary",
  muted: "border-outline-variant/80 bg-surface-container text-secondary",
  success: "border-outline-variant/80 bg-surface-container-lowest text-primary",
  warning: "border-outline-variant/80 bg-surface-container-high text-primary"
};

export function Badge({ children, tone = "default", className }: { children: React.ReactNode; tone?: BadgeTone; className?: string }) {
  return (
    <span className={cn("inline-flex h-6 items-center rounded-md border px-2 text-[11px] font-semibold leading-4 tracking-[0.01em]", tones[tone], className)}>
      {children}
    </span>
  );
}
