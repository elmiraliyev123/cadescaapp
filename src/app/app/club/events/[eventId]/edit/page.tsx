import { notFound } from "next/navigation";

import { ClubEventForm } from "@/components/events/ClubEventViews";
import { EventsRouteError } from "@/components/events/EventPrimitives";
import { canManageClubEvents } from "@/lib/events/permissions";
import { getCurrentClubDashboard } from "@/lib/server/events";

export const dynamic = "force-dynamic";

export default async function EditClubEventPage({ params }: { params: Promise<{ eventId: string }> }) {
  const { eventId } = await params;
  let dashboard;
  try {
    dashboard = await getCurrentClubDashboard(undefined, true);
  } catch (error) {
    console.error("[club_event_edit] unavailable", { reason: error instanceof Error ? error.name : "unknown" });
    return <EventsRouteError error={(error as { code?: string })?.code} />;
  }
  if (!dashboard) return <EventsRouteError error="club_not_found" />;
  if (!canManageClubEvents(dashboard.roles)) return <EventsRouteError error="club_access_denied" />;
  const event = dashboard.events.find((item) => item.id === eventId);
  if (!event) notFound();
  return <ClubEventForm workspace={{ clubId: dashboard.club.id, clubName: dashboard.club.name, roles: dashboard.roles }} event={event} />;
}
