import { EventsRouteError } from "@/components/events/EventPrimitives";
import { hasClubCapability } from "@/lib/clubs/permissions";
import { getClubManagerAnalytics } from "@/lib/server/studentClubManager";

export const dynamic = "force-dynamic";

function PercentBar({ value, max }: { value: number; max: number }) {
  const percent = max > 0 ? Math.min(100, Math.max(0, value / max * 100)) : 0;
  return <div className="h-2 overflow-hidden rounded-full bg-black/10"><div className="h-full rounded-full bg-[#FFD84D]" style={{ width: `${percent}%` }} /></div>;
}

export default async function ManagedClubAnalyticsPage({ params }: { params: Promise<{ clubSlug: string }> }) {
  const { clubSlug } = await params;
  const analytics = await getClubManagerAnalytics(clubSlug);
  if (!hasClubCapability(analytics.dashboard.roles, "club.analytics.view")) return <EventsRouteError error="club_access_denied" />;
  const maxDay = Math.max(1, ...analytics.registrationTrend.map((day) => day.count));
  return <><header className="border-b border-black/15 pb-6"><p className="text-xs font-bold uppercase tracking-[0.15em] text-black/45">Performance</p><h1 className="mt-2 text-4xl font-semibold tracking-[-0.045em]">Analytics</h1><p className="mt-2 text-sm text-black/55">Actionable registration, attendance and content signals.</p></header><section className="mt-6 rounded-2xl border border-black/10 bg-white p-5 sm:p-6"><h2 className="text-xl font-semibold">Registrations · last 30 days</h2>{analytics.registrationTrend.length ? <div className="mt-6 flex h-44 items-end gap-1.5" aria-label="Daily registrations chart">{analytics.registrationTrend.map((day) => <div key={day.day} className="group flex min-w-0 flex-1 flex-col items-center justify-end"><span className="mb-1 text-[9px] font-bold opacity-0 group-hover:opacity-100">{day.count}</span><div className="w-full min-w-1 rounded-t bg-[#FFD84D]" style={{ height: `${Math.max(4, day.count / maxDay * 130)}px` }} title={`${day.day}: ${day.count}`} /></div>)}</div> : <p className="mt-5 rounded-xl bg-[#F7F5EF] p-5 text-sm text-black/50">No registrations in the last 30 days.</p>}</section><div className="mt-6 grid gap-6 xl:grid-cols-2"><section className="rounded-2xl border border-black/10 bg-white p-5 sm:p-6"><h2 className="text-xl font-semibold">Event performance</h2><div className="mt-5 space-y-5">{analytics.eventPerformance.map((event) => <article key={event.id}><div className="flex items-end justify-between gap-3"><p className="line-clamp-1 text-sm font-semibold">{event.title}</p><p className="shrink-0 text-xs font-bold">{event.registrations}/{event.capacity}</p></div><div className="mt-2"><PercentBar value={event.registrations} max={event.capacity} /></div><p className="mt-1 text-[11px] text-black/45">{event.attendance} checked in</p></article>)}</div></section><section className="rounded-2xl border border-black/10 bg-white p-5 sm:p-6"><h2 className="text-xl font-semibold">Content engagement</h2>{analytics.postPerformance.length ? <div className="mt-4 divide-y divide-black/10">{analytics.postPerformance.map((post) => <article key={post.id} className="py-4"><p className="line-clamp-1 text-sm font-semibold">{post.label}</p><p className="mt-2 text-xs text-black/50">{post.likes} likes · {post.comments} comments</p></article>)}</div> : <p className="mt-5 rounded-xl bg-[#F7F5EF] p-5 text-sm text-black/50">No published content engagement yet.</p>}</section></div></>;
}
