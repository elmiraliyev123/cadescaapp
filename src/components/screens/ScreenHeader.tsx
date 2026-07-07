import { Badge } from "@/components/ui/Badge";

export function ScreenHeader({
  title,
  description,
  pill,
  action
}: {
  title: string;
  description: string;
  pill?: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="mb-4 flex flex-col gap-3 border-b border-outline-variant/20 pb-4 md:mb-5 md:flex-row md:items-end md:justify-between">
      <div className="max-w-3xl">
        <div className="flex flex-wrap items-center gap-2">
          <h1 className="text-[24px] font-semibold leading-8 tracking-[-0.01em] text-primary md:text-headline-lg">{title}</h1>
          {pill ? <Badge tone="muted">{pill}</Badge> : null}
        </div>
        <p className="mt-1 max-w-2xl text-body-md text-secondary">{description}</p>
      </div>
      {action ? <div className="shrink-0">{action}</div> : null}
    </div>
  );
}
