import { ClubPostEditor } from "@/components/clubs/ClubPostEditor";
import { EventsRouteError } from "@/components/events/EventPrimitives";
import { hasClubCapability } from "@/lib/clubs/permissions";
import { getCurrentClubDashboardBySlug } from "@/lib/server/events";

export const dynamic = "force-dynamic";

export default async function ManagedClubNewPostPage({ params }: { params: Promise<{ clubSlug: string }> }) {
  const { clubSlug } = await params;
  const dashboard = await getCurrentClubDashboardBySlug(clubSlug);
  if (!dashboard || !hasClubCapability(dashboard.roles, "club.posts.create")) return <EventsRouteError error="club_access_denied" />;
  return <ClubPostEditor clubId={dashboard.club.id} clubName={dashboard.club.name} events={dashboard.events.map(({ id, title }) => ({ id, title }))} />;
}
