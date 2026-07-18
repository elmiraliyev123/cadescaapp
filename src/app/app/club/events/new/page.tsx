import { ClubEventForm } from "@/components/events/ClubEventViews";
import { EventsRouteError } from "@/components/events/EventPrimitives";
import { canManageClubEvents } from "@/lib/events/permissions";
import { getCurrentClubDashboard } from "@/lib/server/events";

export const dynamic = "force-dynamic";

export default async function NewClubEventPage() {
  try {
    const dashboard = await getCurrentClubDashboard();
    if (!dashboard) return <EventsRouteError error="club_not_found" />;
    if (!canManageClubEvents(dashboard.roles)) return <EventsRouteError error="club_access_denied" />;
    return <ClubEventForm workspace={{ clubId: dashboard.club.id, clubName: dashboard.club.name, roles: dashboard.roles }} />;
  } catch (error) {
    console.error("[club_event_new] unavailable", { reason: error instanceof Error ? error.name : "unknown" });
    return <EventsRouteError error={(error as { code?: string })?.code} />;
  }
}
