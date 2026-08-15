import { ClubSettingsView } from "@/components/events/ClubEventViews";
import { EventsRouteError } from "@/components/events/EventPrimitives";
import { hasClubCapability } from "@/lib/clubs/permissions";
import { getCurrentClubDashboard } from "@/lib/server/events";

export const dynamic = "force-dynamic";

export default async function ClubSettingsPage({ searchParams }: { searchParams: Promise<{ clubId?: string }> }) {
  try {
    const { clubId } = await searchParams;
    const dashboard = await getCurrentClubDashboard(clubId);
    if (!dashboard || !hasClubCapability(dashboard.roles, "club.settings.manage")) return <EventsRouteError error="club_access_denied" />;
    return <ClubSettingsView dashboard={dashboard} />;
  } catch (error) {
    return <EventsRouteError error={(error as { code?: string })?.code} />;
  }
}
