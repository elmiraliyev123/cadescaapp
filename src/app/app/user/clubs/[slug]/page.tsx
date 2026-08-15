import Link from "next/link";
import { notFound } from "next/navigation";

import { getDiscoverableClubProfile } from "@/lib/server/clubDiscovery";

export const dynamic = "force-dynamic";

export default async function ClubProfilePage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const club = await getDiscoverableClubProfile(slug);
  if (!club) notFound();

  return (
    <main className="mx-auto w-full max-w-3xl px-4 pb-10 sm:px-6">
      <header className="rounded-[24px] border-2 border-black bg-[#fffaf0] p-5 shadow-[5px_5px_0_#ffd400] sm:p-7">
        <div className="flex items-start gap-4">
          {club.logoUrl ? <img src={club.logoUrl} alt={`${club.name} logo`} className="h-20 w-20 shrink-0 rounded-2xl border-2 border-black object-cover" /> : <div className="flex h-20 w-20 shrink-0 items-center justify-center rounded-2xl border-2 border-black bg-[#ffd400]"><span className="material-symbols-outlined text-4xl" aria-hidden="true">groups</span></div>}
          <div className="min-w-0">
            <p className="text-[11px] font-black uppercase tracking-[0.14em] text-black/55">{club.universityName}</p>
            <div className="mt-1 flex min-w-0 flex-wrap items-center gap-2">
              <h1 className="break-words text-[clamp(28px,7vw,42px)] font-black leading-none tracking-[-0.04em]">{club.name}</h1>
              <span className="material-symbols-outlined text-[22px]" aria-label="Official approved club">verified</span>
            </div>
          </div>
        </div>
        <p className="mt-5 whitespace-pre-wrap text-[15px] leading-6 text-black/70">{club.description}</p>
        <div className="mt-5 flex flex-wrap gap-2">
          {club.websiteUrl ? <a href={club.websiteUrl} target="_blank" rel="noreferrer" className="inline-flex min-h-11 items-center rounded-xl border border-black bg-white px-4 text-[13px] font-bold focus-visible:ring-2 focus-visible:ring-black">Website</a> : null}
          {club.instagramUrl ? <a href={club.instagramUrl} target="_blank" rel="noreferrer" className="inline-flex min-h-11 items-center rounded-xl border border-black bg-white px-4 text-[13px] font-bold focus-visible:ring-2 focus-visible:ring-black">Instagram</a> : null}
        </div>
      </header>

      <section className="mt-8">
        <div className="mb-4 flex items-end justify-between gap-3"><h2 className="text-[24px] font-black">Upcoming events</h2><Link href="/app/user/events" className="text-[13px] font-black underline">All events</Link></div>
        {club.events.length ? <div className="grid gap-3 sm:grid-cols-2">{club.events.map((event) => <Link key={event.id} href={`/app/user/events/${encodeURIComponent(event.slug)}`} className="rounded-2xl border-2 border-black bg-white p-4 transition-transform hover:-translate-y-0.5 focus-visible:ring-2 focus-visible:ring-[#ffd400]"><p className="text-[11px] font-black uppercase tracking-[0.08em] text-black/55">{new Intl.DateTimeFormat("en", { dateStyle: "medium", timeStyle: "short" }).format(new Date(event.startsAt))}</p><h3 className="mt-1 break-words text-[18px] font-black">{event.title}</h3><p className="mt-2 break-words text-[13px] text-black/60">{event.location}</p></Link>)}</div> : <div className="rounded-2xl border-2 border-dashed border-black bg-white p-6 text-center text-[14px] font-bold">No upcoming events.</div>}
      </section>

      <section className="mt-8">
        <h2 className="mb-4 text-[24px] font-black">Latest posts</h2>
        {club.posts.length ? <div className="space-y-3">{club.posts.map((post) => <article key={post.id} className="rounded-2xl border border-black/20 bg-white p-4"><p className="whitespace-pre-wrap break-words text-[14px] leading-6">{post.body}</p>{post.hasImage ? <img src={`/media/post/${encodeURIComponent(post.id)}`} alt="Club post attachment" loading="lazy" className="mt-3 max-h-96 w-full rounded-xl object-cover" /> : null}<div className="mt-3 flex items-center justify-between gap-3"><time className="text-[11px] font-bold text-black/45" dateTime={post.createdAt}>{new Intl.DateTimeFormat("en", { dateStyle: "medium" }).format(new Date(post.createdAt))}</time><Link href={`/post/${encodeURIComponent(post.id)}`} className="text-[12px] font-black underline">Open post</Link></div></article>)}</div> : <div className="rounded-2xl border-2 border-dashed border-black bg-white p-6 text-center text-[14px] font-bold">No club posts yet.</div>}
      </section>
    </main>
  );
}
