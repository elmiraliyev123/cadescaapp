import Image from "next/image";
import Link from "next/link";

import { EventStatusPill } from "@/components/events/EventPrimitives";
import { hasClubCapability } from "@/lib/clubs/permissions";
import { getCurrentClubDashboardBySlug } from "@/lib/server/events";

export const dynamic = "force-dynamic";

const FILTERS = ["all", "draft", "published", "upcoming", "past", "suspended"] as const;
type Filter = (typeof FILTERS)[number];

function formatDate(value: string) {
  return new Intl.DateTimeFormat("en", { dateStyle: "medium", timeStyle: "short" }).format(new Date(value));
}

export default async function ManagedClubEventsPage({ params, searchParams }: { params: Promise<{ clubSlug: string }>; searchParams: Promise<{ status?: string }> }) {
  const [{ clubSlug }, search] = await Promise.all([params, searchParams]);
  const dashboard = await getCurrentClubDashboardBySlug(clubSlug);
  if (!dashboard) return null;
  const base = `/dashboard/${dashboard.club.slug}`;
  const selected: Filter = FILTERS.includes(search.status as Filter) ? search.status as Filter : "all";
  const now = Date.now();
  const events = dashboard.events.filter((event) => {
    if (selected === "all") return true;
    if (selected === "upcoming") return new Date(event.startAt).getTime() >= now && !["cancelled", "archived", "completed"].includes(event.status) && event.moderationStatus !== "platform_suspended";
    if (selected === "past") return new Date(event.endAt).getTime() < now || event.status === "completed";
    if (selected === "suspended") return event.moderationStatus === "platform_suspended";
    if (selected === "published") return event.status === "published" || event.status === "sold_out";
    return event.status === selected;
  });
  const canCreate = hasClubCapability(dashboard.roles, "club.events.create");

  return <>
    <header className="flex flex-col gap-4 border-b border-black/15 pb-6 sm:flex-row sm:items-end sm:justify-between"><div><p className="text-xs font-bold uppercase tracking-[0.15em] text-black/45">Management</p><h1 className="mt-2 text-4xl font-semibold tracking-[-0.045em]">Events</h1><p className="mt-2 text-sm text-black/55">Create, publish and operate events from one canonical Cadesca record.</p></div>{canCreate ? <Link href={`${base}/events/new`} className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border border-black bg-[#FFD84D] px-4 text-sm font-bold"><span className="material-symbols-outlined text-[19px]" aria-hidden="true">add</span>Create event</Link> : null}</header>
    <nav aria-label="Event filters" className="mt-5 overflow-x-auto pb-1"><div className="flex min-w-max gap-2">{FILTERS.map((filter) => <Link key={filter} href={filter === "all" ? `${base}/events` : `${base}/events?status=${filter}`} aria-current={selected === filter ? "page" : undefined} className={`inline-flex min-h-10 items-center rounded-full border px-3.5 text-xs font-bold capitalize ${selected === filter ? "border-black bg-black text-white" : "border-black/15 bg-white"}`}>{filter}</Link>)}</div></nav>
    {events.length ? <section className="mt-5 space-y-3">{events.map((event) => <article key={event.id} className="grid min-w-0 gap-4 rounded-2xl border border-black/10 bg-white p-4 sm:grid-cols-[120px_minmax(0,1fr)_auto] sm:items-center">
      <Link href={`${base}/events/${event.id}`} className="relative aspect-[16/9] overflow-hidden rounded-xl bg-[#FFF3B8] sm:aspect-[4/3]">{event.coverImageUrl ? <Image src={event.coverImageUrl} alt="" fill sizes="(max-width: 640px) 100vw, 120px" className="object-cover" /> : <span className="material-symbols-outlined flex h-full items-center justify-center text-3xl" aria-hidden="true">event</span>}</Link>
      <div className="min-w-0"><div className="flex flex-wrap items-center gap-2"><EventStatusPill status={event.moderationStatus === "platform_suspended" ? "suspended" : event.status} /><span className="text-[10px] font-bold uppercase tracking-[0.08em] text-black/40">{event.visibility || "university"}</span></div><h2 className="mt-2 break-words text-xl font-semibold tracking-[-0.02em]"><Link href={`${base}/events/${event.id}`} className="hover:underline">{event.title}</Link></h2><p className="mt-2 text-sm leading-5 text-black/50">{formatDate(event.startAt)} · {event.location}</p><p className="mt-2 text-xs font-semibold text-black/60">{event.approvedCount} registrations · {event.capacity} capacity</p></div>
      <div className="flex items-center gap-2 sm:flex-col sm:items-stretch"><Link href={`${base}/events/${event.id}`} className="inline-flex min-h-10 flex-1 items-center justify-center rounded-xl bg-black px-3 text-xs font-bold text-white">Manage</Link>{hasClubCapability(dashboard.roles, "club.events.update") ? <Link href={`${base}/events/${event.id}/edit`} className="inline-flex min-h-10 flex-1 items-center justify-center rounded-xl border border-black px-3 text-xs font-bold">Edit</Link> : null}</div>
    </article>)}</section> : <section className="mt-6 rounded-2xl border border-dashed border-black/25 bg-white px-5 py-10 text-center"><span className="material-symbols-outlined text-4xl" aria-hidden="true">event_busy</span><h2 className="mt-3 text-xl font-semibold">No {selected === "all" ? "events yet" : `${selected} events`}</h2><p className="mt-2 text-sm text-black/50">{selected === "all" ? "Create your first event and publish it across Cadesca." : "Try another filter."}</p>{canCreate && selected === "all" ? <Link href={`${base}/events/new`} className="mt-5 inline-flex min-h-11 items-center rounded-xl bg-[#FFD84D] px-4 text-sm font-bold">Create event</Link> : null}</section>}
  </>;
}
