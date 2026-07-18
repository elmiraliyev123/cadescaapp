import { notFound } from "next/navigation";

import { EventDetailView } from "@/components/events/EventStudentViews";
import { EventsRouteError } from "@/components/events/EventPrimitives";
import { getCurrentUserTicket, getDiscoverableEventBySlug } from "@/lib/server/events";

export const dynamic = "force-dynamic";

export default async function UserEventDetailPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  let event;
  try {
    event = await getDiscoverableEventBySlug(slug);
  } catch (error) {
    console.error("[user_event_detail] unavailable", { reason: error instanceof Error ? error.name : "unknown" });
    return <EventsRouteError error={(error as { code?: string })?.code} />;
  }
  if (!event) notFound();
  try {
    const ticket = event.currentTicketId ? await getCurrentUserTicket(event.currentTicketId) : null;
    return <EventDetailView event={event} ticket={ticket} serverNow={new Date().toISOString()} />;
  } catch (error) {
    console.error("[user_event_ticket_context] unavailable", { reason: error instanceof Error ? error.name : "unknown" });
    return <EventsRouteError error={(error as { code?: string })?.code} />;
  }
}
