import { EventsRouteError } from "@/components/events/EventPrimitives";
import { TicketsListView } from "@/components/events/EventTicketViews";
import { listCurrentUserTickets } from "@/lib/server/events";

export const dynamic = "force-dynamic";

export default async function UserTicketsPage() {
  try {
    return <TicketsListView tickets={await listCurrentUserTickets()} />;
  } catch (error) {
    console.error("[user_event_tickets] unavailable", { reason: error instanceof Error ? error.name : "unknown" });
    return <EventsRouteError error={(error as { code?: string })?.code} />;
  }
}
