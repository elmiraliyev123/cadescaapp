import { AppTopBar } from "@/components/app/AppTopBar";
import { EventsDiscoveryView } from "@/components/events/EventStudentViews";
import { EventsRouteError } from "@/components/events/EventPrimitives";
import { listPublicDiscoverableEvents } from "@/lib/server/events";

export const dynamic = "force-dynamic";

export default async function PublicEventsPage({ searchParams }: { searchParams: Promise<{ q?: string | string[] }> }) {
  const queryValue = (await searchParams).q;
  const query = (Array.isArray(queryValue) ? queryValue[0] : queryValue || "").trim().slice(0, 80);
  try {
    const [events, featuredEvents] = await Promise.all([
      listPublicDiscoverableEvents({ query, limit: 60 }),
      query ? Promise.resolve([]) : listPublicDiscoverableEvents({ featured: true, limit: 6, includeSoldOut: false })
    ]);
    return (
      <div className="min-h-dvh bg-[#fffaf0]">
        <AppTopBar variant="public" />
        <main className="px-3 py-6 sm:px-6 sm:py-10">
          <EventsDiscoveryView events={events} featuredEvents={featuredEvents} query={query} publicView />
        </main>
      </div>
    );
  } catch (error) {
    console.error("[public_events] unavailable", { reason: error instanceof Error ? error.name : "unknown" });
    return <EventsRouteError error={(error as { code?: string })?.code} />;
  }
}
