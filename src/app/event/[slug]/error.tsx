"use client";

import { EventsRouteError } from "@/components/events/EventPrimitives";

export default function PublicEventError({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return <main className="min-h-dvh bg-[#fffaf0] p-4 sm:p-8"><EventsRouteError error="generic" onRetry={reset} /></main>;
}
