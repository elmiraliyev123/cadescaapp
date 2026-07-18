"use client";

import { EventsRouteError } from "@/components/events/EventPrimitives";

export default function ClubError({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return <EventsRouteError error="generic" onRetry={reset} />;
}
