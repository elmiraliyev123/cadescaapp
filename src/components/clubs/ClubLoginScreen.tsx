import Link from "next/link";

import { LanguageSwitcher } from "@/components/ui/LanguageSwitcher";

export function ClubLoginScreen({ authHref }: { authHref: string }) {
  return (
    <main className="flex min-h-dvh min-h-[800px] flex-col overflow-x-clip bg-[#F8F7F3] font-sans text-[#131415]">
      <header className="w-full">
        <div className="mx-auto flex w-full max-w-[1400px] items-center justify-between px-6 py-6 md:px-10 md:py-8">
          <Link href="/" className="flex h-8 w-8 items-center justify-center rounded-sm text-[#FACC15] transition-transform duration-300 hover:scale-105 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#EDC800] focus-visible:ring-offset-2" aria-label="Cadesca home">
            <span className="material-symbols-outlined text-[36px] [font-variation-settings:'FILL'_1]" aria-hidden="true">shield</span>
          </Link>
          <LanguageSwitcher variant="menu" />
        </div>
      </header>

      <div className="mx-auto flex w-full flex-1 items-center justify-center p-4 sm:p-8">
        <section className="flex w-full max-w-[640px] flex-col items-center rounded-[12px] border border-gray-200/60 bg-white p-10 text-center shadow-[0_4px_24px_-4px_rgba(0,0,0,0.03),0_2px_8px_-2px_rgba(0,0,0,0.02)] md:px-16 md:py-14">
          <div className="mb-3 flex h-28 w-28 items-center justify-center" aria-hidden="true">
            <img
              src="/student-club-people.jpg"
              alt=""
              width={612}
              height={612}
              className="h-full w-full rounded-full object-contain"
            />
          </div>

          <h1 className="mb-4 text-3xl font-bold leading-tight tracking-tight text-[#131415] md:text-[34px]">
            Student Club Portal
          </h1>
          <p className="mb-8 max-w-[420px] text-[15px] leading-relaxed text-gray-500">
            Apply for a new student club or manage an existing club with your Cadesca account.
          </p>

          <Link
            href={authHref}
            className="group flex min-h-[60px] w-full max-w-[340px] items-center gap-3 rounded-[10px] border border-[#111] bg-[#111] px-4 py-2.5 text-left text-white transition-[transform,box-shadow,background-color] duration-150 hover:-translate-y-px hover:shadow-[0_4px_0_rgba(0,0,0,0.13)] active:translate-y-px active:bg-[#252525] active:shadow-none focus-visible:outline-2 focus-visible:outline-[#EDC800] focus-visible:outline-offset-[3px]"
            aria-label="Log in with Cadesca ID"
          >
            <span className="flex shrink-0 items-center border-r border-white/30 pr-3" aria-hidden="true">
              <img
                src="/cadesca-logo.png"
                alt=""
                width={1290}
                height={520}
                className="h-[27px] w-[55px] object-contain brightness-0 invert"
              />
            </span>
            <span className="flex min-w-0 flex-1 flex-col gap-0.5">
              <strong className="text-sm font-semibold leading-[16.8px]">Log in with Cadesca ID</strong>
              <small className="text-[11px] font-normal leading-[13.2px] text-white/[0.67]">Use your Cadesca account to continue</small>
            </span>
            <svg className="h-[17px] w-[17px] shrink-0" viewBox="0 0 16 16" fill="none" aria-hidden="true">
              <path d="M3 8h9M8.5 4.5 12 8l-3.5 3.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </Link>
          <p className="mt-6 flex items-center justify-center gap-1.5 text-[13px] font-medium text-gray-500">
            <span className="material-symbols-outlined text-[16px] text-gray-400" aria-hidden="true">shield</span>
            Secure authentication via Cadesca
          </p>
        </section>
      </div>

      <footer className="mt-auto px-5 py-8 text-center text-[13px] text-gray-400">
        <p className="mb-1.5 font-medium text-gray-500">One account for all Cadesca services</p>
        <p>© Cadesca</p>
      </footer>
    </main>
  );
}
