import { notFound } from "next/navigation";

import { ClubEventForm } from "@/components/events/ClubEventViews";
import { EventsRouteError } from "@/components/events/EventPrimitives";
import { hasClubCapability } from "@/lib/clubs/permissions";
import { getCurrentClubDashboardBySlug } from "@/lib/server/events";

export const dynamic = "force-dynamic";

export default async function ManagedClubEditEventPage({ params }: { params: Promise<{ clubSlug: string; eventId: string }> }) {
  const { clubSlug, eventId } = await params;
  const dashboard = await getCurrentClubDashboardBySlug(clubSlug, true);
  if (!dashboard || !hasClubCapability(dashboard.roles, "club.events.update")) return <EventsRouteError error="club_access_denied" />;
  const event = dashboard.events.find((candidate) => candidate.id === eventId);
  if (!event) notFound();
  return <ClubEventForm workspace={{ clubId: dashboard.club.id, clubName: dashboard.club.name, roles: dashboard.roles }} event={event} basePath={`/dashboard/${dashboard.club.slug}`} hideNavigation />;
}
