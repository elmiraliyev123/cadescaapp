import { NextResponse } from "next/server";

import { eventMutationForbiddenResponse, eventMutationOriginAllowed } from "@/lib/server/eventRoute";
import { RateLimitError, assertRateLimit, rateLimitResponseHeaders } from "@/lib/server/rateLimit";
import { getCurrentStudentContext } from "@/lib/server/social";
import {
  downloadStudentClubStagedFile,
  removeStudentClubStagedFiles,
  type StudentClubUploadReference
} from "@/lib/server/studentClubUploads";
import {
  readLimitedStudentClubFormData,
  readLimitedStudentClubJson,
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

type UploadedFiles = {
  logo: File;
  cover: File | null;
  recognitionDocument: File | null;
};

function formText(formData: FormData, key: string) {
  const value = formData.get(key);
  return typeof value === "string" ? value.trim() : "";
}

function recordText(record: Record<string, unknown>, key: string) {
  const value = record[key];
  return typeof value === "string" || typeof value === "number" || typeof value === "boolean"
    ? String(value).trim()
    : "";
}

function requiredFile(formData: FormData, key: string) {
  const value = formData.get(key);
  if (!value || typeof value === "string" || !value.size) throw new StudentClubError("logo_required", 422);
  return value;
}

function optionalFile(formData: FormData, key: string) {
  const value = formData.get(key);
  if (!value || typeof value === "string" || !value.size) return null;
  return value;
}

function applicationInput(read: (key: string) => string, files: UploadedFiles): AuthenticatedClubApplicationInput {
  return {
    draftId: read("draftId") || null,
    universityId: read("universityId"),
    clubName: read("clubName"),
    acronym: read("acronym") || null,
    category: read("category") || null,
    officialEmail: read("officialEmail"),
    description: read("description"),
    ...files,
    foundedYear: Number.parseInt(read("foundedYear"), 10) || null,
    recognitionStatus: (read("recognitionStatus") || "not_declared") as AuthenticatedClubApplicationInput["recognitionStatus"],
    websiteUrl: read("websiteUrl") || null,
    instagramUrl: read("instagramUrl") || null,
    linkedinUrl: read("linkedinUrl") || null,
    otherSocialUrl: read("otherSocialUrl") || null,
    president: read("president") || null,
    vicePresident: read("vicePresident") || null,
    boardMembers: read("boardMembers") || null,
    facultyAdvisor: read("facultyAdvisor") || null,
    contactPhone: read("contactPhone") || null,
    additionalNote: read("additionalNote") || null,
    agreementAccepted: read("agreementAccepted") === "true"
  };
}

function uploadReference(value: unknown): StudentClubUploadReference | null {
  if (!value || typeof value !== "object") return null;
  const path = (value as Record<string, unknown>).path;
  return typeof path === "string" && path ? { path } : null;
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
  if (!turnstile.success) return genericError(turnstileStatus(turnstile.errorCode), turnstile.errorCode);

  let input: AuthenticatedClubApplicationInput;
  let stagedUserId: string | null = null;
  let stagedPaths: string[] = [];

  try {
    const contentType = request.headers.get("content-type")?.toLowerCase() || "";
    if (contentType.startsWith("multipart/form-data")) {
      // Backward compatibility for a browser tab opened before the staged-upload rollout.
      const formData = await readLimitedStudentClubFormData(request);
      input = applicationInput((key) => formText(formData, key), {
        logo: requiredFile(formData, "logo"),
        cover: optionalFile(formData, "cover"),
        recognitionDocument: optionalFile(formData, "recognitionDocument")
      });
    } else {
      const body = await readLimitedStudentClubJson(request);
      if (!body || typeof body !== "object") throw new StudentClubError("invalid_multipart", 400);
      const record = body as Record<string, unknown>;
      const fields = record.fields && typeof record.fields === "object"
        ? record.fields as Record<string, unknown>
        : {};
      const references = record.uploads && typeof record.uploads === "object"
        ? record.uploads as Record<string, unknown>
        : {};
      const user = await getCurrentStudentContext();
      if (!user || user.status !== "active" || user.id === "user_mock") {
        throw new StudentClubError("authentication_required", 401);
      }
      stagedUserId = user.id;
      const logoReference = uploadReference(references.logo);
      const coverReference = uploadReference(references.cover);
      const documentReference = uploadReference(references.recognitionDocument);
      if (!logoReference) throw new StudentClubError("logo_required", 422);
      stagedPaths = [logoReference.path, coverReference?.path, documentReference?.path].filter((path): path is string => Boolean(path));
      const [logo, cover, recognitionDocument] = await Promise.all([
        downloadStudentClubStagedFile(user.id, "logo", logoReference),
        downloadStudentClubStagedFile(user.id, "cover", coverReference),
        downloadStudentClubStagedFile(user.id, "recognitionDocument", documentReference)
      ]);
      if (!logo) throw new StudentClubError("logo_required", 422);
      input = applicationInput((key) => recordText(fields, key), { logo, cover, recognitionDocument });
    }
  } catch (error) {
    if (stagedUserId) await removeStudentClubStagedFiles(stagedUserId, stagedPaths);
    if (error instanceof StudentClubBodyTooLargeError) return genericError(413, "upload_request_too_large");
    if (error instanceof StudentClubError) return genericError(error.status, error.code);
    if (error instanceof SyntaxError) return genericError(400, "invalid_multipart");
    const message = error instanceof Error ? error.message : "unknown";
    if (message === "image_upload_failed" || message === "document_upload_failed") {
      return genericError(502, message);
    }
    console.error("[student_clubs] staged_upload_resolution_failed", {
      reason: error instanceof Error ? error.name : "unknown"
    });
    return genericError(400, "invalid_multipart");
  }

  try {
    await assertRateLimit({
      namespace: "club_application_submit_ip",
      identifier: ip,
      limit: 10,
      windowSeconds: 10 * 60
    });
    const result = await submitAuthenticatedClubApplication(input);
    return NextResponse.json({ ok: true, clubId: result.clubId, status: result.status });
  } catch (error) {
    if (error instanceof RateLimitError) {
      return genericError(429, "rate_limited", rateLimitResponseHeaders(error));
    }
    if (error instanceof StudentClubError) return genericError(error.status, error.code);
    console.error("[student_clubs] authenticated_submit_failed", {
      reason: error instanceof Error ? error.name : "unknown"
    });
    return genericError(500, "internal_server_error");
  } finally {
    if (stagedUserId) await removeStudentClubStagedFiles(stagedUserId, stagedPaths);
  }
}
