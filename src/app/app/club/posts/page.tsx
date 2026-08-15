import { ClubPostsManager } from "@/components/clubs/ClubPostsManager";
import { EventsRouteError } from "@/components/events/EventPrimitives";
import { hasClubCapability } from "@/lib/clubs/permissions";
import { listClubManagedPosts } from "@/lib/server/clubPosts";
import { getCurrentClubDashboard } from "@/lib/server/events";

export const dynamic = "force-dynamic";

export default async function ClubPostsPage({ searchParams }: { searchParams: Promise<{ clubId?: string }> }) {
  try {
    const { clubId } = await searchParams;
    const dashboard = await getCurrentClubDashboard(clubId);
    if (!dashboard) return <EventsRouteError error="club_not_found" />;
    if (!hasClubCapability(dashboard.roles, "club.posts.create")) return <EventsRouteError error="club_access_denied" />;
    return <ClubPostsManager clubId={dashboard.club.id} clubName={dashboard.club.name} roles={dashboard.roles} posts={await listClubManagedPosts(dashboard.club.id)} />;
  } catch (error) {
    return <EventsRouteError error={(error as { code?: string })?.code} />;
  }
}
