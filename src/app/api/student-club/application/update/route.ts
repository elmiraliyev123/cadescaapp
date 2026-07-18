import { NextResponse } from "next/server";

import { eventMutationForbiddenResponse, eventMutationOriginAllowed } from "@/lib/server/eventRoute";
import { RateLimitError, assertRateLimit, rateLimitResponseHeaders } from "@/lib/server/rateLimit";
import {
  readLimitedStudentClubFormData,
  StudentClubBodyTooLargeError
} from "@/lib/server/studentClubRequest";
import {
  StudentClubError,
  updateCurrentClubApplication,
  type ClubApplicationUpdateInput
} from "@/lib/server/studentClubs";
import { getRequestIp } from "@/lib/server/turnstile";

export const runtime = "nodejs";

function text(formData: FormData, key: string) {
  const value = formData.get(key);
  return typeof value === "string" ? value.trim() : "";
}

function optionalFile(formData: FormData, key: string) {
  const value = formData.get(key);
  if (!value || typeof value === "string" || value.size === 0) return null;
  return value;
}

function applicationInput(formData: FormData): ClubApplicationUpdateInput {
  return {
    clubName: text(formData, "clubName"),
    preferredSlug: text(formData, "preferredSlug"),
    description: text(formData, "description"),
    instagramUrl: text(formData, "instagramUrl"),
    websiteUrl: text(formData, "websiteUrl"),
    universityPageUrl: text(formData, "universityPageUrl") || null,
    contactPhone: text(formData, "contactPhone") || null,
    additionalNote: text(formData, "additionalNote") || null,
    logo: optionalFile(formData, "logo"),
    recognitionDocument: optionalFile(formData, "recognitionDocument")
  };
}

function errorResponse(status: number, code: string, headers?: HeadersInit) {
  return NextResponse.json({ error: code }, { status, headers });
}

export async function POST(request: Request) {
  if (!eventMutationOriginAllowed(request)) return eventMutationForbiddenResponse();
  try {
    await assertRateLimit({
      namespace: "club_application_update_ip",
      identifier: getRequestIp(request) || "unresolved",
      limit: 20,
      windowSeconds: 60 * 60
    });
    const formData = await readLimitedStudentClubFormData(request);
    const application = await updateCurrentClubApplication(applicationInput(formData));
    return NextResponse.json({ ok: true, application });
  } catch (error) {
    if (error instanceof StudentClubBodyTooLargeError) return errorResponse(413, "invalid_upload");
    if (error instanceof RateLimitError) {
      return errorResponse(429, "application_invalid", rateLimitResponseHeaders(error));
    }
    if (error instanceof StudentClubError) return errorResponse(error.status, error.code);
    console.error("[student_clubs] application_update_failed", {
      reason: error instanceof Error ? error.name : "unknown"
    });
    return errorResponse(500, "internal_server_error");
  }
}

