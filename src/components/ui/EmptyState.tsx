import { cn } from "@/lib/utils";

export function EmptyState({
  text,
  icon,
  action,
  className
}: {
  text: string;
  icon?: string;
  action?: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("flex flex-col items-center justify-center rounded-xl border border-outline-variant/70 bg-surface-container-lowest px-6 py-10 text-center", className)}>
      {icon ? (
        <span className="material-symbols-outlined mb-3 text-[32px] text-secondary" aria-hidden="true">{icon}</span>
      ) : null}
      <p className="max-w-sm text-label-md font-semibold text-secondary">{text}</p>
      {action ? <div className="mt-4">{action}</div> : null}
    </div>
  );
}
