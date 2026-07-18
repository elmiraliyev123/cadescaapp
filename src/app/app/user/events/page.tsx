import { EventsDiscoveryView } from "@/components/events/EventStudentViews";
import { EventsRouteError } from "@/components/events/EventPrimitives";
import { listDiscoverableEvents } from "@/lib/server/events";

export const dynamic = "force-dynamic";

export default async function UserEventsPage({ searchParams }: { searchParams: Promise<{ q?: string | string[] }> }) {
  const queryValue = (await searchParams).q;
  const query = (Array.isArray(queryValue) ? queryValue[0] : queryValue || "").trim().slice(0, 80);
  try {
    const [events, featuredEvents] = await Promise.all([
      listDiscoverableEvents({ query, limit: 60 }),
      query ? Promise.resolve([]) : listDiscoverableEvents({ featured: true, limit: 6, includeSoldOut: false })
    ]);
    return <EventsDiscoveryView events={events} featuredEvents={featuredEvents} query={query} />;
  } catch (error) {
    console.error("[user_events] unavailable", { reason: error instanceof Error ? error.name : "unknown" });
    return <EventsRouteError error={(error as { code?: string })?.code} />;
  }
}
