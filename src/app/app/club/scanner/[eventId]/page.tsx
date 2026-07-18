import { notFound } from "next/navigation";

import { EventScannerClient } from "@/components/events/EventScannerClient";
import { EventsRouteError } from "@/components/events/EventPrimitives";
import { canScanClubEvents } from "@/lib/events/permissions";
import { getCurrentClubDashboard, listAssignedScannerEvents } from "@/lib/server/events";

export const dynamic = "force-dynamic";

export default async function AssignedEventScannerPage({ params }: { params: Promise<{ eventId: string }> }) {
  const { eventId } = await params;
  let events;
  try {
    const dashboard = await getCurrentClubDashboard();
    if (!dashboard) return <EventsRouteError error="club_not_found" />;
    if (!canScanClubEvents(dashboard.roles)) return <EventsRouteError error="scanner_access_denied" />;
    events = await listAssignedScannerEvents();
  } catch (error) {
    console.error("[assigned_event_scanner] unavailable", { reason: error instanceof Error ? error.name : "unknown" });
    return <EventsRouteError error={(error as { code?: string })?.code} />;
  }
  const event = events.find((item) => item.id === eventId);
  if (!event) notFound();
  return <EventScannerClient event={event} />;
}
