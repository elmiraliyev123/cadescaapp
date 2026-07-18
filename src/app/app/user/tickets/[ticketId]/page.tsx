import { notFound } from "next/navigation";

import { EventsRouteError } from "@/components/events/EventPrimitives";
import { TicketDetailView } from "@/components/events/EventTicketViews";
import { getCurrentUserTicket } from "@/lib/server/events";

export const dynamic = "force-dynamic";

export default async function UserTicketDetailPage({ params }: { params: Promise<{ ticketId: string }> }) {
  const { ticketId } = await params;
  let ticket;
  try {
    ticket = await getCurrentUserTicket(ticketId);
  } catch (error) {
    console.error("[user_event_ticket] unavailable", { reason: error instanceof Error ? error.name : "unknown" });
    return <EventsRouteError error={(error as { code?: string })?.code} />;
  }
  if (!ticket) notFound();
  return <TicketDetailView ticket={ticket} serverNow={new Date().toISOString()} />;
}
