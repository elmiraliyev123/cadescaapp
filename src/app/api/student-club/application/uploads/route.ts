import { NextResponse } from "next/server";

import { eventMutationForbiddenResponse, eventMutationOriginAllowed } from "@/lib/server/eventRoute";
import { RateLimitError, assertRateLimit, rateLimitResponseHeaders } from "@/lib/server/rateLimit";
import { getCurrentStudentContext } from "@/lib/server/social";
import {
  createStudentClubUploadTickets,
  removeStudentClubStagedFiles,
  type StudentClubUploadKind,
  type StudentClubUploadRequest
} from "@/lib/server/studentClubUploads";
import {
  readLimitedStudentClubJson,
  StudentClubBodyTooLargeError
} from "@/lib/server/studentClubRequest";
import { getRequestIp } from "@/lib/server/turnstile";

export const runtime = "nodejs";

function errorResponse(status: number, error: string, headers?: HeadersInit) {
  return NextResponse.json({ error }, { status, headers });
}

function uploadRequests(value: unknown): StudentClubUploadRequest[] | null {
  if (!Array.isArray(value)) return null;
  const kinds = new Set<StudentClubUploadKind>(["logo", "cover", "recognitionDocument"]);
  const uploads: StudentClubUploadRequest[] = [];
  for (const item of value) {
    if (!item || typeof item !== "object") return null;
    const record = item as Record<string, unknown>;
    if (
      typeof record.kind !== "string" ||
      !kinds.has(record.kind as StudentClubUploadKind) ||
      typeof record.byteSize !== "number" ||
      typeof record.contentType !== "string" ||
      typeof record.extension !== "string"
    ) return null;
    uploads.push({
      kind: record.kind as StudentClubUploadKind,
      byteSize: record.byteSize,
      contentType: record.contentType.toLowerCase(),
      extension: record.extension.toLowerCase()
    });
  }
  return uploads;
}

async function authenticatedUser() {
  const user = await getCurrentStudentContext();
  return user && user.status === "active" && user.id !== "user_mock" ? user : null;
}

export async function POST(request: Request) {
  if (!eventMutationOriginAllowed(request)) return eventMutationForbiddenResponse();
  const user = await authenticatedUser();
  if (!user) return errorResponse(401, "authentication_required");

  try {
    await assertRateLimit({
      namespace: "club_application_upload_ticket",
      identifier: `${user.id}:${getRequestIp(request) || "unresolved"}`,
      limit: 20,
      windowSeconds: 60 * 60
    });
    const body = await readLimitedStudentClubJson(request) as { uploads?: unknown } | null;
    const uploads = uploadRequests(body?.uploads);
    if (!uploads?.length) return errorResponse(422, "unsupported_file_type");
    const tickets = await createStudentClubUploadTickets(user.id, uploads);
    return NextResponse.json({ ok: true, bucket: "club-application-staging", tickets });
  } catch (error) {
    if (error instanceof StudentClubBodyTooLargeError) return errorResponse(413, "upload_request_too_large");
    if (error instanceof RateLimitError) return errorResponse(429, "rate_limited", rateLimitResponseHeaders(error));
    if (error instanceof SyntaxError || (error instanceof Error && error.message === "invalid_upload_request")) {
      return errorResponse(422, "unsupported_file_type");
    }
    console.error("[student_clubs] upload_ticket_failed", {
      reason: error instanceof Error ? error.name : "unknown"
    });
    return errorResponse(502, "image_upload_failed");
  }
}

export async function DELETE(request: Request) {
  if (!eventMutationOriginAllowed(request)) return eventMutationForbiddenResponse();
  const user = await authenticatedUser();
  if (!user) return errorResponse(401, "authentication_required");
  try {
    const body = await readLimitedStudentClubJson(request) as { paths?: unknown } | null;
    const paths = Array.isArray(body?.paths)
      ? body.paths.filter((path): path is string => typeof path === "string").slice(0, 3)
      : [];
    await removeStudentClubStagedFiles(user.id, paths);
    return NextResponse.json({ ok: true });
  } catch (error) {
    if (error instanceof StudentClubBodyTooLargeError) return errorResponse(413, "upload_request_too_large");
    return errorResponse(400, "invalid_upload_request");
  }
}
