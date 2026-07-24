import { NextResponse } from "next/server";

import { eventMutationForbiddenResponse, eventMutationOriginAllowed } from "@/lib/server/eventRoute";
import { RateLimitError, assertRateLimit, rateLimitResponseHeaders } from "@/lib/server/rateLimit";
import {
  readLimitedStudentClubFormData,
  StudentClubBodyTooLargeError
} from "@/lib/server/studentClubRequest";
import {
  StudentClubError,
  submitAuthenticatedClubApplication,
  type AuthenticatedClubApplicationInput
} from "@/lib/server/studentClubs";
import {
  getRequestIp,
  getStudentClubTurnstileHostnames,
  turnstileStatus,
  verifyTurnstileToken
} from "@/lib/server/turnstile";

export const runtime = "nodejs";

function text(formData: FormData, key: string) {
  const value = formData.get(key);
  return typeof value === "string" ? value.trim() : "";
}

function file(formData: FormData, key: string) {
  const value = formData.get(key);
  if (!value || typeof value === "string" || !value.size) throw new StudentClubError("invalid_upload", 422);
  return value;
}

function applicationInput(formData: FormData): AuthenticatedClubApplicationInput {
  return {
    universityId: text(formData, "universityId"),
    clubName: text(formData, "clubName"),
    officialEmail: text(formData, "officialEmail"),
    description: text(formData, "description"),
    logo: file(formData, "logo"),
    contactPhone: text(formData, "contactPhone") || null,
    additionalNote: text(formData, "additionalNote") || null,
    agreementAccepted: text(formData, "agreementAccepted") === "true"
  };
}

function genericError(status: number, code = "application_invalid", headers?: HeadersInit) {
  return NextResponse.json({ error: code }, { status, headers });
}

export async function POST(request: Request) {
  if (!eventMutationOriginAllowed(request)) return eventMutationForbiddenResponse();
  const ip = getRequestIp(request) || "unresolved";
  const turnstile = await verifyTurnstileToken(request.headers.get("x-cadesca-turnstile"), ip, {
    expectedAction: "club_application",
    allowedHostnames: getStudentClubTurnstileHostnames()
  });
  if (!turnstile.success) return genericError(turnstileStatus(turnstile.errorCode));

  let formData: FormData;
  try {
    formData = await readLimitedStudentClubFormData(request);
  } catch (error) {
    return genericError(error instanceof StudentClubBodyTooLargeError ? 413 : 400, "invalid_upload");
  }

  try {
    await assertRateLimit({
      namespace: "club_application_submit_ip",
      identifier: ip,
      limit: 10,
      windowSeconds: 10 * 60
    });
    const result = await submitAuthenticatedClubApplication(applicationInput(formData));
    return NextResponse.json({ ok: true, clubId: result.clubId, status: result.status });
  } catch (error) {
    if (error instanceof RateLimitError) {
      return genericError(429, "application_invalid", rateLimitResponseHeaders(error));
    }
    if (error instanceof StudentClubError) return genericError(error.status, error.code);
    console.error("[student_clubs] authenticated_submit_failed", {
      reason: error instanceof Error ? error.name : "unknown"
    });
    return genericError(500, "internal_server_error");
  }
}
