import { ClubFinanceView } from "@/components/events/ClubEventViews";
import { EventsRouteError } from "@/components/events/EventPrimitives";
import { canManageClubFinance } from "@/lib/events/permissions";
import { getCurrentClubDashboard, listClubFinanceTickets } from "@/lib/server/events";

export const dynamic = "force-dynamic";

export default async function ClubFinancePage() {
  try {
    const [dashboard, tickets] = await Promise.all([getCurrentClubDashboard(), listClubFinanceTickets()]);
    if (!dashboard) return <EventsRouteError error="club_not_found" />;
    if (!canManageClubFinance(dashboard.roles)) return <EventsRouteError error="finance_access_denied" />;
    return <ClubFinanceView tickets={tickets} clubName={dashboard.club.name} roles={dashboard.roles} />;
  } catch (error) {
    console.error("[club_finance] unavailable", { reason: error instanceof Error ? error.name : "unknown" });
    return <EventsRouteError error={(error as { code?: string })?.code} />;
  }
}
