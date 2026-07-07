import { Badge } from "@/components/ui/Badge";
import { cn } from "@/lib/utils";

export function BalanceCard({
  title,
  value,
  subtitle,
  icon,
  badge,
  trend,
  className
}: {
  title: string;
  value: string;
  subtitle: string;
  icon: string;
  badge?: string;
  trend?: string;
  className?: string;
}) {
  return (
    <div className={cn("premium-card p-5", className)}>
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-caption font-semibold uppercase tracking-[0.08em] text-secondary">{title}</p>
          <div className="mt-4 text-[36px] font-bold leading-none tracking-[-0.03em] text-primary md:text-[38px]">{value}</div>
        </div>
        <div className="flex h-10 w-10 items-center justify-center rounded-full border border-outline-variant/70 bg-surface-container-low">
          <span className="material-symbols-outlined text-[20px] text-primary" aria-hidden="true">{icon}</span>
        </div>
      </div>
      <div className="mt-5 flex items-end justify-between gap-3">
        <p className="text-caption font-medium text-secondary">{subtitle}</p>
        <div className="flex shrink-0 items-center gap-2">
          {trend ? <span className="text-caption font-semibold text-primary">{trend}</span> : null}
          {badge ? <Badge>{badge}</Badge> : null}
        </div>
      </div>
    </div>
  );
}
