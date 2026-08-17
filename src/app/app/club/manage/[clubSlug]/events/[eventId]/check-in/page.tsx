import { notFound } from "next/navigation";

import { EventScannerClient } from "@/components/events/EventScannerClient";
import { EventsRouteError } from "@/components/events/EventPrimitives";
import { hasClubCapability } from "@/lib/clubs/permissions";
import { getCurrentClubDashboardBySlug, listAssignedScannerEvents } from "@/lib/server/events";

export const dynamic = "force-dynamic";

export default async function ManagedClubEventCheckInPage({ params }: { params: Promise<{ clubSlug: string; eventId: string }> }) {
  const { clubSlug, eventId } = await params;
  const dashboard = await getCurrentClubDashboardBySlug(clubSlug);
  if (!dashboard || !hasClubCapability(dashboard.roles, "club.events.check_in")) return <EventsRouteError error="scanner_access_denied" />;
  const events = await listAssignedScannerEvents(dashboard.club.id);
  const event = events.find((candidate) => candidate.id === eventId);
  if (!event) notFound();
  return <EventScannerClient event={event} hideNavigation backHref={`/dashboard/${dashboard.club.slug}/events/${event.id}`} />;
}
