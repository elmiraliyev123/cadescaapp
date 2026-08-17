import Image from "next/image";
import Link from "next/link";
import { redirect } from "next/navigation";

import { LanguageSwitcher } from "@/components/ui/LanguageSwitcher";
import { Logo } from "@/components/ui/Logo";
import { getCurrentStudentContext } from "@/lib/server/social";
import { listCurrentManagedClubs } from "@/lib/server/studentClubs";

export const dynamic = "force-dynamic";

function roleLabel(role: string) {
  return role.replace(/^club_/, "").replaceAll("_", " ").replace(/\b\w/g, (letter) => letter.toUpperCase());
}

export default async function StudentClubSelectorPage() {
  const user = await getCurrentStudentContext();
  if (!user) redirect("/");
  const clubs = await listCurrentManagedClubs();
  if (!clubs.length) redirect("/resolve");

  return <main className="min-h-dvh bg-[#F7F5EF] text-black">
    <header className="border-b border-[#E4E1D8] bg-white">
      <div className="mx-auto flex max-w-6xl items-center justify-between px-5 py-4 sm:px-8"><Logo maxWidth={132} /><LanguageSwitcher /></div>
    </header>
    <div className="mx-auto max-w-6xl px-5 py-10 sm:px-8 sm:py-14">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div><p className="text-xs font-bold uppercase tracking-[0.16em] text-black/45">Cadesca Student Clubs</p><h1 className="mt-3 text-4xl font-semibold tracking-[-0.045em]">Your clubs</h1><p className="mt-3 text-sm leading-6 text-black/55">Choose the organization you want to manage.</p></div>
        {process.env.STUDENT_CLUB_ALLOW_MULTIPLE_APPLICATIONS === "true" ? <Link href="/application" className="inline-flex min-h-11 items-center justify-center rounded-xl border border-black bg-[#FFD84D] px-4 text-sm font-bold">Apply for another club</Link> : null}
      </div>
      <section className="mt-8 grid gap-4 md:grid-cols-2">
        {clubs.map((club) => <Link key={club.id} href={`/dashboard/${club.slug}`} className="group flex min-h-36 items-center gap-4 rounded-2xl border border-[#DAD6CB] bg-white p-5 transition-transform hover:-translate-y-0.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#FFD84D]">
          <div className="relative h-20 w-20 shrink-0 overflow-hidden rounded-2xl border border-black/10 bg-[#FFF3B8]">
            {club.logoUrl ? <Image src={club.logoUrl} alt={`${club.name} logo`} fill sizes="80px" className="object-cover" /> : <span className="material-symbols-outlined flex h-full items-center justify-center text-3xl" aria-hidden="true">groups</span>}
          </div>
          <span className="min-w-0 flex-1"><span className="block break-words text-xl font-semibold tracking-[-0.02em]">{club.name}</span><span className="mt-1 block text-sm text-black/50">{club.universityName}</span><span className="mt-3 flex flex-wrap gap-2"><span className="rounded-full bg-black px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.06em] text-white">{roleLabel(club.roles[0] || "manager")}</span><span className="rounded-full bg-[#FFF3B8] px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.06em]">{club.upcomingEventCount} upcoming</span></span></span>
          <span className="material-symbols-outlined text-xl transition-transform group-hover:translate-x-1" aria-hidden="true">arrow_forward</span>
        </Link>)}
      </section>
    </div>
  </main>;
}
