import { ClubPostEditor } from "@/components/clubs/ClubPostEditor";
import { EventsRouteError } from "@/components/events/EventPrimitives";
import { hasClubCapability } from "@/lib/clubs/permissions";
import { getClubManagedPost } from "@/lib/server/clubPosts";
import { getCurrentClubDashboardBySlug } from "@/lib/server/events";

export const dynamic = "force-dynamic";

export default async function ManagedClubEditPostPage({ params }: { params: Promise<{ clubSlug: string; postId: string }> }) {
  const { clubSlug, postId } = await params;
  const dashboard = await getCurrentClubDashboardBySlug(clubSlug);
  if (!dashboard || !hasClubCapability(dashboard.roles, "club.posts.update")) return <EventsRouteError error="club_access_denied" />;
  const post = await getClubManagedPost(dashboard.club.id, postId);
  return <ClubPostEditor clubId={dashboard.club.id} clubName={dashboard.club.name} events={dashboard.events.map(({ id, title }) => ({ id, title }))} post={post} />;
}
