import type { ReactNode } from "react";

import { Logo } from "@/components/ui/Logo";

export function AuthShell({
  title,
  subtitle,
  children
}: {
  title: string;
  subtitle?: string;
  children: ReactNode;
}) {
  return (
    <main className="min-h-screen bg-background px-margin-mobile py-6 text-on-background md:px-gutter md:py-8">
      <div className="mx-auto flex min-h-[calc(100dvh-48px)] w-full max-w-container-max flex-col">
        <header className="flex justify-center py-3 md:justify-start">
          <Logo maxWidth={190} imgClassName="h-auto w-[170px] object-contain md:w-[190px]" />
        </header>
        <div className="grid flex-1 items-center gap-7 py-6 lg:grid-cols-[minmax(0,0.9fr)_440px] lg:gap-12">
          <section className="mx-auto w-full max-w-xl text-center lg:mx-0 lg:text-left">
            <p className="text-caption font-semibold uppercase tracking-[0.12em] text-secondary">Cadesca</p>
            <h1 className="mt-4 text-[36px] font-bold leading-[42px] text-primary md:text-[48px] md:leading-[56px]">
              Join your private university community
            </h1>
            <p className="mt-4 text-body-lg text-secondary">Connect with verified students from your campus.</p>
          </section>
          <section className="mx-auto w-full max-w-[440px] rounded-2xl border border-outline-variant/70 bg-surface-container-lowest p-5 md:p-6">
            <div className="mb-5">
              <h2 className="text-headline-md font-semibold text-primary">{title}</h2>
              {subtitle ? <p className="mt-1 text-body-md text-secondary">{subtitle}</p> : null}
            </div>
            {children}
          </section>
        </div>
      </div>
    </main>
  );
}
