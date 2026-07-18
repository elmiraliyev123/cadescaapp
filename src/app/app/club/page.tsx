import { redirect } from "next/navigation";

import { ClubDashboardView } from "@/components/events/ClubEventViews";
import { EventsRouteError } from "@/components/events/EventPrimitives";
import { canManageClubEvents, canManageClubFinance, canScanClubEvents } from "@/lib/events/permissions";
import { getCurrentClubDashboard } from "@/lib/server/events";

export const dynamic = "force-dynamic";

export default async function ClubDashboardPage() {
  let dashboard;
  try {
    dashboard = await getCurrentClubDashboard();
  } catch (error) {
    console.error("[club_dashboard] unavailable", { reason: error instanceof Error ? error.name : "unknown" });
    return <EventsRouteError error={(error as { code?: string })?.code} />;
  }
  if (!dashboard) return <EventsRouteError error="club_not_found" />;
  if (canManageClubEvents(dashboard.roles)) {
    const isOwner = dashboard.roles.includes("club_owner");
    return <ClubDashboardView dashboard={{
      club: {
        id: dashboard.club.id,
        name: dashboard.club.name,
        status: dashboard.club.status,
        description: dashboard.club.description,
        logoUrl: dashboard.club.logoUrl,
        contactEmail: dashboard.club.contactEmail,
        websiteUrl: dashboard.club.websiteUrl,
        instagramUrl: dashboard.club.instagramUrl,
        universityPageUrl: dashboard.club.universityPageUrl,
        updatedAt: dashboard.club.updatedAt
      },
      roles: dashboard.roles,
      members: isOwner ? dashboard.members : [],
      events: dashboard.events,
      analytics: {
        ...dashboard.analytics,
        paymentUnderReview: canManageClubFinance(dashboard.roles) ? dashboard.analytics.paymentUnderReview : 0
      }
    }} />;
  }
  if (canManageClubFinance(dashboard.roles)) redirect("/app/club/finance");
  if (canScanClubEvents(dashboard.roles)) redirect("/app/club/scanner");
  return <EventsRouteError error="club_access_denied" />;
}
