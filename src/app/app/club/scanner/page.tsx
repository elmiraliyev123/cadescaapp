import { ScannerEventListView } from "@/components/events/ClubEventViews";
import { EventsRouteError } from "@/components/events/EventPrimitives";
import { canScanClubEvents } from "@/lib/events/permissions";
import { getCurrentClubDashboard, listAssignedScannerEvents } from "@/lib/server/events";

export const dynamic = "force-dynamic";

export default async function ClubScannerPage() {
  try {
    const dashboard = await getCurrentClubDashboard();
    if (!dashboard) return <EventsRouteError error="club_not_found" />;
    if (!canScanClubEvents(dashboard.roles)) return <EventsRouteError error="scanner_access_denied" />;
    return <ScannerEventListView events={await listAssignedScannerEvents()} />;
  } catch (error) {
    console.error("[club_scanner] unavailable", { reason: error instanceof Error ? error.name : "unknown" });
    return <EventsRouteError error={(error as { code?: string })?.code} />;
  }
}
