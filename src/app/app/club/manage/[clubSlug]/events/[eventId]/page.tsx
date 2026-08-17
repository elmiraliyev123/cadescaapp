import Link from "next/link";
import { notFound } from "next/navigation";

import { ClubEventManageView } from "@/components/events/ClubEventViews";
import { EventMetric, EventStatusPill } from "@/components/events/EventPrimitives";
import { hasClubCapability } from "@/lib/clubs/permissions";
import { getClubEventOperations, getCurrentClubDashboardBySlug } from "@/lib/server/events";

export const dynamic = "force-dynamic";

export default async function ManagedClubEventPage({ params }: { params: Promise<{ clubSlug: string; eventId: string }> }) {
  const { clubSlug, eventId } = await params;
  const dashboard = await getCurrentClubDashboardBySlug(clubSlug);
  if (!dashboard) return null;
  const event = dashboard.events.find((candidate) => candidate.id === eventId);
  if (!event) notFound();
  const base = `/dashboard/${dashboard.club.slug}`;
  if (!hasClubCapability(dashboard.roles, "club.events.manage_attendees")) {
    return <><header className="flex flex-col gap-4 border-b border-black/15 pb-6 sm:flex-row sm:items-end sm:justify-between"><div><div className="flex flex-wrap gap-2"><EventStatusPill status={event.status} />{event.moderationStatus === "platform_suspended" ? <EventStatusPill status="suspended" /> : null}</div><h1 className="mt-3 text-4xl font-semibold tracking-[-0.045em]">{event.title}</h1><p className="mt-2 text-sm text-black/55">{new Date(event.startAt).toLocaleString()} · {event.location}</p></div>{hasClubCapability(dashboard.roles, "club.events.update") ? <Link href={`${base}/events/${event.id}/edit`} className="inline-flex min-h-11 items-center rounded-xl border border-black bg-white px-4 text-sm font-bold">Edit event</Link> : null}</header><div className="mt-6 grid gap-4 sm:grid-cols-3"><EventMetric label="Registrations" value={event.approvedCount} icon="confirmation_number" /><EventMetric label="Capacity" value={event.capacity} icon="event_seat" /><EventMetric label="Remaining" value={event.availableSlots} icon="airline_seat_recline_normal" /></div><section className="mt-6 rounded-2xl border border-black/10 bg-white p-6"><h2 className="text-xl font-semibold">Event details</h2><p className="mt-4 whitespace-pre-wrap text-sm leading-7 text-black/60">{event.description}</p></section></>;
  }
  const operations = await getClubEventOperations(eventId);
  return <ClubEventManageView workspace={{ clubId: dashboard.club.id, clubName: dashboard.club.name, roles: dashboard.roles }} event={event} operations={operations} basePath={base} hideNavigation />;
}
