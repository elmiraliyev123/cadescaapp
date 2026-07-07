import { Logo } from "@/components/ui/Logo";

export function MobileTopBar() {
  return (
    <header className="fixed left-0 right-0 top-0 z-50 flex h-14 items-center justify-center border-b border-outline-variant/70 bg-surface px-margin-mobile pt-[env(safe-area-inset-top)] md:hidden">
      <Logo maxWidth={130} imgClassName="h-auto w-[120px] object-contain" />
    </header>
  );
}
