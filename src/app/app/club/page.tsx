import { redirect } from "next/navigation";

import { ClubDashboardView } from "@/components/events/ClubEventViews";
import { EventsRouteError } from "@/components/events/EventPrimitives";
import { hasClubCapability } from "@/lib/clubs/permissions";
import { canManageClubEvents, canManageClubFinance, canScanClubEvents } from "@/lib/events/permissions";
import { getCurrentClubDashboard } from "@/lib/server/events";

export const dynamic = "force-dynamic";

export default async function ClubDashboardPage({ searchParams }: { searchParams: Promise<{ clubId?: string }> }) {
  let dashboard;
  try {
    const { clubId } = await searchParams;
    dashboard = await getCurrentClubDashboard(clubId);
  } catch (error) {
    console.error("[club_dashboard] unavailable", { reason: error instanceof Error ? error.name : "unknown" });
    return <EventsRouteError error={(error as { code?: string })?.code} />;
  }
  if (!dashboard) return <EventsRouteError error="club_not_found" />;
  if (hasClubCapability(dashboard.roles, "club.workspace.view")) {
    const canManageMembers = hasClubCapability(dashboard.roles, "club.members.manage");
    return <ClubDashboardView dashboard={{
      club: {
        id: dashboard.club.id,
        name: dashboard.club.name,
        universityName: dashboard.club.universityName,
        acronym: dashboard.club.acronym,
        category: dashboard.club.category,
        status: dashboard.club.status,
        description: dashboard.club.description,
        logoUrl: dashboard.club.logoUrl,
        coverImageUrl: dashboard.club.coverImageUrl,
        contactEmail: dashboard.club.contactEmail,
        websiteUrl: dashboard.club.websiteUrl,
        instagramUrl: dashboard.club.instagramUrl,
        linkedinUrl: dashboard.club.linkedinUrl,
        universityPageUrl: dashboard.club.universityPageUrl,
        updatedAt: dashboard.club.updatedAt
      },
      roles: dashboard.roles,
      members: canManageMembers ? dashboard.members : [],
      events: dashboard.events,
      analytics: {
        ...dashboard.analytics,
        paymentUnderReview: canManageClubFinance(dashboard.roles) ? dashboard.analytics.paymentUnderReview : 0
      }
    }} />;
  }
  if (canManageClubFinance(dashboard.roles)) redirect("/dashboard/finance");
  if (canScanClubEvents(dashboard.roles)) redirect("/dashboard/scanner");
  return <EventsRouteError error="club_access_denied" />;
}
