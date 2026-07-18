import "server-only";

import { NextResponse } from "next/server";

import { EventsError } from "@/lib/server/events";
import { EventTicketError } from "@/lib/server/eventTickets";
import { RateLimitError, rateLimitResponseHeaders } from "@/lib/server/rateLimit";

const CANONICAL_EVENT_ORIGINS = [
  "https://app.cadesca.com",
  "https://auth.cadesca.com",
  "https://studentclub.cadesca.com",
  "https://cadesca.com",
  "https://www.cadesca.com"
];

function trustedEventOrigins() {
  const origins = new Set(CANONICAL_EVENT_ORIGINS);
  for (const value of [
    process.env.NEXT_PUBLIC_SITE_ORIGIN,
    process.env.NEXT_PUBLIC_AUTH_ORIGIN,
    process.env.NEXT_PUBLIC_AUTH_URL,
    process.env.NEXT_PUBLIC_APP_ORIGIN,
    process.env.NEXT_PUBLIC_APP_URL,
    process.env.NEXT_PUBLIC_STUDENT_CLUB_ORIGIN,
    process.env.NEXT_PUBLIC_STUDENT_CLUB_URL,
    process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : "",
    process.env.VERCEL_BRANCH_URL ? `https://${process.env.VERCEL_BRANCH_URL}` : ""
  ]) {
    if (!value) continue;
    try {
      const parsed = new URL(value);
      if (parsed.protocol === "https:" || (process.env.NODE_ENV !== "production" && parsed.protocol === "http:")) {
        origins.add(parsed.origin.toLowerCase());
      }
    } catch {
      // Ignore malformed deployment configuration; canonical origins remain.
    }
  }
  return origins;
}

export function eventMutationOriginAllowed(request: Request) {
  const origin = request.headers.get("origin");
  if (!origin) return process.env.NODE_ENV !== "production" || request.headers.get("sec-fetch-site") !== "cross-site";
  try {
    const parsed = new URL(origin);
    if (process.env.NODE_ENV !== "production" && (parsed.hostname === "localhost" || parsed.hostname === "127.0.0.1")) {
      return parsed.protocol === "http:" || parsed.protocol === "https:";
    }
    return trustedEventOrigins().has(parsed.origin.toLowerCase());
  } catch {
    return false;
  }
}

export function eventMutationForbiddenResponse() {
  return NextResponse.json({ error: "request_not_allowed" }, { status: 403 });
}

export function eventApiErrorResponse(error: unknown) {
  if (error instanceof EventTicketError || error instanceof EventsError) {
    return NextResponse.json({ error: error.code }, { status: error.status });
  }
  if (error instanceof RateLimitError) {
    return NextResponse.json(
      { error: "rate_limited" },
      { status: 429, headers: rateLimitResponseHeaders(error) }
    );
  }
  console.error("[events_api] internal_server_error", {
    reason: error instanceof Error ? error.name : "unknown"
  });
  return NextResponse.json({ error: "internal_server_error" }, { status: 500 });
}
