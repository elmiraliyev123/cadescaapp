import "server-only";

import { createHash, randomUUID } from "node:crypto";

import { MAX_CLUB_DOCUMENT_BYTES, MAX_CLUB_IMAGE_BYTES } from "@/lib/clubs/uploadValidation";
import { getSupabaseAdminClient } from "@/lib/supabase/admin";

export const CLUB_APPLICATION_STAGING_BUCKET = "club-application-staging";

export type StudentClubUploadKind = "logo" | "cover" | "recognitionDocument";
export type StudentClubUploadReference = { path: string };

export type StudentClubUploadRequest = {
  kind: StudentClubUploadKind;
  byteSize: number;
  contentType: string;
  extension: string;
};

const IMAGE_TYPES = new Set(["image/jpeg", "image/png", "image/webp", "image/heic", "image/heif"]);
const IMAGE_EXTENSIONS = new Set(["jpg", "png", "webp", "heic", "heif"]);
const DOCUMENT_TYPES = new Set(["application/pdf", ...IMAGE_TYPES]);
const DOCUMENT_EXTENSIONS = new Set(["pdf", ...IMAGE_EXTENSIONS]);

function ownerKey(userId: string) {
  return createHash("sha256").update(userId).digest("hex").slice(0, 32);
}

function stagingPrefix(userId: string) {
  return `applications/${ownerKey(userId)}/`;
}

function expectedMaximum(kind: StudentClubUploadKind) {
  return kind === "recognitionDocument" ? MAX_CLUB_DOCUMENT_BYTES : MAX_CLUB_IMAGE_BYTES;
}

function validUploadRequest(input: StudentClubUploadRequest) {
  const allowedTypes = input.kind === "recognitionDocument" ? DOCUMENT_TYPES : IMAGE_TYPES;
  const allowedExtensions = input.kind === "recognitionDocument" ? DOCUMENT_EXTENSIONS : IMAGE_EXTENSIONS;
  return (
    Number.isSafeInteger(input.byteSize) &&
    input.byteSize > 0 &&
    input.byteSize <= expectedMaximum(input.kind) &&
    allowedTypes.has(input.contentType) &&
    allowedExtensions.has(input.extension)
  );
}

export async function createStudentClubUploadTickets(userId: string, uploads: StudentClubUploadRequest[]) {
  if (!uploads.length || uploads.length > 3 || new Set(uploads.map((upload) => upload.kind)).size !== uploads.length) {
    throw new Error("invalid_upload_request");
  }
  if (uploads.some((upload) => !validUploadRequest(upload))) throw new Error("invalid_upload_request");

  const storage = getSupabaseAdminClient().storage.from(CLUB_APPLICATION_STAGING_BUCKET);
  return Promise.all(uploads.map(async (upload) => {
    const path = `${stagingPrefix(userId)}${randomUUID()}/${upload.kind}.${upload.extension}`;
    const { data, error } = await storage.createSignedUploadUrl(path);
    if (error || !data?.token) {
      console.error("[student_clubs] staging_ticket_failed", {
        kind: upload.kind,
        reason: error?.name || "missing_token"
      });
      throw new Error("staging_ticket_failed");
    }
    return { kind: upload.kind, path, token: data.token };
  }));
}

export function isOwnedStudentClubStagingPath(userId: string, kind: StudentClubUploadKind, path: string) {
  const expectedSuffix = `/${kind}.`;
  return (
    path.startsWith(stagingPrefix(userId)) &&
    path.includes(expectedSuffix) &&
    !path.includes("..") &&
    !path.startsWith("/") &&
    path.length <= 240
  );
}

export async function downloadStudentClubStagedFile(
  userId: string,
  kind: StudentClubUploadKind,
  reference: StudentClubUploadReference | null
) {
  if (!reference) return null;
  if (!isOwnedStudentClubStagingPath(userId, kind, reference.path)) throw new Error("invalid_staging_reference");
  const storage = getSupabaseAdminClient().storage.from(CLUB_APPLICATION_STAGING_BUCKET);
  const { data, error } = await storage.download(reference.path);
  if (error || !data) {
    console.error("[student_clubs] staging_download_failed", {
      kind,
      reason: error?.name || "missing_object"
    });
    throw new Error(kind === "recognitionDocument" ? "document_upload_failed" : "image_upload_failed");
  }
  const extension = reference.path.split(".").pop()?.toLowerCase() || "bin";
  const contentType = data.type || (extension === "pdf" ? "application/pdf" : "application/octet-stream");
  return new File([data], `${kind}.${extension}`, { type: contentType });
}

export async function removeStudentClubStagedFiles(userId: string, paths: string[]) {
  const owned = [...new Set(paths)].filter((path) => (
    ["logo", "cover", "recognitionDocument"] as const
  ).some((kind) => isOwnedStudentClubStagingPath(userId, kind, path)));
  if (!owned.length) return;
  const { error } = await getSupabaseAdminClient().storage.from(CLUB_APPLICATION_STAGING_BUCKET).remove(owned);
  if (error) {
    console.warn("[student_clubs] staging_cleanup_failed", {
      objectCount: owned.length,
      reason: error.name
    });
  }
}

export async function cleanupExpiredStudentClubStagedFiles(olderThan = new Date(Date.now() - 3 * 60 * 60 * 1000)) {
  const storage = getSupabaseAdminClient().storage.from(CLUB_APPLICATION_STAGING_BUCKET);
  const { data: owners, error: ownerError } = await storage.list("applications", { limit: 1_000 });
  if (ownerError) throw ownerError;
  const stalePaths: string[] = [];

  for (const owner of owners || []) {
    const ownerPrefix = `applications/${owner.name}`;
    const { data: sessions, error: sessionError } = await storage.list(ownerPrefix, { limit: 1_000 });
    if (sessionError) {
      console.warn("[student_clubs] staging_cleanup_list_failed", { level: "session", reason: sessionError.name });
      continue;
    }
    for (const session of sessions || []) {
      const sessionPrefix = `${ownerPrefix}/${session.name}`;
      const { data: files, error: fileError } = await storage.list(sessionPrefix, { limit: 10 });
      if (fileError) {
        console.warn("[student_clubs] staging_cleanup_list_failed", { level: "file", reason: fileError.name });
        continue;
      }
      for (const file of files || []) {
        const createdAt = file.created_at ? new Date(file.created_at) : null;
        if (createdAt && Number.isFinite(createdAt.getTime()) && createdAt < olderThan) {
          stalePaths.push(`${sessionPrefix}/${file.name}`);
        }
      }
    }
  }

  for (let offset = 0; offset < stalePaths.length; offset += 100) {
    const batch = stalePaths.slice(offset, offset + 100);
    const { error } = await storage.remove(batch);
    if (error) throw error;
  }
  return stalePaths.length;
}
