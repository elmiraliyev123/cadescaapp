import { notFound } from "next/navigation";

import { ClubEventManageView } from "@/components/events/ClubEventViews";
import { EventsRouteError } from "@/components/events/EventPrimitives";
import { canManageClubEvents } from "@/lib/events/permissions";
import { getClubEventOperations, getCurrentClubDashboard } from "@/lib/server/events";

export const dynamic = "force-dynamic";

export default async function ClubEventPage({ params }: { params: Promise<{ eventId: string }> }) {
  const { eventId } = await params;
  let dashboard;
  try {
    dashboard = await getCurrentClubDashboard();
  } catch (error) {
    console.error("[club_event] unavailable", { reason: error instanceof Error ? error.name : "unknown" });
    return <EventsRouteError error={(error as { code?: string })?.code} />;
  }
  if (!dashboard) return <EventsRouteError error="club_not_found" />;
  if (!canManageClubEvents(dashboard.roles)) return <EventsRouteError error="club_access_denied" />;
  const event = dashboard.events.find((item) => item.id === eventId);
  if (!event) notFound();
  try {
    const operations = await getClubEventOperations(eventId);
    return <ClubEventManageView workspace={{ clubId: dashboard.club.id, clubName: dashboard.club.name, roles: dashboard.roles }} event={event} operations={operations} />;
  } catch (error) {
    console.error("[club_event_operations] unavailable", { reason: error instanceof Error ? error.name : "unknown" });
    return <EventsRouteError error={(error as { code?: string })?.code} />;
  }
}
