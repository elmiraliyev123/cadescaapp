import { cn } from "@/lib/utils";

export function StatCard({ label, value, detail, icon, className }: { label: string; value: string; detail?: string; icon?: string; className?: string }) {
  return (
    <div className={cn("premium-card p-4 md:p-5", className)}>
      <div className="flex items-start justify-between gap-4">
        <span className="text-caption font-semibold uppercase tracking-[0.08em] text-secondary">{label}</span>
        {icon ? <span className="material-symbols-outlined text-[20px] text-secondary" aria-hidden="true">{icon}</span> : null}
      </div>
      <div className="mt-4 text-[28px] font-bold leading-none tracking-[-0.02em] text-primary md:text-[30px]">{value}</div>
      {detail ? <p className="mt-2 text-caption font-medium text-secondary">{detail}</p> : null}
    </div>
  );
}
