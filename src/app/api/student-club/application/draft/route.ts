import { NextResponse } from "next/server";

import { eventMutationForbiddenResponse, eventMutationOriginAllowed } from "@/lib/server/eventRoute";
import { RateLimitError, assertRateLimit, rateLimitResponseHeaders } from "@/lib/server/rateLimit";
import {
  getCurrentClubApplicationDraft,
  saveCurrentClubApplicationDraft,
  StudentClubError,
  type ClubApplicationDraftPayload
} from "@/lib/server/studentClubs";
import { getRequestIp } from "@/lib/server/turnstile";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function response(status: number, error: string, headers?: HeadersInit) {
  const responseHeaders = new Headers(headers);
  responseHeaders.set("cache-control", "no-store");
  return NextResponse.json({ error }, { status, headers: responseHeaders });
}

export async function GET() {
  try {
    return NextResponse.json({ ok: true, draft: await getCurrentClubApplicationDraft() }, {
      headers: { "cache-control": "no-store" }
    });
  } catch (error) {
    if (error instanceof StudentClubError) return response(error.status, error.code);
    return response(500, "internal_server_error");
  }
}

export async function PUT(request: Request) {
  if (!eventMutationOriginAllowed(request)) return eventMutationForbiddenResponse();
  try {
    await assertRateLimit({
      namespace: "club_application_draft_ip",
      identifier: getRequestIp(request) || "unresolved",
      limit: 90,
      windowSeconds: 60 * 60
    });
    const body = await request.json() as {
      id?: string | null;
      currentStep?: number;
      payload?: Partial<ClubApplicationDraftPayload>;
    };
    const draft = await saveCurrentClubApplicationDraft({
      id: body.id,
      currentStep: Number(body.currentStep) || 1,
      payload: body.payload || {}
    });
    return NextResponse.json({ ok: true, draft }, { headers: { "cache-control": "no-store" } });
  } catch (error) {
    if (error instanceof RateLimitError) return response(429, "application_invalid", rateLimitResponseHeaders(error));
    if (error instanceof StudentClubError) return response(error.status, error.code);
    console.error("[student_clubs] draft_save_failed", {
      reason: error instanceof Error ? error.name : "unknown"
    });
    return response(500, "internal_server_error");
  }
}
