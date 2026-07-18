import { NextResponse } from "next/server";

import { eventMutationForbiddenResponse, eventMutationOriginAllowed } from "@/lib/server/eventRoute";
import { RateLimitError, assertRateLimit, rateLimitResponseHeaders } from "@/lib/server/rateLimit";
import {
  readLimitedStudentClubJson,
  StudentClubBodyTooLargeError
} from "@/lib/server/studentClubRequest";
import { respondToClubClarification, StudentClubError } from "@/lib/server/studentClubs";
import { getRequestIp } from "@/lib/server/turnstile";

export const runtime = "nodejs";

function errorResponse(status: number, code: string, headers?: HeadersInit) {
  return NextResponse.json({ error: code }, { status, headers });
}

export async function POST(request: Request) {
  if (!eventMutationOriginAllowed(request)) return eventMutationForbiddenResponse();
  try {
    await assertRateLimit({
      namespace: "club_application_clarification_ip",
      identifier: getRequestIp(request) || "unresolved",
      limit: 20,
      windowSeconds: 60 * 60
    });
    const parsed = await readLimitedStudentClubJson(request);
    const message = parsed && typeof parsed === "object" && "message" in parsed
      ? String((parsed as { message?: unknown }).message || "")
      : "";
    const application = await respondToClubClarification(message);
    return NextResponse.json({ ok: true, application });
  } catch (error) {
    if (error instanceof StudentClubBodyTooLargeError) return errorResponse(413, "application_invalid");
    if (error instanceof SyntaxError) return errorResponse(400, "application_invalid");
    if (error instanceof RateLimitError) {
      return errorResponse(429, "application_invalid", rateLimitResponseHeaders(error));
    }
    if (error instanceof StudentClubError) return errorResponse(error.status, error.code);
    console.error("[student_clubs] clarification_response_failed", {
      reason: error instanceof Error ? error.name : "unknown"
    });
    return errorResponse(500, "internal_server_error");
  }
}

