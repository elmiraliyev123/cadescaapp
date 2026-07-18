"use client";

import { EventsRouteError } from "@/components/events/EventPrimitives";

export default function AdminEventsError({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return <EventsRouteError error="generic" onRetry={reset} />;
}
