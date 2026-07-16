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
    <div className={cn("flex flex-col items-center justify-center border-y border-outline-variant/30 bg-surface-container-lowest px-6 py-10 text-center", className)}>
      {icon ? (
        <span className="material-symbols-outlined icon-empty mb-3 text-secondary" aria-hidden="true">{icon}</span>
      ) : null}
      <p className="max-w-sm text-[15px] font-semibold leading-5 text-primary">{text}</p>
      {action ? <div className="mt-4">{action}</div> : null}
    </div>
  );
}
