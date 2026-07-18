"use client";

import { EventsRouteError } from "@/components/events/EventPrimitives";

export default function UserEventsError({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return <EventsRouteError error="generic" onRetry={reset} />;
}
