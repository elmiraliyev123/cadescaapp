import { Logo } from "@/components/ui/Logo";

export function ScreenHeader({
  title,
  description,
  action
}: {
  title: string;
  description: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="mb-5 flex flex-col gap-4 border-b border-outline-variant/70 pb-5 md:mb-6 md:flex-row md:items-end md:justify-between">
      <div className="max-w-3xl">
        <h1 className="text-[28px] font-semibold leading-9 tracking-[-0.01em] text-primary md:text-headline-lg">{title}</h1>
        <p className="mt-2 max-w-2xl text-body-md text-secondary">{description}</p>
      </div>
      {action ? <div className="shrink-0">{action}</div> : null}
    </div>
  );
}
