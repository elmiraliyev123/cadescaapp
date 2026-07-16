import { Logo } from "@/components/ui/Logo";

export function MobileTopBar() {
  return (
    <header className="fixed left-0 right-0 top-0 z-50 flex h-[calc(52px+env(safe-area-inset-top))] items-end justify-center border-b border-outline-variant/25 bg-surface/95 px-4 pb-2.5 pt-[env(safe-area-inset-top)] backdrop-blur md:hidden">
      <Logo maxWidth={116} imgClassName="h-auto w-[108px] object-contain" />
    </header>
  );
}
