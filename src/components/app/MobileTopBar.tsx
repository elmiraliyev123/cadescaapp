import { Logo } from "@/components/ui/Logo";

export function MobileTopBar() {
  return (
    <header className="fixed left-0 right-0 top-0 z-50 flex h-[calc(56px+env(safe-area-inset-top))] items-end justify-center border-b border-outline-variant/30 bg-surface px-margin-mobile pb-3 pt-[env(safe-area-inset-top)] md:hidden">
      <Logo maxWidth={130} imgClassName="h-auto w-[120px] object-contain" />
    </header>
  );
}
