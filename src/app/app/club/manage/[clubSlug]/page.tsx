import Link from "next/link";

import { hasClubCapability } from "@/lib/clubs/permissions";
import { getClubManagerOverview } from "@/lib/server/studentClubManager";

export const dynamic = "force-dynamic";

function formatDate(value: string) {
  return new Intl.DateTimeFormat("en", { dateStyle: "medium", timeStyle: "short" }).format(new Date(value));
}

function Metric({ label, value, icon }: { label: string; value: string | number; icon: string }) {
  return <div className="rounded-2xl border border-black/10 bg-white p-5"><div className="flex items-center justify-between gap-3"><p className="text-xs font-bold uppercase tracking-[0.08em] text-black/45">{label}</p><span className="material-symbols-outlined text-xl" aria-hidden="true">{icon}</span></div><p className="mt-4 text-3xl font-semibold tracking-[-0.035em]">{value}</p></div>;
}

export default async function ClubManagerOverviewPage({ params }: { params: Promise<{ clubSlug: string }> }) {
  const { clubSlug } = await params;
  const overview = await getClubManagerOverview(clubSlug);
  const { dashboard } = overview;
  const canCreateEvent = hasClubCapability(dashboard.roles, "club.events.create");
  const canCreatePost = hasClubCapability(dashboard.roles, "club.posts.create");
  const base = `/dashboard/${dashboard.club.slug}`;

  return <>
    <header className="flex flex-col gap-5 border-b border-black/15 pb-6 sm:flex-row sm:items-end sm:justify-between">
      <div><p className="text-xs font-bold uppercase tracking-[0.15em] text-black/45">Overview</p><h1 className="mt-2 break-words text-[clamp(2rem,6vw,3.5rem)] font-semibold leading-none tracking-[-0.05em]">{dashboard.club.name}</h1><p className="mt-3 text-sm text-black/55">What is happening, what is next, and what needs attention.</p></div>
      <div className="flex flex-wrap gap-2">{canCreatePost ? <Link href={`${base}/posts/new`} className="inline-flex min-h-11 items-center gap-2 rounded-xl border border-black bg-white px-4 text-sm font-bold"><span className="material-symbols-outlined text-[19px]" aria-hidden="true">post_add</span>Create post</Link> : null}{canCreateEvent ? <Link href={`${base}/events/new`} className="inline-flex min-h-11 items-center gap-2 rounded-xl border border-black bg-[#FFD84D] px-4 text-sm font-bold"><span className="material-symbols-outlined text-[19px]" aria-hidden="true">add</span>Create event</Link> : null}</div>
    </header>

    <section aria-label="Club summary" className="mt-6 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
      <Metric label="Upcoming events" value={dashboard.events.filter((event) => new Date(event.startAt) >= new Date() && !["cancelled", "archived"].includes(event.status)).length} icon="event" />
      <Metric label="Published posts" value={overview.publishedPostCount} icon="post_add" />
      <Metric label="Registrations" value={dashboard.analytics.totalRequests} icon="confirmation_number" />
      <Metric label="Check-ins" value={dashboard.analytics.checkedInAttendees} icon="how_to_reg" />
    </section>

    <div className="mt-6 grid gap-6 xl:grid-cols-[minmax(0,1.35fr)_minmax(300px,0.65fr)]">
      <div className="space-y-6">
        <section className="rounded-2xl border border-black/10 bg-white p-5 sm:p-6">
          <div className="flex items-center justify-between gap-4"><h2 className="text-xl font-semibold tracking-[-0.02em]">Upcoming event</h2><Link href={`${base}/events`} className="text-sm font-bold hover:underline">View events</Link></div>
          {overview.upcomingEvent ? <article className="mt-5 grid gap-5 rounded-2xl bg-[#FFF8D8] p-5 sm:grid-cols-[1fr_auto] sm:items-end"><div><span className="inline-flex rounded-full border border-black/20 bg-white px-2.5 py-1 text-[10px] font-bold uppercase">{overview.upcomingEvent.status.replaceAll("_", " ")}</span><h3 className="mt-3 text-2xl font-semibold tracking-[-0.025em]">{overview.upcomingEvent.title}</h3><p className="mt-3 text-sm leading-6 text-black/55">{formatDate(overview.upcomingEvent.startAt)} · {overview.upcomingEvent.location}</p><p className="mt-2 text-sm font-semibold">{overview.upcomingEvent.approvedCount} registered · {overview.upcomingEvent.capacity} capacity</p></div><Link href={`${base}/events/${overview.upcomingEvent.id}`} className="inline-flex min-h-11 items-center justify-center rounded-xl bg-black px-4 text-sm font-bold text-white">Manage event</Link></article> : <div className="mt-5 rounded-2xl border border-dashed border-black/25 px-5 py-8 text-center"><p className="font-semibold">No upcoming events</p>{canCreateEvent ? <Link href={`${base}/events/new`} className="mt-4 inline-flex min-h-11 items-center rounded-xl bg-[#FFD84D] px-4 text-sm font-bold">Create event</Link> : null}</div>}
        </section>

        <section className="rounded-2xl border border-black/10 bg-white p-5 sm:p-6"><div className="flex items-center justify-between gap-4"><h2 className="text-xl font-semibold tracking-[-0.02em]">Recent posts</h2><Link href={`${base}/posts`} className="text-sm font-bold hover:underline">Manage posts</Link></div>{overview.recentPosts.length ? <div className="mt-4 divide-y divide-black/10">{overview.recentPosts.map((post) => <article key={post.id} className="py-4"><div className="flex items-start justify-between gap-3"><p className="line-clamp-2 text-sm leading-6">{post.body || "Media post"}</p><span className="shrink-0 rounded-full bg-black/5 px-2 py-1 text-[10px] font-bold uppercase">{post.status}</span></div><time dateTime={post.createdAt} className="mt-2 block text-xs text-black/40">{formatDate(post.createdAt)}</time></article>)}</div> : <div className="mt-5 rounded-xl bg-[#F7F5EF] p-6 text-center text-sm font-semibold">No posts yet</div>}</section>
      </div>

      <div className="space-y-6">
        <section className="rounded-2xl border border-black/10 bg-white p-5"><h2 className="text-lg font-semibold">Attention required</h2>{overview.attention.length ? <div className="mt-4 space-y-3">{overview.attention.map((item) => <Link key={item.id} href={item.href} className="block rounded-xl border border-black/10 bg-[#FFF8D8] p-4 hover:border-black"><p className="text-sm font-bold">{item.title}</p><p className="mt-1 text-xs leading-5 text-black/55">{item.body}</p></Link>)}</div> : <p className="mt-4 rounded-xl bg-[#F7F5EF] p-4 text-sm text-black/55">Nothing needs immediate attention.</p>}</section>
        <section className="rounded-2xl border border-black/10 bg-white p-5"><h2 className="text-lg font-semibold">Recent activity</h2>{overview.activity.length ? <ol className="mt-4 space-y-4">{overview.activity.map((entry) => <li key={entry.id} className="border-l-2 border-[#FFD84D] pl-3"><p className="text-sm font-semibold">{entry.actorName || "Cadesca"} {entry.action.replaceAll("_", " ")}</p><time dateTime={entry.createdAt} className="mt-1 block text-xs text-black/40">{formatDate(entry.createdAt)}</time></li>)}</ol> : <p className="mt-4 text-sm text-black/50">Activity will appear here as your team works.</p>}</section>
      </div>
    </div>
  </>;
}
