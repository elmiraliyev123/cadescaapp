import { ClubEventForm } from "@/components/events/ClubEventViews";
import { EventsRouteError } from "@/components/events/EventPrimitives";
import { hasClubCapability } from "@/lib/clubs/permissions";
import { getCurrentClubDashboardBySlug } from "@/lib/server/events";

export const dynamic = "force-dynamic";

export default async function ManagedClubNewEventPage({ params }: { params: Promise<{ clubSlug: string }> }) {
  const { clubSlug } = await params;
  const dashboard = await getCurrentClubDashboardBySlug(clubSlug, true);
  if (!dashboard || !hasClubCapability(dashboard.roles, "club.events.create")) return <EventsRouteError error="club_access_denied" />;
  const base = `/dashboard/${dashboard.club.slug}`;
  return <ClubEventForm workspace={{ clubId: dashboard.club.id, clubName: dashboard.club.name, roles: dashboard.roles }} basePath={base} hideNavigation />;
}
