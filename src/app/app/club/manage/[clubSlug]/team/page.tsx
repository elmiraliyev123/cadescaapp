import { ClubMembersView } from "@/components/events/ClubEventViews";
import { EventsRouteError } from "@/components/events/EventPrimitives";
import { hasClubCapability } from "@/lib/clubs/permissions";
import { getCurrentClubDashboardBySlug } from "@/lib/server/events";

export const dynamic = "force-dynamic";

export default async function ManagedClubTeamPage({ params }: { params: Promise<{ clubSlug: string }> }) {
  const { clubSlug } = await params;
  const dashboard = await getCurrentClubDashboardBySlug(clubSlug);
  if (!dashboard || !hasClubCapability(dashboard.roles, "club.members.view")) return <EventsRouteError error="club_access_denied" />;
  return <ClubMembersView dashboard={dashboard} hideNavigation />;
}
