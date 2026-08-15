import Link from "next/link";

import { EventsFrame, EventsHeader } from "@/components/events/EventPrimitives";
import { listCurrentManagedClubs } from "@/lib/server/studentClubs";

export const dynamic = "force-dynamic";

export default async function ManagedClubsPage() {
  const clubs = await listCurrentManagedClubs();
  return (
    <EventsFrame>
      <EventsHeader title="Manage clubs" description="Choose the approved club workspace you want to open." />
      {clubs.length ? <div className="grid gap-4 sm:grid-cols-2">{clubs.map((club) => (
        <Link key={club.id} href={`/clubs/${encodeURIComponent(club.id)}`} className="flex min-h-28 items-center gap-4 rounded-2xl border-2 border-black bg-white p-4 shadow-[4px_4px_0_#ffd400] transition-transform hover:-translate-y-0.5 focus-visible:ring-2 focus-visible:ring-black">
          {club.logoUrl ? <img src={club.logoUrl} alt="" className="h-16 w-16 shrink-0 rounded-xl border border-black object-cover" /> : <span className="material-symbols-outlined flex h-16 w-16 shrink-0 items-center justify-center rounded-xl border border-black bg-[#ffd400] text-3xl" aria-hidden="true">groups</span>}
          <span className="min-w-0"><span className="block break-words text-[19px] font-black">{club.name}</span><span className="mt-1 block text-[12px] font-bold text-black/55">{club.universityName}</span><span className="mt-2 block text-[11px] font-bold uppercase tracking-[0.06em] text-black/45">{club.roles.join(" · ").replaceAll("_", " ")}</span></span>
        </Link>
      ))}</div> : <div className="rounded-2xl border-2 border-dashed border-black bg-white p-8 text-center text-[14px] font-bold">No approved club workspaces are available.</div>}
    </EventsFrame>
  );
}
