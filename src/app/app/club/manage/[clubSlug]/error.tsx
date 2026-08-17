"use client";

export default function ManagedClubError({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return <section className="rounded-2xl border border-black/10 bg-white p-8 text-center"><span className="material-symbols-outlined text-4xl" aria-hidden="true">error</span><h1 className="mt-3 text-2xl font-bold">The club workspace could not load</h1><p className="mt-2 text-sm text-black/55">Try again. If the problem continues, your session or club access may have changed.</p><button type="button" onClick={reset} className="mt-5 min-h-11 rounded-xl bg-black px-5 text-sm font-bold text-white">Try again</button></section>;
}
