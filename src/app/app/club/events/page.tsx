import { ClubEventsListView } from "@/components/events/ClubEventViews";
import { EventsRouteError } from "@/components/events/EventPrimitives";
import { canManageClubEvents } from "@/lib/events/permissions";
import { getCurrentClubDashboard } from "@/lib/server/events";

export const dynamic = "force-dynamic";

export default async function ClubEventsPage() {
  try {
    const dashboard = await getCurrentClubDashboard();
    if (!dashboard) return <EventsRouteError error="club_not_found" />;
    if (!canManageClubEvents(dashboard.roles)) return <EventsRouteError error="club_access_denied" />;
    return <ClubEventsListView clubName={dashboard.club.name} roles={dashboard.roles} events={dashboard.events} />;
  } catch (error) {
    console.error("[club_events] unavailable", { reason: error instanceof Error ? error.name : "unknown" });
    return <EventsRouteError error={(error as { code?: string })?.code} />;
  }
}
