import { ClubSettingsView } from "@/components/events/ClubEventViews";
import { EventsRouteError } from "@/components/events/EventPrimitives";
import { hasClubCapability } from "@/lib/clubs/permissions";
import { getCurrentClubDashboardBySlug } from "@/lib/server/events";

export const dynamic = "force-dynamic";

export default async function ManagedClubProfilePage({ params }: { params: Promise<{ clubSlug: string }> }) {
  const { clubSlug } = await params;
  const dashboard = await getCurrentClubDashboardBySlug(clubSlug);
  if (!dashboard || !hasClubCapability(dashboard.roles, "club.profile.view")) return <EventsRouteError error="club_access_denied" />;
  if (!hasClubCapability(dashboard.roles, "club.settings.manage")) return <section className="rounded-2xl border border-black/10 bg-white p-6"><p className="text-xs font-bold uppercase tracking-[0.12em] text-black/45">Club profile</p><h1 className="mt-2 text-4xl font-semibold tracking-[-0.045em]">{dashboard.club.name}</h1><p className="mt-5 whitespace-pre-wrap text-sm leading-7 text-black/60">{dashboard.club.description}</p></section>;
  return <ClubSettingsView dashboard={dashboard} hideNavigation />;
}
