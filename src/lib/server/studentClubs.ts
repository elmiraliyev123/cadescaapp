import "server-only";

import { createHmac, randomUUID } from "node:crypto";
import type { PoolClient } from "pg";
import sharp from "sharp";

import { rolesWithClubCapability, type ClubRole } from "@/lib/clubs/permissions";
import {
  ClubUploadValidationError,
  MAX_CLUB_DOCUMENT_BYTES,
  MAX_CLUB_IMAGE_BYTES,
  validateClubDocumentFile,
  validateClubImageFile,
  type ValidatedClubUpload
} from "@/lib/clubs/uploadValidation";
import { assertImageAllowed } from "@/lib/server/imageModeration";
import { hashMerchantPassword } from "@/lib/server/merchants";
import { getCurrentStudentContext } from "@/lib/server/social";
import {
  authenticateSupabaseAuthIdentity,
  createConfirmedSupabaseAuthUser,
  SupabaseAuthBridgeError
} from "@/lib/server/supabaseAuthBridge";
import { getReadyPool, authenticateUserInDb, type User } from "@/lib/server/users";
import { getEmailDomain, type UniversityRecord } from "@/lib/server/universities";
import { verifyVerificationCode } from "@/lib/server/verificationCodes";
import { getSupabaseAdminClient } from "@/lib/supabase/admin";
import { isStrongCadescaPassword } from "@/lib/passwords";
import { validateCadescaUsername } from "@/lib/usernames";

const CLUB_LOGO_BUCKET = "event-assets";
const CLUB_DOCUMENT_BUCKET = "club-verification";
const CLUB_SLUG_RESERVED = new Set(["admin", "api", "app", "auth", "events", "help", "student-club", "support"]);

export type ClubApplicationStatus =
  | "pending_review"
  | "clarification_requested"
  | "approved"
  | "rejected"
  | "suspended"
  | "archived";

export type ClubApplicationView = {
  id: string;
  universityId: string;
  universityName: string;
  name: string;
  slug: string;
  description: string;
  status: ClubApplicationStatus;
  officialEmail: string;
  contactEmail: string;
  websiteUrl: string | null;
  instagramUrl: string | null;
  universityPageUrl: string | null;
  contactPhone: string | null;
  additionalNote: string | null;
  rejectionReason: string | null;
  clarificationMessage: string | null;
  suspensionReason: string | null;
  latestRepresentativeMessage: string | null;
  representative: {
    id: string;
    name: string;
    email: string;
    username: string | null;
  };
  membershipStatus: "invited" | "active" | "revoked" | "left" | "suspended";
  roles: ClubRole[];
  logoUrl: string | null;
  createdAt: string;
  updatedAt: string;
  approvedAt: string | null;
  rejectedAt: string | null;
};

export type ClubApplicationHistoryEntry = {
  id: string;
  action: string;
  reviewerComment: string | null;
  createdAt: string;
};

export type AdminClubApplication = ClubApplicationView & {
  logoPreviewUrl: string | null;
  verificationDocumentUrl: string | null;
};

export type ClubMembershipInvitation = {
  id: string;
  clubId: string;
  clubName: string;
  universityName: string;
  role: ClubRole;
  invitedAt: string;
};

export type UserClubAccessSummary = {
  available: boolean;
  hasActiveMembership: boolean;
  invitationCount: number;
  gatewayHref: "/app/user/club";
};

export type ManagedClubSummary = {
  id: string;
  name: string;
  slug: string;
  universityName: string;
  logoUrl: string | null;
  roles: ClubRole[];
  upcomingEventCount: number;
};

export type ClubApplicationInput = {
  universityId: string;
  clubName: string;
  preferredSlug: string;
  officialEmail: string;
  representativeName: string;
  representativeEmail: string;
  representativeUsername: string;
  password: string;
  confirmPassword: string;
  description: string;
  logo: File;
  instagramUrl: string;
  websiteUrl: string;
  universityPageUrl?: string | null;
  recognitionDocument: File;
  contactPhone?: string | null;
  additionalNote?: string | null;
  agreementAccepted: boolean;
};

export type AuthenticatedClubApplicationInput = {
  draftId?: string | null;
  universityId: string;
  clubName: string;
  acronym?: string | null;
  category?: string | null;
  officialEmail: string;
  description: string;
  logo: File;
  cover?: File | null;
  recognitionDocument?: File | null;
  foundedYear?: number | null;
  recognitionStatus?: "not_declared" | "recognized" | "not_recognized" | "pending_confirmation";
  websiteUrl?: string | null;
  instagramUrl?: string | null;
  linkedinUrl?: string | null;
  otherSocialUrl?: string | null;
  president?: string | null;
  vicePresident?: string | null;
  boardMembers?: string | null;
  facultyAdvisor?: string | null;
  contactPhone?: string | null;
  additionalNote?: string | null;
  agreementAccepted: boolean;
};

export type ClubApplicationDraftPayload = {
  universityId: string;
  clubName: string;
  acronym: string;
  category: string;
  description: string;
  officialEmail: string;
  contactPhone: string;
  websiteUrl: string;
  instagramUrl: string;
  linkedinUrl: string;
  otherSocialUrl: string;
  foundedYear: string;
  recognitionStatus: "not_declared" | "recognized" | "not_recognized" | "pending_confirmation";
  president: string;
  vicePresident: string;
  boardMembers: string;
  facultyAdvisor: string;
  additionalNote: string;
};

export type ClubApplicationDraftView = {
  id: string;
  payload: ClubApplicationDraftPayload;
  currentStep: number;
  createdAt: string;
  updatedAt: string;
};

export type ClubReviewDecision = "approve" | "reject" | "request_clarification";

export type ClubApplicationUpdateInput = {
  clubName: string;
  description: string;
  contactPhone?: string | null;
  additionalNote?: string | null;
  logo?: File | null;
};

export type ApprovedClubProfileInput = {
  clubId: string;
  acronym?: string | null;
  category?: string | null;
  description: string;
  contactEmail: string;
  websiteUrl?: string | null;
  instagramUrl?: string | null;
  linkedinUrl?: string | null;
  universityPageUrl?: string | null;
  logo?: File | null;
  cover?: File | null;
};

export type StudentClubErrorCode =
  | "authentication_required"
  | "application_conflict"
  | "application_invalid"
  | "application_not_found"
  | "club_profile_access_denied"
  | "club_profile_invalid"
  | "club_profile_not_editable"
  | "club_email_domain_mismatch"
  | "document_file_too_large"
  | "document_upload_failed"
  | "image_file_too_large"
  | "image_moderation_unavailable"
  | "image_rejected"
  | "image_upload_failed"
  | "invalid_multipart"
  | "invalid_password"
  | "invalid_upload"
  | "invalid_username"
  | "logo_required"
  | "reserved_username"
  | "review_conflict"
  | "review_invalid"
  | "application_save_failed"
  | "unsupported_document_type"
  | "unsupported_image_type"
  | "upload_request_too_large"
  | "upload_failed"
  | "verification_code_invalid"
  | "verification_code_expired"
  | "verification_too_many_attempts";

export class StudentClubError extends Error {
  code: StudentClubErrorCode;
  status: number;

  constructor(code: StudentClubErrorCode, status = 400) {
    super(code);
    this.name = "StudentClubError";
    this.code = code;
    this.status = status;
  }
}

type ClubApplicationRow = {
  id: string;
  university_id: string;
  university_name: string;
  name: string;
  slug: string;
  description: string;
  status: ClubApplicationStatus;
  logo_url: string | null;
  official_email: string;
  contact_email: string;
  website_url: string | null;
  instagram_url: string | null;
  university_page_url: string | null;
  verification_document_url: string | null;
  contact_phone: string | null;
  additional_note: string | null;
  rejection_reason: string | null;
  clarification_message: string | null;
  suspension_reason: string | null;
  latest_representative_message: string | null;
  representative_id: string;
  representative_name: string;
  representative_email: string;
  representative_username: string | null;
  membership_status: ClubApplicationView["membershipStatus"];
  roles: ClubApplicationView["roles"] | null;
  created_at: Date | string;
  updated_at: Date | string;
  approved_at: Date | string | null;
  rejected_at: Date | string | null;
};

type ExistingRepresentativeRow = User & {
  suspended_at?: Date | string | null;
  deleted_at?: Date | string | null;
};

type PreparedClubUpload = ValidatedClubUpload & { file: File };

type ValidatedApplication = Omit<ClubApplicationInput, "confirmPassword" | "logo" | "recognitionDocument"> & {
  university: UniversityRecord;
  clubSlug: string;
  logoUpload: PreparedClubUpload;
  documentUpload: PreparedClubUpload;
  instagramUrl: string;
  websiteUrl: string;
  universityPageUrl: string | null;
  contactPhone: string | null;
  additionalNote: string | null;
};

function normalizeEmail(value: string) {
  return value.trim().toLowerCase();
}

function adminActorHash(email: string) {
  const secret = process.env.AUTH_SECRET;
  if (!secret) throw new StudentClubError("review_invalid", 500);
  return createHmac("sha256", secret)
    .update(email.trim().toLowerCase())
    .digest("base64url");
}

function toIso(value: Date | string | null | undefined) {
  if (!value) return null;
  return value instanceof Date ? value.toISOString() : new Date(value).toISOString();
}

function fieldLength(value: string, minimum: number, maximum: number) {
  const length = value.trim().length;
  return length >= minimum && length <= maximum;
}

function normalizeClubSlug(value: string) {
  return value
    .trim()
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9-]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60);
}

function normalizeHttpUrl(value: string, required: boolean) {
  const normalized = value.trim();
  if (!normalized && !required) return null;

  try {
    const url = new URL(normalized);
    if (!/^https?:$/.test(url.protocol) || url.username || url.password || !url.hostname) {
      throw new Error("invalid_url");
    }
    return url.toString();
  } catch {
    throw new StudentClubError("application_invalid", 422);
  }
}

function emailDomainMatches(email: string, university: UniversityRecord) {
  const submittedDomain = getEmailDomain(email);
  return university.emailDomains.some((domain) => {
    const allowed = domain.trim().toLowerCase();
    return submittedDomain === allowed || submittedDomain.endsWith(`.${allowed}`);
  });
}

async function activeUniversityById(universityId: string) {
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(universityId)) {
    return null;
  }

  const pool = await getReadyPool();
  const result = await pool.query<{
    id: string;
    slug: string;
    name: string;
    country_code: string | null;
    country_name: string | null;
    city: string | null;
    website_url: string | null;
    email_domains: string[];
    university_email_domain: string;
    status: "active" | "inactive";
    created_at: Date | string;
    updated_at: Date | string;
  }>(
    `SELECT *
       FROM public.universities
      WHERE id = $1::uuid AND status = 'active'
      LIMIT 1`,
    [universityId]
  );
  const row = result.rows[0];
  if (!row) return null;
  const emailDomains = Array.from(new Set([...(row.email_domains || []), row.university_email_domain].filter(Boolean)));
  return {
    id: row.id,
    slug: row.slug,
    name: row.name,
    countryCode: row.country_code,
    countryName: row.country_name,
    city: row.city,
    websiteUrl: row.website_url,
    emailDomains,
    primaryEmailDomain: emailDomains[0] || row.university_email_domain,
    status: row.status,
    createdAt: toIso(row.created_at) || "",
    updatedAt: toIso(row.updated_at) || ""
  } satisfies UniversityRecord;
}

export async function validateClubOtpRecipient(input: {
  universityId: string;
  representativeEmail: string;
  officialEmail: string;
}) {
  const representativeEmail = normalizeEmail(input.representativeEmail);
  const officialEmail = normalizeEmail(input.officialEmail);
  const university = await activeUniversityById(input.universityId);

  if (
    !university ||
    !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(representativeEmail) ||
    !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(officialEmail)
  ) {
    throw new StudentClubError("application_invalid", 422);
  }

  if (!emailDomainMatches(representativeEmail, university) || !emailDomainMatches(officialEmail, university)) {
    throw new StudentClubError("club_email_domain_mismatch", 422);
  }

  return { university, representativeEmail, officialEmail };
}

function mapUploadValidationError(error: unknown, kind: "image" | "document"): never {
  if (error instanceof ClubUploadValidationError) {
    if (error.code === "image_file_too_large" || error.code === "document_file_too_large") {
      throw new StudentClubError(error.code, 413);
    }
    if (error.code === "unsupported_document_type") throw new StudentClubError(error.code, 415);
    throw new StudentClubError(kind === "document" ? "unsupported_document_type" : "unsupported_image_type", 415);
  }
  throw error;
}

async function normalizeHeifUpload(file: File, maximumBytes: number, kind: "image" | "document") {
  try {
    const source = new Uint8Array(await file.arrayBuffer());
    const encoded = await sharp(source, { limitInputPixels: 40_000_000 })
      .rotate()
      .resize({ width: kind === "document" ? 3200 : 2400, height: kind === "document" ? 3200 : 2400, fit: "inside", withoutEnlargement: true })
      .flatten({ background: "#ffffff" })
      .jpeg({ quality: kind === "document" ? 90 : 88, mozjpeg: true })
      .toBuffer();
    if (!encoded.length || encoded.length > maximumBytes) {
      throw new StudentClubError(kind === "document" ? "document_file_too_large" : "image_file_too_large", 413);
    }
    return new File([new Uint8Array(encoded)], "normalized-upload.jpg", {
      type: "image/jpeg",
      lastModified: file.lastModified
    });
  } catch (error) {
    if (error instanceof StudentClubError) throw error;
    console.warn("[student_clubs] heif_normalization_failed", {
      kind,
      byteSize: file.size,
      declaredType: file.type || "unspecified",
      reason: error instanceof Error ? error.name : "unknown"
    });
    throw new StudentClubError(kind === "document" ? "unsupported_document_type" : "unsupported_image_type", 415);
  }
}

async function prepareClubImage(file: File): Promise<PreparedClubUpload> {
  let validated: ValidatedClubUpload;
  try {
    validated = await validateClubImageFile(file);
  } catch (error) {
    return mapUploadValidationError(error, "image");
  }
  if (!validated.isHeif) return { ...validated, file };
  const normalized = await normalizeHeifUpload(file, MAX_CLUB_IMAGE_BYTES, "image");
  return { file: normalized, extension: "jpg", contentType: "image/jpeg", isHeif: false };
}

async function moderateClubLogo(file: File) {
  await assertImageAllowed(file, "club_logo").catch((error) => {
    if (error instanceof Error && error.message === "image_rejected") throw new StudentClubError("image_rejected", 422);
    if (error instanceof Error && error.message === "image_moderation_invalid_input") {
      throw new StudentClubError("unsupported_image_type", 415);
    }
    throw new StudentClubError("image_moderation_unavailable", 503);
  });
}

async function prepareClubDocument(file: File): Promise<PreparedClubUpload> {
  let validated: ValidatedClubUpload;
  try {
    validated = await validateClubDocumentFile(file);
  } catch (error) {
    return mapUploadValidationError(error, "document");
  }
  if (!validated.isHeif) return { ...validated, file };
  const normalized = await normalizeHeifUpload(file, MAX_CLUB_DOCUMENT_BYTES, "document");
  return { file: normalized, extension: "jpg", contentType: "image/jpeg", isHeif: false };
}

async function validateApplication(input: ClubApplicationInput): Promise<ValidatedApplication> {
  const clubName = input.clubName.trim();
  const representativeName = input.representativeName.trim();
  const description = input.description.trim();
  const contactPhone = input.contactPhone?.trim() || null;
  const additionalNote = input.additionalNote?.trim() || null;
  const clubSlug = normalizeClubSlug(input.preferredSlug);

  if (
    !input.agreementAccepted ||
    !fieldLength(clubName, 2, 140) ||
    !fieldLength(representativeName, 2, 80) ||
    !fieldLength(description, 20, 2_000) ||
    clubSlug.length < 3 ||
    CLUB_SLUG_RESERVED.has(clubSlug) ||
    (contactPhone !== null && !/^[+0-9() .-]{6,40}$/.test(contactPhone)) ||
    (additionalNote !== null && additionalNote.length > 1_000)
  ) {
    throw new StudentClubError("application_invalid", 422);
  }

  if (input.password !== input.confirmPassword || !input.password || input.password.length > 128) {
    throw new StudentClubError("invalid_password", 422);
  }

  let representativeUsername: string;
  try {
    representativeUsername = validateCadescaUsername(input.representativeUsername);
  } catch (error) {
    const code = error instanceof Error && error.message === "reserved_username" ? "reserved_username" : "invalid_username";
    throw new StudentClubError(code, 422);
  }

  const emailValidation = await validateClubOtpRecipient(input);
  const websiteUrl = normalizeHttpUrl(input.websiteUrl, true)!;
  const instagramUrl = normalizeHttpUrl(input.instagramUrl, true)!;
  const universityPageUrl = normalizeHttpUrl(input.universityPageUrl || "", false);
  const instagramHost = new URL(instagramUrl).hostname.toLowerCase();
  if (instagramHost !== "instagram.com" && !instagramHost.endsWith(".instagram.com")) {
    throw new StudentClubError("application_invalid", 422);
  }

  const [logoUpload, documentUpload] = await Promise.all([
    prepareClubImage(input.logo),
    prepareClubDocument(input.recognitionDocument)
  ]);

  return {
    ...input,
    university: emailValidation.university,
    clubName,
    clubSlug,
    officialEmail: emailValidation.officialEmail,
    representativeName,
    representativeEmail: emailValidation.representativeEmail,
    representativeUsername,
    description,
    logoUpload,
    documentUpload,
    instagramUrl,
    websiteUrl,
    universityPageUrl,
    contactPhone,
    additionalNote
  };
}

function validateEditableApplication(input: ClubApplicationUpdateInput) {
  const clubName = input.clubName.trim();
  const description = input.description.trim();
  const contactPhone = input.contactPhone?.trim() || null;
  const additionalNote = input.additionalNote?.trim() || null;
  if (
    !fieldLength(clubName, 2, 140) ||
    !fieldLength(description, 20, 2_000) ||
    (contactPhone !== null && !/^[+0-9() .-]{6,40}$/.test(contactPhone)) ||
    (additionalNote !== null && additionalNote.length > 1_000)
  ) {
    throw new StudentClubError("application_invalid", 422);
  }
  return {
    clubName,
    description,
    contactPhone,
    additionalNote
  };
}

export function validateApprovedClubProfile(input: ApprovedClubProfileInput) {
  const clubId = input.clubId.trim();
  const acronym = input.acronym?.trim() || null;
  const category = input.category?.trim() || null;
  const description = input.description.trim();
  const contactEmail = normalizeEmail(input.contactEmail);

  if (
    !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(clubId) ||
    (acronym !== null && !fieldLength(acronym, 2, 20)) ||
    (category !== null && !fieldLength(category, 2, 80)) ||
    !fieldLength(description, 20, 4_000) ||
    contactEmail.length > 254 ||
    !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(contactEmail)
  ) {
    throw new StudentClubError("club_profile_invalid", 422);
  }

  try {
    const websiteUrl = normalizeHttpUrl(input.websiteUrl || "", false);
    const instagramUrl = normalizeHttpUrl(input.instagramUrl || "", false);
    const linkedinUrl = normalizeHttpUrl(input.linkedinUrl || "", false);
    const universityPageUrl = normalizeHttpUrl(input.universityPageUrl || "", false);

    if ([websiteUrl, instagramUrl, linkedinUrl, universityPageUrl].some((value) => value && value.length > 2_048)) {
      throw new StudentClubError("club_profile_invalid", 422);
    }
    if (instagramUrl) {
      const instagramHost = new URL(instagramUrl).hostname.toLowerCase();
      if (instagramHost !== "instagram.com" && !instagramHost.endsWith(".instagram.com")) {
        throw new StudentClubError("club_profile_invalid", 422);
      }
    }

    if (linkedinUrl) {
      const linkedinHost = new URL(linkedinUrl).hostname.toLowerCase();
      if (linkedinHost !== "linkedin.com" && !linkedinHost.endsWith(".linkedin.com")) {
        throw new StudentClubError("club_profile_invalid", 422);
      }
    }

    return { clubId, acronym, category, description, contactEmail, websiteUrl, instagramUrl, linkedinUrl, universityPageUrl };
  } catch (error) {
    if (error instanceof StudentClubError && error.code === "club_profile_invalid") throw error;
    throw new StudentClubError("club_profile_invalid", 422);
  }
}

async function findExistingRepresentative(email: string, username: string) {
  const pool = await getReadyPool();
  const result = await pool.query<ExistingRepresentativeRow>(
    `SELECT *
       FROM public.users
      WHERE lower(email) = lower($1)
         OR lower(coalesce(username, '')) = lower($2)
      ORDER BY lower(email) = lower($1) DESC
      LIMIT 2`,
    [email, username]
  );

  if (!result.rows.length) return null;
  if (result.rows.length !== 1) throw new StudentClubError("application_invalid", 422);
  const user = result.rows[0];
  if (
    normalizeEmail(user.email) !== email ||
    (user.username && user.username.toLowerCase() !== username) ||
    user.status !== "active" ||
    user.deleted_at ||
    user.suspended_at
  ) {
    throw new StudentClubError("application_invalid", 422);
  }

  return user;
}

async function authenticateExistingRepresentative(user: ExistingRepresentativeRow, password: string) {
  if (user.auth_user_id) {
    const authUser = await authenticateSupabaseAuthIdentity({
      email: user.email,
      password
    });
    if (authUser?.id !== user.auth_user_id) {
      throw new StudentClubError("application_invalid", 422);
    }
    return user;
  }

  try {
    const authenticated = await authenticateUserInDb(user.email, password);
    if (authenticated.id !== user.id) throw new Error("identity_mismatch");
    return authenticated;
  } catch {
    throw new StudentClubError("application_invalid", 422);
  }
}

async function uploadApplicationFiles(application: ValidatedApplication, clubId: string) {
  const logoPath = `clubs/${clubId}/logo/${randomUUID()}.${application.logoUpload.extension}`;
  const documentPath = `clubs/${clubId}/verification/${randomUUID()}.${application.documentUpload.extension}`;
  const storage = getSupabaseAdminClient().storage;
  let logoUploaded = false;

  try {
    const { error: logoError } = await storage.from(CLUB_LOGO_BUCKET).upload(logoPath, application.logoUpload.file, {
      cacheControl: "31536000",
      contentType: application.logoUpload.contentType,
      upsert: false
    });
    if (logoError) {
      console.error("[student_clubs] storage_upload_failed", {
        kind: "image",
        bucket: CLUB_LOGO_BUCKET,
        statusCode: "statusCode" in logoError ? logoError.statusCode : undefined,
        reason: logoError.name
      });
      throw new StudentClubError("image_upload_failed", 502);
    }
    logoUploaded = true;

    const { error: documentError } = await storage.from(CLUB_DOCUMENT_BUCKET).upload(documentPath, application.documentUpload.file, {
      cacheControl: "0",
      contentType: application.documentUpload.contentType,
      upsert: false
    });
    if (documentError) {
      console.error("[student_clubs] storage_upload_failed", {
        kind: "document",
        bucket: CLUB_DOCUMENT_BUCKET,
        statusCode: "statusCode" in documentError ? documentError.statusCode : undefined,
        reason: documentError.name
      });
      throw new StudentClubError("document_upload_failed", 502);
    }

    return { logoPath, documentPath };
  } catch (error) {
    if (logoUploaded) await storage.from(CLUB_LOGO_BUCKET).remove([logoPath]).catch(() => undefined);
    await storage.from(CLUB_DOCUMENT_BUCKET).remove([documentPath]).catch(() => undefined);
    if (error instanceof StudentClubError) throw error;
    throw new StudentClubError("upload_failed", 502);
  }
}

async function removeApplicationFiles(paths: { logoPath: string; documentPath: string }) {
  const storage = getSupabaseAdminClient().storage;
  await Promise.all([
    storage.from(CLUB_LOGO_BUCKET).remove([paths.logoPath]).catch(() => undefined),
    storage.from(CLUB_DOCUMENT_BUCKET).remove([paths.documentPath]).catch(() => undefined)
  ]);
}

async function resolveOrCreateAuthIdentity(application: ValidatedApplication, existingUser: ExistingRepresentativeRow | null) {
  if (existingUser?.auth_user_id) {
    return { authUserId: existingUser.auth_user_id };
  }

  try {
    const authUser = await createConfirmedSupabaseAuthUser({
      email: application.representativeEmail,
      password: application.password,
      name: application.representativeName,
      displayName: application.representativeName,
      username: application.representativeUsername,
      universityId: application.university.id,
      verifiedVia: "email",
      acceptedTermsAt: new Date().toISOString()
    });
    // Auth identities are intentionally durable if the later database
    // transaction fails. Retrying is idempotent; synchronous deletion could
    // cascade through a concurrently linked public user.
    return { authUserId: authUser.id };
  } catch (error) {
    if (!(error instanceof SupabaseAuthBridgeError) || error.code !== "email_in_use") {
      throw new StudentClubError("application_invalid", 422);
    }

    const authUser = await authenticateSupabaseAuthIdentity({
      email: application.representativeEmail,
      password: application.password
    });
    if (!authUser?.id) throw new StudentClubError("application_invalid", 422);
    return { authUserId: authUser.id };
  }
}

async function persistClubApplication(input: {
  client: PoolClient;
  application: ValidatedApplication;
  clubId: string;
  logoPath: string;
  documentPath: string;
  verificationId: string;
  existingUser: ExistingRepresentativeRow | null;
  authUserId: string | null;
}) {
  const { client, application } = input;
  await client.query(`SELECT pg_advisory_xact_lock(hashtextextended($1, 0))`, [application.representativeEmail]);

  let user: User;
  if (input.existingUser) {
    if (!input.authUserId) throw new StudentClubError("application_invalid", 422);
    const passwordHash = await hashMerchantPassword(application.password);
    const result = await client.query<User>(
      `UPDATE public.users
          SET username = COALESCE(username, $2),
              university_id = COALESCE(university_id, $3::uuid),
              university_name = COALESCE(university_name, $4),
              university_domain = COALESCE(university_domain, $5),
              email_verified = true,
              password_hash = $7,
              auth_user_id = COALESCE(auth_user_id, $8::uuid),
              updated_at = now()
        WHERE id = $1
          AND lower(email) = lower($6)
          AND status = 'active'
          AND deleted_at IS NULL
          AND suspended_at IS NULL
          AND (auth_user_id IS NULL OR auth_user_id = $8::uuid)
          AND (university_id IS NULL OR university_id = $3::uuid)
          AND (username IS NULL OR lower(username) = lower($2))
      RETURNING *`,
      [
        input.existingUser.id,
        application.representativeUsername,
        application.university.id,
        application.university.name,
        application.university.primaryEmailDomain,
        application.representativeEmail,
        passwordHash,
        input.authUserId
      ]
    );
    if (!result.rows[0]) throw new StudentClubError("application_invalid", 422);
    user = result.rows[0];
  } else {
    if (!input.authUserId) throw new StudentClubError("application_invalid", 422);
    const passwordHash = await hashMerchantPassword(application.password);
    const userId = `user_${input.authUserId.replace(/-/g, "")}`;
    const result = await client.query<User>(
      `INSERT INTO public.users (
         id, auth_user_id, name, email, password_hash, role, status,
         university_id, university_name, university_domain, student_status,
         student_menu_access, email_verified, username, display_name,
         public_profile_enabled, verified_via, accepted_terms_at, created_at, updated_at
       )
       VALUES (
         $1, $2::uuid, $3, $4, $5, 'user', 'active',
         $6::uuid, $7, $8, 'not_verified', false, true, $9, $3,
         true, 'email', now(), now(), now()
       )
       ON CONFLICT (email) DO UPDATE SET
         password_hash = EXCLUDED.password_hash,
         username = EXCLUDED.username,
         display_name = COALESCE(NULLIF(public.users.display_name, ''), EXCLUDED.display_name),
         university_id = COALESCE(public.users.university_id, EXCLUDED.university_id),
         university_name = COALESCE(public.users.university_name, EXCLUDED.university_name),
         university_domain = COALESCE(public.users.university_domain, EXCLUDED.university_domain),
         email_verified = true,
         accepted_terms_at = COALESCE(public.users.accepted_terms_at, EXCLUDED.accepted_terms_at),
         updated_at = now()
       WHERE public.users.auth_user_id = EXCLUDED.auth_user_id
         AND public.users.status = 'active'
         AND public.users.deleted_at IS NULL
         AND (public.users.university_id IS NULL OR public.users.university_id = EXCLUDED.university_id)
       RETURNING *`,
      [
        userId,
        input.authUserId,
        application.representativeName,
        application.representativeEmail,
        passwordHash,
        application.university.id,
        application.university.name,
        application.university.primaryEmailDomain,
        application.representativeUsername
      ]
    );
    if (!result.rows[0]) throw new StudentClubError("application_invalid", 422);
    user = result.rows[0];
  }

  const duplicate = await client.query<{ exists: boolean }>(
    `SELECT EXISTS (
       SELECT 1
         FROM public.club_memberships membership
         JOIN public.student_clubs club ON club.id = membership.club_id
        WHERE membership.user_id = $1
          AND club.status IN ('pending_review', 'clarification_requested', 'approved', 'suspended')
     ) AS exists`,
    [user.id]
  );
  if (duplicate.rows[0]?.exists) throw new StudentClubError("application_conflict", 409);

  await client.query(
    `INSERT INTO public.student_clubs (
       id, university_id, name, slug, description, logo_url,
       official_email, contact_email, website_url, instagram_url,
       university_page_url, verification_document_url, contact_phone,
       additional_note, status, created_at, updated_at
     )
     VALUES (
       $1::uuid, $2::uuid, $3, $4, $5, $6,
       $7, $8, $9, $10, $11, $12, $13, $14,
       'pending_review', now(), now()
     )`,
    [
      input.clubId,
      application.university.id,
      application.clubName,
      application.clubSlug,
      application.description,
      input.logoPath,
      application.officialEmail,
      application.representativeEmail,
      application.websiteUrl,
      application.instagramUrl,
      application.universityPageUrl,
      input.documentPath,
      application.contactPhone,
      application.additionalNote
    ]
  );

  await client.query(
    `INSERT INTO public.club_memberships (
       id, club_id, user_id, role, status, invited_at, created_at, updated_at
     )
     VALUES ($1::uuid, $2::uuid, $3, 'club_owner', 'invited', now(), now(), now())`,
    [randomUUID(), input.clubId, user.id]
  );

  await client.query(
    `INSERT INTO public.event_audit_logs (
       university_id, club_id, actor_user_id, action, metadata, created_at
     )
     VALUES ($1::uuid, $2::uuid, $3, 'club_application_submitted', $4::jsonb, now())`,
    [
      application.university.id,
      input.clubId,
      user.id,
      JSON.stringify({ rulesAccepted: true })
    ]
  );

  await client.query(
    `INSERT INTO public.event_audit_logs (
       university_id, club_id, actor_user_id, action, metadata, created_at
     )
     VALUES ($1::uuid, $2::uuid, $3, 'club_application_otp_verified', $4::jsonb, now())`,
    [
      application.university.id,
      input.clubId,
      user.id,
      JSON.stringify({ purpose: "club_application" })
    ]
  );

  const consumed = await client.query(
    `UPDATE public.email_verification_codes
        SET consumed_at = now()
      WHERE id = $1
        AND email = $2
        AND purpose = 'club_application'
        AND consumed_at IS NULL
        AND expires_at > now()
    RETURNING id`,
    [input.verificationId, application.representativeEmail]
  );
  if (!consumed.rows[0]) throw new StudentClubError("verification_code_invalid", 400);

  return user;
}

export async function submitClubApplication(input: ClubApplicationInput & { otp: string }) {
  const application = await validateApplication(input);
  const verification = await verifyVerificationCode({
    email: application.representativeEmail,
    code: input.otp.trim(),
    purpose: "club_application",
    consume: false
  });
  if (verification.status === "expired") throw new StudentClubError("verification_code_expired", 410);
  if (verification.status === "too_many_attempts") throw new StudentClubError("verification_too_many_attempts", 429);
  if (verification.status !== "verified") throw new StudentClubError("verification_code_invalid", 400);

  const existingUser = await findExistingRepresentative(
    application.representativeEmail,
    application.representativeUsername
  );
  if (!existingUser && !isStrongCadescaPassword(application.password)) {
    throw new StudentClubError("invalid_password", 422);
  }
  if (existingUser) await authenticateExistingRepresentative(existingUser, application.password);
  await moderateClubLogo(application.logoUpload.file);

  const clubId = randomUUID();
  const paths = await uploadApplicationFiles(application, clubId);

  try {
    const identity = await resolveOrCreateAuthIdentity(application, existingUser);
    const pool = await getReadyPool();
    const client = await pool.connect();

    try {
      await client.query("BEGIN");
      const user = await persistClubApplication({
        client,
        application,
        clubId,
        ...paths,
        verificationId: verification.record.id,
        existingUser,
        authUserId: identity.authUserId
      });
      await client.query("COMMIT");
      return { clubId, user };
    } catch (error) {
      await client.query("ROLLBACK").catch(() => undefined);
      throw error;
    } finally {
      client.release();
    }
  } catch (error) {
    await removeApplicationFiles(paths);
    if (error instanceof StudentClubError) throw error;
    if (error instanceof Error && (error.message === "duplicate_username" || error.message === "reserved_username")) {
      throw new StudentClubError("application_invalid", 422);
    }
    const pgCode = typeof error === "object" && error !== null && "code" in error ? String(error.code) : "";
    if (pgCode === "23505") throw new StudentClubError("application_conflict", 409);
    console.error("[student_clubs] application_failed", {
      reason: error instanceof Error ? error.name : "unknown",
      code: pgCode || undefined
    });
    throw error;
  }
}

const EMPTY_APPLICATION_DRAFT: ClubApplicationDraftPayload = {
  universityId: "",
  clubName: "",
  acronym: "",
  category: "",
  description: "",
  officialEmail: "",
  contactPhone: "",
  websiteUrl: "",
  instagramUrl: "",
  linkedinUrl: "",
  otherSocialUrl: "",
  foundedYear: "",
  recognitionStatus: "not_declared",
  president: "",
  vicePresident: "",
  boardMembers: "",
  facultyAdvisor: "",
  additionalNote: ""
};

function sanitizeDraftPayload(value: Partial<ClubApplicationDraftPayload>): ClubApplicationDraftPayload {
  const limits: Record<Exclude<keyof ClubApplicationDraftPayload, "recognitionStatus">, number> = {
    universityId: 36,
    clubName: 140,
    acronym: 20,
    category: 80,
    description: 4_000,
    officialEmail: 254,
    contactPhone: 40,
    websiteUrl: 2_048,
    instagramUrl: 2_048,
    linkedinUrl: 2_048,
    otherSocialUrl: 2_048,
    foundedYear: 4,
    president: 120,
    vicePresident: 120,
    boardMembers: 2_000,
    facultyAdvisor: 160,
    additionalNote: 2_000
  };
  const result = { ...EMPTY_APPLICATION_DRAFT };
  for (const key of Object.keys(limits) as Array<keyof typeof limits>) {
    const next = typeof value[key] === "string" ? value[key]!.trim() : "";
    if (next.length > limits[key]) throw new StudentClubError("application_invalid", 422);
    result[key] = next;
  }
  const status = value.recognitionStatus;
  if (status && ["not_declared", "recognized", "not_recognized", "pending_confirmation"].includes(status)) {
    result.recognitionStatus = status;
  }
  return result;
}

function mapApplicationDraft(row: {
  id: string;
  payload: Partial<ClubApplicationDraftPayload>;
  current_step: number;
  created_at: Date | string;
  updated_at: Date | string;
}): ClubApplicationDraftView {
  return {
    id: row.id,
    payload: sanitizeDraftPayload(row.payload || {}),
    currentStep: Math.min(5, Math.max(1, Number(row.current_step) || 1)),
    createdAt: toIso(row.created_at) || "",
    updatedAt: toIso(row.updated_at) || ""
  };
}

export async function getCurrentClubApplicationDraft(): Promise<ClubApplicationDraftView | null> {
  const user = await getCurrentStudentContext();
  if (!user || user.status !== "active" || user.id === "user_mock") return null;
  const pool = await getReadyPool();
  const result = await pool.query<{
    id: string;
    payload: Partial<ClubApplicationDraftPayload>;
    current_step: number;
    created_at: Date | string;
    updated_at: Date | string;
  }>(
    `select id, payload, current_step, created_at, updated_at
       from public.club_application_drafts
      where applicant_user_id = $1 and status = 'active'
      order by updated_at desc
      limit 1`,
    [user.id]
  );
  return result.rows[0] ? mapApplicationDraft(result.rows[0]) : null;
}

export async function getCurrentClubApplicationDraftById(id: string): Promise<ClubApplicationDraftView | null> {
  if (!/^[0-9a-f-]{36}$/i.test(id)) return null;
  const draft = await getCurrentClubApplicationDraft();
  return draft?.id === id ? draft : null;
}

export async function saveCurrentClubApplicationDraft(input: {
  id?: string | null;
  currentStep: number;
  payload: Partial<ClubApplicationDraftPayload>;
}) {
  const user = await getCurrentStudentContext();
  if (!user || user.status !== "active" || user.id === "user_mock") {
    throw new StudentClubError("authentication_required", 401);
  }
  const payload = sanitizeDraftPayload(input.payload);
  const currentStep = Math.min(5, Math.max(1, Math.trunc(input.currentStep || 1)));
  const university = payload.universityId ? await activeUniversityById(payload.universityId) : null;
  if (payload.universityId && !university) throw new StudentClubError("application_invalid", 422);

  const pool = await getReadyPool();
  const client = await pool.connect();
  try {
    await client.query("begin");
    await client.query(`select pg_advisory_xact_lock(hashtextextended($1, 0))`, [user.id]);
    const existingApplication = await client.query<{ exists: boolean }>(
      `select exists (
         select 1
           from public.club_memberships membership
           join public.student_clubs club on club.id = membership.club_id
          where membership.user_id = $1
            and membership.role = 'club_owner'
            and club.status in ('pending_review', 'clarification_requested')
       ) as exists`,
      [user.id]
    );
    if (existingApplication.rows[0]?.exists) throw new StudentClubError("application_conflict", 409);

    const result = await client.query<{
      id: string;
      payload: Partial<ClubApplicationDraftPayload>;
      current_step: number;
      created_at: Date | string;
      updated_at: Date | string;
    }>(
      `insert into public.club_application_drafts (
         id, applicant_user_id, university_id, payload, current_step, status, created_at, updated_at
       ) values (coalesce($1::uuid, gen_random_uuid()), $2, $3::uuid, $4::jsonb, $5, 'active', now(), now())
       on conflict (applicant_user_id) where status = 'active'
       do update set university_id = excluded.university_id,
                     payload = excluded.payload,
                     current_step = excluded.current_step,
                     updated_at = now()
       returning id, payload, current_step, created_at, updated_at`,
      [input.id || null, user.id, university?.id || null, JSON.stringify(payload), currentStep]
    );
    await client.query("commit");
    return mapApplicationDraft(result.rows[0]);
  } catch (error) {
    await client.query("rollback").catch(() => undefined);
    throw error;
  } finally {
    client.release();
  }
}

/**
 * Creates a pending application for the Cadesca user already authenticated on
 * the shared Cadesca session. Student Club never creates or signs in a second
 * account of its own.
 */
export async function submitAuthenticatedClubApplication(input: AuthenticatedClubApplicationInput) {
  const representative = await getCurrentStudentContext();
  if (!representative || representative.status !== "active" || representative.id === "user_mock") {
    throw new StudentClubError("authentication_required", 401);
  }

  const university = await activeUniversityById(input.universityId);
  const clubName = input.clubName.trim();
  const description = input.description.trim();
  const officialEmail = normalizeEmail(input.officialEmail);
  const acronym = input.acronym?.trim() || null;
  const category = input.category?.trim() || null;
  const contactPhone = input.contactPhone?.trim() || null;
  const additionalNote = input.additionalNote?.trim() || null;
  const clubSlug = normalizeClubSlug(clubName);
  const foundedYear = input.foundedYear || null;
  const recognitionStatus = input.recognitionStatus || "not_declared";

  let websiteUrl: string | null;
  let instagramUrl: string | null;
  let linkedinUrl: string | null;
  let otherSocialUrl: string | null;
  try {
    websiteUrl = normalizeHttpUrl(input.websiteUrl || "", false);
    instagramUrl = normalizeHttpUrl(input.instagramUrl || "", false);
    linkedinUrl = normalizeHttpUrl(input.linkedinUrl || "", false);
    otherSocialUrl = normalizeHttpUrl(input.otherSocialUrl || "", false);
  } catch {
    throw new StudentClubError("application_invalid", 422);
  }

  const leadership = [
    { role: "president", name: input.president?.trim() || "" },
    { role: "vice_president", name: input.vicePresident?.trim() || "" },
    { role: "board_members", name: input.boardMembers?.trim() || "" },
    { role: "faculty_advisor", name: input.facultyAdvisor?.trim() || "" }
  ].filter((entry) => entry.name);

  if (
    !university ||
    (representative.universityId && representative.universityId !== university.id) ||
    !input.agreementAccepted ||
    !fieldLength(clubName, 2, 140) ||
    !fieldLength(description, 20, 4_000) ||
    (acronym !== null && !fieldLength(acronym, 2, 20)) ||
    (category !== null && !fieldLength(category, 2, 80)) ||
    clubSlug.length < 3 ||
    CLUB_SLUG_RESERVED.has(clubSlug) ||
    !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(officialEmail) ||
    (foundedYear !== null && (foundedYear < 1800 || foundedYear > new Date().getFullYear())) ||
    !["not_declared", "recognized", "not_recognized", "pending_confirmation"].includes(recognitionStatus) ||
    (contactPhone !== null && !/^[+0-9() .-]{6,40}$/.test(contactPhone)) ||
    (additionalNote !== null && additionalNote.length > 2_000) ||
    leadership.some((entry) => entry.name.length > (entry.role === "board_members" ? 2_000 : 160))
  ) {
    throw new StudentClubError("application_invalid", 422);
  }

  const [logoUpload, coverUpload, documentUpload] = await Promise.all([
    prepareClubImage(input.logo),
    input.cover ? prepareClubImage(input.cover) : Promise.resolve(null),
    input.recognitionDocument ? prepareClubDocument(input.recognitionDocument) : Promise.resolve(null)
  ]);
  await Promise.all([
    moderateClubLogo(logoUpload.file),
    coverUpload ? moderateClubLogo(coverUpload.file) : Promise.resolve()
  ]);

  const clubId = randomUUID();
  const logoPath = `clubs/${clubId}/logo/${randomUUID()}.${logoUpload.extension}`;
  const coverPath = coverUpload ? `clubs/${clubId}/cover/${randomUUID()}.${coverUpload.extension}` : null;
  const documentPath = documentUpload ? `clubs/${clubId}/verification/${randomUUID()}.${documentUpload.extension}` : null;
  const storage = getSupabaseAdminClient().storage;
  const uploaded: Array<{ bucket: string; path: string }> = [];
  const upload = async (
    kind: "image" | "document",
    bucket: string,
    path: string,
    prepared: PreparedClubUpload,
    cacheControl: string
  ) => {
    const { error } = await storage.from(bucket).upload(path, prepared.file, {
      cacheControl,
      contentType: prepared.contentType,
      upsert: false
    });
    if (error) {
      console.error("[student_clubs] storage_upload_failed", {
        kind,
        bucket,
        statusCode: "statusCode" in error ? error.statusCode : undefined,
        reason: error.name
      });
      throw new StudentClubError(kind === "document" ? "document_upload_failed" : "image_upload_failed", 502);
    }
    uploaded.push({ bucket, path });
  };

  try {
    await upload(
      "image",
      CLUB_LOGO_BUCKET,
      logoPath,
      logoUpload,
      "31536000"
    );
    if (coverPath && coverUpload) {
      await upload(
        "image",
        CLUB_LOGO_BUCKET,
        coverPath,
        coverUpload,
        "31536000"
      );
    }
    if (documentPath && documentUpload) {
      await upload(
        "document",
        CLUB_DOCUMENT_BUCKET,
        documentPath,
        documentUpload,
        "0"
      );
    }
  } catch (error) {
    await Promise.all(uploaded.map((asset) => storage.from(asset.bucket).remove([asset.path]).catch(() => undefined)));
    throw error;
  }

  try {
    const pool = await getReadyPool();
    const client = await pool.connect();
    try {
      await client.query("BEGIN");
      await client.query(`SELECT pg_advisory_xact_lock(hashtextextended($1, 0))`, [representative.id]);

      const duplicateStatuses = process.env.STUDENT_CLUB_ALLOW_MULTIPLE_APPLICATIONS === "true"
        ? ["pending_review", "clarification_requested", "suspended"]
        : ["pending_review", "clarification_requested", "approved", "suspended"];
      const duplicate = await client.query<{ exists: boolean }>(
        `SELECT EXISTS (
           SELECT 1
             FROM public.club_memberships membership
             JOIN public.student_clubs club ON club.id = membership.club_id
            WHERE membership.user_id = $1
              AND club.status = any($2::text[])
         ) AS exists`,
        [representative.id, duplicateStatuses]
      );
      if (duplicate.rows[0]?.exists) throw new StudentClubError("application_conflict", 409);

      await client.query(
        `INSERT INTO public.student_clubs (
           id, university_id, name, slug, description, logo_url,
           official_email, contact_email, website_url, instagram_url,
           university_page_url, verification_document_url, contact_phone,
           additional_note, status, acronym, category, cover_image_url,
           founded_year, official_recognition_status, social_links, leadership,
           application_submitted_at, created_at, updated_at
         )
         VALUES (
           $1::uuid, $2::uuid, $3, $4, $5, $6,
           $7, $8, $9, $10, NULL, $11, $12, $13,
           'pending_review', $14, $15, $16, $17, $18, $19::jsonb, $20::jsonb,
           now(), now(), now()
         )`,
        [
          clubId,
          university.id,
          clubName,
          clubSlug,
          description,
          logoPath,
          officialEmail,
          normalizeEmail(representative.email),
          websiteUrl,
          instagramUrl,
          documentPath,
          contactPhone,
          additionalNote,
          acronym,
          category,
          coverPath,
          foundedYear,
          recognitionStatus,
          JSON.stringify({ linkedin: linkedinUrl, other: otherSocialUrl }),
          JSON.stringify(leadership)
        ]
      );

      await client.query(
        `INSERT INTO public.club_memberships (
           id, club_id, user_id, role, status, invited_at, created_at, updated_at
         ) VALUES ($1::uuid, $2::uuid, $3, 'club_owner', 'invited', now(), now(), now())`,
        [randomUUID(), clubId, representative.id]
      );

      await client.query(
        `INSERT INTO public.event_audit_logs (
           university_id, club_id, actor_user_id, action, metadata, created_at
         ) VALUES ($1::uuid, $2::uuid, $3, 'club_application_submitted', $4::jsonb, now())`,
        [university.id, clubId, representative.id, JSON.stringify({ rulesAccepted: true, authentication: "cadesca" })]
      );

      await client.query(
        `insert into public.club_application_history (
           club_id, actor_user_id, action, snapshot, created_at
         ) values ($1::uuid, $2, 'submitted', $3::jsonb, now())`,
        [clubId, representative.id, JSON.stringify({ clubName, acronym, category, universityId: university.id })]
      );

      await client.query(
        `insert into public.club_audit_logs (
           club_id, actor_user_id, action, entity_type, entity_id, after_data, metadata, created_at
         ) values ($1::uuid, $2, 'club_application_submitted', 'club_application', $1::text, $3::jsonb, $4::jsonb, now())`,
        [
          clubId,
          representative.id,
          JSON.stringify({ status: "pending_review", clubName }),
          JSON.stringify({ rulesAccepted: true, authentication: "cadesca" })
        ]
      );

      const mediaAssets = [
        { path: logoPath, kind: "logo", upload: logoUpload },
        ...(coverPath && coverUpload ? [{ path: coverPath, kind: "cover", upload: coverUpload }] : [])
      ];
      for (const asset of mediaAssets) {
        await client.query(
          `insert into public.club_media_assets (
             club_id, uploaded_by, object_path, media_kind, mime_type, byte_size, created_at
           ) values ($1::uuid, $2, $3, $4, $5, $6, now())`,
          [clubId, representative.id, asset.path, asset.kind, asset.upload.contentType, asset.upload.file.size]
        );
      }

      if (input.draftId) {
        await client.query(
          `update public.club_application_drafts
              set status = 'submitted', submitted_club_id = $1::uuid, submitted_at = now(), updated_at = now()
            where id = $2::uuid and applicant_user_id = $3 and status = 'active'`,
          [clubId, input.draftId, representative.id]
        );
      }

      await client.query("COMMIT");
      return { clubId, status: "pending_review" as const };
    } catch (error) {
      await client.query("ROLLBACK").catch(() => undefined);
      throw error;
    } finally {
      client.release();
    }
  } catch (error) {
    await Promise.all(uploaded.map((asset) => storage.from(asset.bucket).remove([asset.path]).catch(() => undefined)));
    if (error instanceof StudentClubError) throw error;
    const pgCode = typeof error === "object" && error !== null && "code" in error ? String(error.code) : "";
    if (pgCode === "23505") throw new StudentClubError("application_conflict", 409);
    console.error("[student_clubs] authenticated_application_failed", {
      reason: error instanceof Error ? error.name : "unknown",
      code: pgCode || undefined
    });
    throw new StudentClubError("application_save_failed", 500);
  }
}

const CLUB_APPLICATION_SELECT = `
  SELECT
    club.id,
    club.university_id,
    university.name AS university_name,
    club.name,
    club.slug,
    club.description,
    club.status,
    club.logo_url,
    club.official_email,
    club.contact_email,
    club.website_url,
    club.instagram_url,
    club.university_page_url,
    club.verification_document_url,
    club.contact_phone,
    club.additional_note,
    club.rejection_reason,
    club.clarification_message,
    club.suspension_reason,
    latest_message.message AS latest_representative_message,
    representative.id AS representative_id,
    representative.name AS representative_name,
    representative.email AS representative_email,
    representative.username AS representative_username,
    membership.status AS membership_status,
    ARRAY_AGG(DISTINCT membership.role) FILTER (WHERE membership.role IS NOT NULL) AS roles,
    club.created_at,
    club.updated_at,
    club.approved_at,
    club.rejected_at
  FROM public.student_clubs club
  JOIN public.universities university ON university.id = club.university_id
  JOIN public.club_memberships membership
    ON membership.club_id = club.id
   AND membership.role = 'club_owner'
  JOIN public.users representative ON representative.id = membership.user_id
  LEFT JOIN LATERAL (
    SELECT application_message.message
      FROM public.club_application_messages application_message
     WHERE application_message.club_id = club.id
       AND application_message.sender_type = 'representative'
     ORDER BY application_message.created_at DESC
     LIMIT 1
  ) latest_message ON true
`;

const CLUB_APPLICATION_GROUP_BY = `
  GROUP BY
    club.id, university.name, representative.id, representative.name,
    representative.email, representative.username, membership.status,
    latest_message.message
`;

function mapApplication(row: ClubApplicationRow): ClubApplicationView {
  return {
    id: row.id,
    universityId: row.university_id,
    universityName: row.university_name,
    name: row.name,
    slug: row.slug,
    description: row.description,
    status: row.status,
    officialEmail: row.official_email,
    contactEmail: row.contact_email,
    websiteUrl: row.website_url,
    instagramUrl: row.instagram_url,
    universityPageUrl: row.university_page_url,
    contactPhone: row.contact_phone,
    additionalNote: row.additional_note,
    rejectionReason: row.rejection_reason,
    clarificationMessage: row.clarification_message,
    suspensionReason: row.suspension_reason,
    latestRepresentativeMessage: row.latest_representative_message,
    representative: {
      id: row.representative_id,
      name: row.representative_name,
      email: row.representative_email,
      username: row.representative_username
    },
    membershipStatus: row.membership_status,
    roles: row.roles || [],
    logoUrl: row.logo_url ? `/media/club/${encodeURIComponent(row.id)}` : null,
    createdAt: toIso(row.created_at) || "",
    updatedAt: toIso(row.updated_at) || "",
    approvedAt: toIso(row.approved_at),
    rejectedAt: toIso(row.rejected_at)
  };
}

export async function getCurrentClubApplication(): Promise<ClubApplicationView | null> {
  const user = await getCurrentStudentContext();
  if (!user || user.status !== "active") return null;
  if (user.id === "user_mock" && process.env.NODE_ENV === "development") return null;

  const pool = await getReadyPool();
  const result = await pool.query<ClubApplicationRow>(
    `${CLUB_APPLICATION_SELECT}
      WHERE membership.user_id = $1
        AND membership.role = 'club_owner'
      ${CLUB_APPLICATION_GROUP_BY}
      ORDER BY club.created_at DESC
      LIMIT 1`,
    [user.id]
  );
  return result.rows[0] ? mapApplication(result.rows[0]) : null;
}

export async function getCurrentClubApplicationHistory(clubId: string): Promise<ClubApplicationHistoryEntry[]> {
  const user = await getCurrentStudentContext();
  if (!user || user.status !== "active" || !/^[0-9a-f-]{36}$/i.test(clubId)) return [];
  const pool = await getReadyPool();
  const result = await pool.query<{
    id: string;
    action: string;
    reviewer_comment: string | null;
    created_at: Date | string;
  }>(
    `select history.id, history.action, history.reviewer_comment, history.created_at
       from public.club_application_history history
      where history.club_id = $1::uuid
        and exists (
          select 1 from public.club_memberships membership
           where membership.club_id = history.club_id
             and membership.user_id = $2
             and membership.role = 'club_owner'
        )
      order by history.created_at asc`,
    [clubId, user.id]
  );
  return result.rows.map((row) => ({
    id: row.id,
    action: row.action,
    reviewerComment: row.reviewer_comment,
    createdAt: toIso(row.created_at) || ""
  }));
}

export async function listCurrentClubMembershipInvitations(): Promise<ClubMembershipInvitation[]> {
  const user = await getCurrentStudentContext();
  if (!user || user.status !== "active" || user.id === "user_mock") return [];
  const pool = await getReadyPool();
  const result = await pool.query<{
    id: string;
    club_id: string;
    club_name: string;
    university_name: string;
    role: ClubMembershipInvitation["role"];
    invited_at: Date | string;
  }>(
    `SELECT membership.id,
            membership.club_id,
            club.name AS club_name,
            university.name AS university_name,
            membership.role,
            membership.invited_at
       FROM public.club_memberships membership
       JOIN public.student_clubs club
         ON club.id = membership.club_id
        AND club.status = 'approved'
       JOIN public.universities university ON university.id = club.university_id
      WHERE membership.user_id = $1
        AND membership.status = 'invited'
        AND membership.invitation_expires_at > now()
      ORDER BY membership.invited_at DESC NULLS LAST, membership.created_at DESC`,
    [user.id]
  );
  return result.rows.map((row) => ({
    id: row.id,
    clubId: row.club_id,
    clubName: row.club_name,
    universityName: row.university_name,
    role: row.role,
    invitedAt: toIso(row.invited_at) || ""
  }));
}

export async function hasCurrentActiveClubMembership() {
  const user = await getCurrentStudentContext();
  if (!user || user.status !== "active" || user.id === "user_mock") return false;
  const pool = await getReadyPool();
  const result = await pool.query<{ active: boolean }>(
    `SELECT EXISTS (
       SELECT 1
         FROM public.club_memberships membership
         JOIN public.student_clubs club
           ON club.id = membership.club_id
          AND club.status = 'approved'
        WHERE membership.user_id = $1
          AND membership.status = 'active'
     ) AS active`,
    [user.id]
  );
  return Boolean(result.rows[0]?.active);
}

export async function listCurrentManagedClubs(): Promise<ManagedClubSummary[]> {
  const user = await getCurrentStudentContext();
  if (!user || user.status !== "active" || user.id === "user_mock") return [];
  const pool = await getReadyPool();
  const result = await pool.query<{
    id: string;
    name: string;
    slug: string;
    university_name: string;
    logo_url: string | null;
    roles: ClubRole[];
    upcoming_event_count: number;
  }>(
    `SELECT club.id,
            club.name,
            club.slug,
            university.name AS university_name,
            club.logo_url,
            array_agg(distinct membership.role ORDER BY membership.role)::text[] AS roles,
            count(distinct event.id) filter (
              where event.status in ('published', 'sold_out')
                and event.moderation_status = 'active'
                and event.start_at >= now()
            )::int as upcoming_event_count
       FROM public.student_clubs club
       JOIN public.club_memberships membership ON membership.club_id = club.id
       JOIN public.universities university ON university.id = club.university_id
       left join public.events event on event.club_id = club.id
      WHERE membership.user_id = $1
        AND membership.status = 'active'
        AND club.status = 'approved'
      GROUP BY club.id, university.name
      ORDER BY club.name ASC`,
    [user.id]
  );
  return result.rows.map((club) => ({
    id: club.id,
    name: club.name,
    slug: club.slug,
    universityName: club.university_name,
    logoUrl: club.logo_url ? `/media/club/${encodeURIComponent(club.id)}` : null,
    roles: club.roles,
    upcomingEventCount: Number(club.upcoming_event_count || 0)
  }));
}

function requestedPortalDestination(
  requested: string | undefined,
  clubs: ManagedClubSummary[],
  application: ClubApplicationView | null,
  draft: ClubApplicationDraftView | null
) {
  if (!requested) return null;
  if (requested === "/clubs" && clubs.length) return requested;
  if (requested === "/application" && !application) return requested;
  if (draft && requested === `/application/${draft.id}`) return requested;
  if (
    application &&
    (requested === `/application/${application.id}` || requested === `/application/${application.id}/status`)
  ) {
    return requested;
  }

  const dashboard = requested.match(/^\/dashboard\/([a-z0-9](?:[a-z0-9-]{1,90}[a-z0-9])?)(?:\/.*)?$/i);
  if (dashboard && clubs.some((club) => club.slug === dashboard[1])) return requested;
  return null;
}

/**
 * Single post-authentication router for the Student Club client. It derives
 * destinations from trusted membership/application records and never accepts
 * an arbitrary external return URL.
 */
export async function resolveStudentClubDestination(requested?: string) {
  const user = await getCurrentStudentContext();
  if (!user || user.status !== "active") return "/";

  const [clubs, application, draft] = await Promise.all([
    listCurrentManagedClubs(),
    getCurrentClubApplication().catch(() => null),
    getCurrentClubApplicationDraft().catch(() => null)
  ]);
  const safeRequested = requestedPortalDestination(requested, clubs, application, draft);
  if (safeRequested) return safeRequested;

  if (clubs.length === 1) return `/dashboard/${encodeURIComponent(clubs[0].slug)}`;
  if (clubs.length > 1) return "/clubs";
  if (application) return `/application/${encodeURIComponent(application.id)}/status`;
  if (draft) return `/application/${encodeURIComponent(draft.id)}`;
  return "/application";
}

export async function getUserClubAccessSummary(userId: string): Promise<UserClubAccessSummary> {
  const normalizedUserId = userId.trim();
  if (!normalizedUserId || normalizedUserId.length > 160) {
    return {
      available: false,
      hasActiveMembership: false,
      invitationCount: 0,
      gatewayHref: "/app/user/club"
    };
  }

  const pool = await getReadyPool();
  const result = await pool.query<{
    has_active_membership: boolean;
    invitation_count: number;
  }>(
    `SELECT EXISTS (
       SELECT 1
         FROM public.club_memberships membership
         JOIN public.student_clubs club
           ON club.id = membership.club_id
          AND club.status = 'approved'
        WHERE membership.user_id = $1
          AND membership.status = 'active'
     ) AS has_active_membership,
     (
       SELECT count(*)::int
         FROM public.club_memberships membership
         JOIN public.student_clubs club
           ON club.id = membership.club_id
          AND club.status = 'approved'
        WHERE membership.user_id = $1
          AND membership.status = 'invited'
     ) AS invitation_count`,
    [normalizedUserId]
  );
  return {
    available: true,
    hasActiveMembership: Boolean(result.rows[0]?.has_active_membership),
    invitationCount: Math.max(0, Number(result.rows[0]?.invitation_count || 0)),
    gatewayHref: "/app/user/club"
  };
}

async function signedStorageUrl(bucket: string, path: string | null) {
  if (!path || path.startsWith("/") || path.includes("..")) return null;
  const { data, error } = await getSupabaseAdminClient().storage.from(bucket).createSignedUrl(path, 10 * 60);
  return error ? null : data.signedUrl;
}

export async function listClubApplicationsForAdmin(
  status: ClubApplicationStatus | "all" = "pending_review"
): Promise<AdminClubApplication[]> {
  const pool = await getReadyPool();
  const values: string[] = [];
  const where = status === "all" ? "" : "WHERE club.status = $1";
  if (status !== "all") values.push(status);
  const result = await pool.query<ClubApplicationRow>(
    `${CLUB_APPLICATION_SELECT}
      ${where}
      ${CLUB_APPLICATION_GROUP_BY}
      ORDER BY club.created_at DESC
      LIMIT 100`,
    values
  );

  return Promise.all(result.rows.map(async (row) => ({
    ...mapApplication(row),
    logoPreviewUrl: await signedStorageUrl(CLUB_LOGO_BUCKET, row.logo_url),
    verificationDocumentUrl: row.verification_document_url
      ? `/api/admin/club-applications/${encodeURIComponent(row.id)}/document`
      : null
  })));
}

export async function downloadClubVerificationDocumentForAdmin(clubId: string) {
  if (!/^[0-9a-f-]{36}$/i.test(clubId)) return null;
  const pool = await getReadyPool();
  const result = await pool.query<{ verification_document_url: string | null }>(
    `SELECT verification_document_url
       FROM public.student_clubs
      WHERE id = $1::uuid
      LIMIT 1`,
    [clubId]
  );
  const path = result.rows[0]?.verification_document_url;
  if (!safeClubStoragePath(clubId, path)) return null;
  const { data, error } = await getSupabaseAdminClient().storage.from(CLUB_DOCUMENT_BUCKET).download(path!);
  if (error || !data) return null;
  const extension = path!.split(".").pop()?.toLowerCase();
  const safeExtension = extension === "pdf" || extension === "jpg" || extension === "png" ? extension : "bin";
  return {
    body: data,
    filename: `club-verification-${clubId}.${safeExtension}`,
    size: data.size
  };
}

type PendingOwnerApplication = {
  id: string;
  university_id: string;
  logo_url: string | null;
  verification_document_url: string;
  status: "pending_review" | "clarification_requested" | "rejected";
  user_id: string;
  updated_at: Date | string;
};

async function requirePendingOwnerApplication() {
  const user = await getCurrentStudentContext();
  if (!user || user.status !== "active" || user.id === "user_mock") {
    throw new StudentClubError("authentication_required", 401);
  }
  const pool = await getReadyPool();
  const result = await pool.query<PendingOwnerApplication>(
    `SELECT club.id,
            club.university_id,
            club.logo_url,
            club.verification_document_url,
            club.status,
            membership.user_id,
            club.updated_at
       FROM public.student_clubs club
       JOIN public.club_memberships membership
         ON membership.club_id = club.id
        AND membership.user_id = $1
        AND membership.role = 'club_owner'
        AND membership.status = 'invited'
      WHERE club.status IN ('pending_review', 'clarification_requested', 'rejected')
      ORDER BY club.created_at DESC
      LIMIT 1`,
    [user.id]
  );
  if (!result.rows[0]) throw new StudentClubError("application_not_found", 404);
  return { user, application: result.rows[0] };
}

function safeClubStoragePath(clubId: string, path: string | null | undefined) {
  return Boolean(path && path.startsWith(`clubs/${clubId}/`) && !path.includes("..") && !path.startsWith("/"));
}

async function uploadClubLogoObject(clubId: string, logo: File) {
  const prepared = await prepareClubImage(logo);
  await moderateClubLogo(prepared.file);
  const logoPath = `clubs/${clubId}/logo/${randomUUID()}.${prepared.extension}`;
  const storage = getSupabaseAdminClient().storage;
  const { error } = await storage.from(CLUB_LOGO_BUCKET).upload(logoPath, prepared.file, {
    cacheControl: "31536000",
    contentType: prepared.contentType,
    upsert: false
  });
  if (error) {
    console.error("[student_clubs] storage_upload_failed", {
      kind: "image",
      bucket: CLUB_LOGO_BUCKET,
      statusCode: "statusCode" in error ? error.statusCode : undefined,
      reason: error.name
    });
    await storage.from(CLUB_LOGO_BUCKET).remove([logoPath]).catch(() => undefined);
    throw new StudentClubError("image_upload_failed", 502);
  }
  return logoPath;
}

async function uploadClubCoverObject(clubId: string, cover: File) {
  const prepared = await prepareClubImage(cover);
  await moderateClubLogo(prepared.file);
  const coverPath = `clubs/${clubId}/cover/${randomUUID()}.${prepared.extension}`;
  const storage = getSupabaseAdminClient().storage;
  const { error } = await storage.from(CLUB_LOGO_BUCKET).upload(coverPath, prepared.file, {
    cacheControl: "31536000",
    contentType: prepared.contentType,
    upsert: false
  });
  if (error) {
    console.error("[student_clubs] storage_upload_failed", {
      kind: "image",
      bucket: CLUB_LOGO_BUCKET,
      statusCode: "statusCode" in error ? error.statusCode : undefined,
      reason: error.name
    });
    await storage.from(CLUB_LOGO_BUCKET).remove([coverPath]).catch(() => undefined);
    throw new StudentClubError("image_upload_failed", 502);
  }
  return coverPath;
}

async function uploadClubApplicationReplacements(input: {
  clubId: string;
  logo?: File | null;
  recognitionDocument?: File | null;
}) {
  let logoPath: string | null = null;
  let documentPath: string | null = null;
  const storage = getSupabaseAdminClient().storage;

  try {
    if (input.logo) {
      logoPath = await uploadClubLogoObject(input.clubId, input.logo);
    }

    if (input.recognitionDocument) {
      const prepared = await prepareClubDocument(input.recognitionDocument);
      documentPath = `clubs/${input.clubId}/verification/${randomUUID()}.${prepared.extension}`;
      const { error } = await storage.from(CLUB_DOCUMENT_BUCKET).upload(documentPath, prepared.file, {
        cacheControl: "0",
        contentType: prepared.contentType,
        upsert: false
      });
      if (error) {
        console.error("[student_clubs] storage_upload_failed", {
          kind: "document",
          bucket: CLUB_DOCUMENT_BUCKET,
          statusCode: "statusCode" in error ? error.statusCode : undefined,
          reason: error.name
        });
        throw new StudentClubError("document_upload_failed", 502);
      }
    }
    return { logoPath, documentPath };
  } catch (error) {
    if (logoPath) await storage.from(CLUB_LOGO_BUCKET).remove([logoPath]).catch(() => undefined);
    if (documentPath) await storage.from(CLUB_DOCUMENT_BUCKET).remove([documentPath]).catch(() => undefined);
    if (error instanceof StudentClubError) throw error;
    throw new StudentClubError("upload_failed", 502);
  }
}

export async function updateCurrentClubApplication(input: ClubApplicationUpdateInput) {
  const { user, application } = await requirePendingOwnerApplication();
  const fields = validateEditableApplication(input);
  const replacements = await uploadClubApplicationReplacements({
    clubId: application.id,
    logo: input.logo,
    recognitionDocument: null
  });
  const pool = await getReadyPool();
  const client = await pool.connect();

  try {
    await client.query("BEGIN");
    const updated = await client.query(
      `UPDATE public.student_clubs club
          SET name = $3,
              description = $4,
              contact_phone = $5,
              additional_note = $6,
              logo_url = COALESCE($7, logo_url),
              updated_at = now()
        WHERE club.id = $1::uuid
          AND club.updated_at = $8::timestamptz
          AND club.status IN ('pending_review', 'clarification_requested', 'rejected')
          AND EXISTS (
            SELECT 1
              FROM public.club_memberships membership
             WHERE membership.club_id = club.id
               AND membership.user_id = $2
               AND membership.role = 'club_owner'
               AND membership.status = 'invited'
          )
      RETURNING club.id`,
      [
        application.id,
        user.id,
        fields.clubName,
        fields.description,
        fields.contactPhone,
        fields.additionalNote,
        replacements.logoPath,
        application.updated_at
      ]
    );
    if (!updated.rows[0]) throw new StudentClubError("review_conflict", 409);

    const changedFields = [
      "name", "description",
      "contact_phone", "additional_note",
      ...(replacements.logoPath ? ["logo_url"] : [])
    ];
    await client.query(
      `INSERT INTO public.event_audit_logs (
         university_id, club_id, actor_user_id, action, metadata, created_at
       )
       VALUES ($1::uuid, $2::uuid, $3, 'club_application_updated', $4::jsonb, now())`,
      [application.university_id, application.id, user.id, JSON.stringify({ changedFields })]
    );
    await client.query(
      `insert into public.club_application_history (club_id, actor_user_id, action, snapshot)
       values ($1::uuid, $2, 'application_edited', $3::jsonb)`,
      [application.id, user.id, JSON.stringify({ changedFields })]
    );
    await client.query(
      `insert into public.club_audit_logs (
         club_id, actor_user_id, action, entity_type, entity_id, before_data, after_data, metadata
       ) values ($1::uuid, $2, 'club_application_updated', 'club_application', $1::text, $3::jsonb, $4::jsonb, $5::jsonb)`,
      [
        application.id,
        user.id,
        JSON.stringify({ updatedAt: application.updated_at }),
        JSON.stringify({ clubName: fields.clubName, description: fields.description, contactPhone: fields.contactPhone, additionalNote: fields.additionalNote }),
        JSON.stringify({ changedFields })
      ]
    );
    await client.query("COMMIT");
  } catch (error) {
    await client.query("ROLLBACK").catch(() => undefined);
    if (replacements.logoPath) {
      await getSupabaseAdminClient().storage.from(CLUB_LOGO_BUCKET).remove([replacements.logoPath]).catch(() => undefined);
    }
    if (replacements.documentPath) {
      await getSupabaseAdminClient().storage.from(CLUB_DOCUMENT_BUCKET).remove([replacements.documentPath]).catch(() => undefined);
    }
    throw error;
  } finally {
    client.release();
  }

  if (replacements.logoPath && safeClubStoragePath(application.id, application.logo_url)) {
    await getSupabaseAdminClient().storage.from(CLUB_LOGO_BUCKET).remove([application.logo_url!]).catch(() => undefined);
  }
  if (replacements.documentPath && safeClubStoragePath(application.id, application.verification_document_url)) {
    await getSupabaseAdminClient().storage.from(CLUB_DOCUMENT_BUCKET).remove([application.verification_document_url]).catch(() => undefined);
  }
  return getCurrentClubApplication();
}

export async function updateApprovedClubProfile(input: ApprovedClubProfileInput) {
  const user = await getCurrentStudentContext();
  if (!user || user.status !== "active" || user.id === "user_mock") {
    throw new StudentClubError("authentication_required", 401);
  }
  const fields = validateApprovedClubProfile(input);
  const pool = await getReadyPool();
  const authorization = await pool.query<{ allowed: boolean }>(
    `SELECT EXISTS (
       SELECT 1
         FROM public.student_clubs club
         JOIN public.club_memberships membership ON membership.club_id = club.id
        WHERE club.id = $1::uuid
          AND club.status = 'approved'
          AND membership.user_id = $2
          AND membership.role = any($3::text[])
          AND membership.status = 'active'
     ) AS allowed`,
    [fields.clubId, user.id, rolesWithClubCapability("club.profile.update")]
  );
  if (!authorization.rows[0]?.allowed) {
    throw new StudentClubError("club_profile_access_denied", 403);
  }
  const replacementLogoPath = input.logo?.size
    ? await uploadClubLogoObject(fields.clubId, input.logo)
    : null;
  const replacementCoverPath = input.cover?.size
    ? await uploadClubCoverObject(fields.clubId, input.cover).catch(async (error) => {
        if (replacementLogoPath) await getSupabaseAdminClient().storage.from(CLUB_LOGO_BUCKET).remove([replacementLogoPath]).catch(() => undefined);
        throw error;
      })
    : null;
  let client: PoolClient | null = null;
  let previousLogoPath: string | null = null;
  let previousCoverPath: string | null = null;
  let changedFields: string[] = [];

  try {
    client = await pool.connect();
    await client.query("BEGIN");
    const clubResult = await client.query<{
      id: string;
      university_id: string;
      acronym: string | null;
      category: string | null;
      description: string;
      contact_email: string;
      website_url: string | null;
      instagram_url: string | null;
      social_links: Record<string, unknown>;
      university_page_url: string | null;
      logo_url: string | null;
      cover_image_url: string | null;
      status: ClubApplicationStatus;
    }>(
      `SELECT club.id,
              club.university_id,
              club.acronym,
              club.category,
              club.description,
              club.contact_email,
              club.website_url,
              club.instagram_url,
              club.social_links,
              club.university_page_url,
              club.logo_url,
              club.cover_image_url,
              club.status
         FROM public.student_clubs club
        WHERE club.id = $1::uuid
        FOR UPDATE`,
      [fields.clubId]
    );
    const club = clubResult.rows[0];
    if (!club) throw new StudentClubError("club_profile_access_denied", 403);

    const membershipResult = await client.query<{ id: string }>(
      `SELECT membership.id
         FROM public.club_memberships membership
        WHERE membership.club_id = $1::uuid
          AND membership.user_id = $2
          AND membership.role = any($3::text[])
          AND membership.status = 'active'
        LIMIT 1
        FOR SHARE`,
      [fields.clubId, user.id, rolesWithClubCapability("club.profile.update")]
    );
    if (!membershipResult.rows[0]) throw new StudentClubError("club_profile_access_denied", 403);
    if (club.status !== "approved") throw new StudentClubError("club_profile_not_editable", 409);

    changedFields = [
      ...(club.acronym !== fields.acronym ? ["acronym"] : []),
      ...(club.category !== fields.category ? ["category"] : []),
      ...(club.description !== fields.description ? ["description"] : []),
      ...(club.contact_email !== fields.contactEmail ? ["contact_email"] : []),
      ...(club.website_url !== fields.websiteUrl ? ["website_url"] : []),
      ...(club.instagram_url !== fields.instagramUrl ? ["instagram_url"] : []),
      ...((typeof club.social_links?.linkedin === "string" ? club.social_links.linkedin : null) !== fields.linkedinUrl ? ["linkedin_url"] : []),
      ...(club.university_page_url !== fields.universityPageUrl ? ["university_page_url"] : []),
      ...(replacementLogoPath ? ["logo_url"] : []),
      ...(replacementCoverPath ? ["cover_image_url"] : [])
    ];
    previousLogoPath = club.logo_url;
    previousCoverPath = club.cover_image_url;

    if (changedFields.length) {
      const updated = await client.query(
        `UPDATE public.student_clubs club
            SET acronym = $3,
                category = $4,
                description = $5,
                contact_email = $6,
                website_url = $7,
                instagram_url = $8,
                social_links = jsonb_strip_nulls(club.social_links || jsonb_build_object('linkedin', $9::text)),
                university_page_url = $10,
                logo_url = COALESCE($11, club.logo_url),
                cover_image_url = COALESCE($12, club.cover_image_url),
                updated_at = now()
          WHERE club.id = $1::uuid
            AND club.status = 'approved'
            AND EXISTS (
              SELECT 1
                FROM public.club_memberships membership
               WHERE membership.club_id = club.id
                 AND membership.user_id = $2
                 AND membership.role = any($13::text[])
                 AND membership.status = 'active'
            )
        RETURNING club.id`,
        [
          fields.clubId,
          user.id,
          fields.acronym,
          fields.category,
          fields.description,
          fields.contactEmail,
          fields.websiteUrl,
          fields.instagramUrl,
          fields.linkedinUrl,
          fields.universityPageUrl,
          replacementLogoPath,
          replacementCoverPath,
          rolesWithClubCapability("club.profile.update")
        ]
      );
      if (!updated.rows[0]) throw new StudentClubError("club_profile_not_editable", 409);

      await client.query(
        `INSERT INTO public.event_audit_logs (
           university_id, club_id, actor_user_id, action, metadata, created_at
         )
         VALUES ($1::uuid, $2::uuid, $3, 'club_profile_updated', $4::jsonb, now())`,
        [club.university_id, fields.clubId, user.id, JSON.stringify({ changedFields })]
      );
      await client.query(
        `insert into public.club_audit_logs (
           club_id, actor_user_id, action, entity_type, entity_id, before_data, after_data, metadata
         ) values ($1::uuid, $2, 'club_profile_updated', 'club', $1::text, $3::jsonb, $4::jsonb, '{}'::jsonb)`,
        [
          fields.clubId,
          user.id,
          JSON.stringify({ acronym: club.acronym, category: club.category, description: club.description, contactEmail: club.contact_email, websiteUrl: club.website_url, instagramUrl: club.instagram_url, linkedinUrl: typeof club.social_links?.linkedin === "string" ? club.social_links.linkedin : null, universityPageUrl: club.university_page_url }),
          JSON.stringify({ acronym: fields.acronym, category: fields.category, description: fields.description, contactEmail: fields.contactEmail, websiteUrl: fields.websiteUrl, instagramUrl: fields.instagramUrl, linkedinUrl: fields.linkedinUrl, universityPageUrl: fields.universityPageUrl })
        ]
      );
      const insertedMedia = [
        ...(replacementLogoPath && input.logo ? [{ path: replacementLogoPath, kind: "logo", file: input.logo }] : []),
        ...(replacementCoverPath && input.cover ? [{ path: replacementCoverPath, kind: "cover", file: input.cover }] : [])
      ];
      for (const replacedPath of [replacementLogoPath ? previousLogoPath : null, replacementCoverPath ? previousCoverPath : null].filter((value): value is string => Boolean(value))) {
        await client.query(
          `update public.club_media_assets set deleted_at = now(), deleted_by = $2
            where club_id = $1::uuid and storage_bucket = 'event-assets' and object_path = $3 and deleted_at is null`,
          [fields.clubId, user.id, replacedPath]
        );
      }
      for (const asset of insertedMedia) {
        await client.query(
          `insert into public.club_media_assets (club_id, uploaded_by, object_path, media_kind, mime_type, byte_size)
           values ($1::uuid, $2, $3, $4, $5, $6)`,
          [fields.clubId, user.id, asset.path, asset.kind, asset.file.type.toLowerCase(), asset.file.size]
        );
      }
    }
    await client.query("COMMIT");
  } catch (error) {
    await client?.query("ROLLBACK").catch(() => undefined);
    if (replacementLogoPath) {
      await getSupabaseAdminClient().storage.from(CLUB_LOGO_BUCKET).remove([replacementLogoPath]).catch(() => undefined);
    }
    if (replacementCoverPath) {
      await getSupabaseAdminClient().storage.from(CLUB_LOGO_BUCKET).remove([replacementCoverPath]).catch(() => undefined);
    }
    throw error;
  } finally {
    client?.release();
  }

  if (
    replacementLogoPath &&
    previousLogoPath !== replacementLogoPath &&
    safeClubStoragePath(fields.clubId, previousLogoPath)
  ) {
    await getSupabaseAdminClient().storage.from(CLUB_LOGO_BUCKET).remove([previousLogoPath!]).catch(() => undefined);
  }
  if (
    replacementCoverPath &&
    previousCoverPath !== replacementCoverPath &&
    safeClubStoragePath(fields.clubId, previousCoverPath)
  ) {
    await getSupabaseAdminClient().storage.from(CLUB_LOGO_BUCKET).remove([previousCoverPath!]).catch(() => undefined);
  }

  return { clubId: fields.clubId, changedFields };
}

export async function respondToClubClarification(messageInput: string) {
  const { user, application } = await requirePendingOwnerApplication();
  const message = messageInput.trim();
  if (message.length < 2 || message.length > 2_000) throw new StudentClubError("application_invalid", 422);
  if (!(["clarification_requested", "rejected"] as ClubApplicationStatus[]).includes(application.status)) throw new StudentClubError("review_conflict", 409);
  const pool = await getReadyPool();
  const client = await pool.connect();

  try {
    await client.query("BEGIN");
    const updated = await client.query(
      `UPDATE public.student_clubs club
          SET status = 'pending_review',
              application_resubmitted_at = now(),
              rejected_at = null,
              rejected_by = null,
              rejection_reason = null,
              clarification_message = null,
              updated_at = now()
        WHERE club.id = $1::uuid
          AND club.status IN ('clarification_requested', 'rejected')
          AND EXISTS (
            SELECT 1
              FROM public.club_memberships membership
             WHERE membership.club_id = club.id
               AND membership.user_id = $2
               AND membership.role = 'club_owner'
               AND membership.status = 'invited'
          )
      RETURNING club.id`,
      [application.id, user.id]
    );
    if (!updated.rows[0]) throw new StudentClubError("review_conflict", 409);
    await client.query(
      `INSERT INTO public.club_application_messages (
         club_id, sender_user_id, sender_type, message, created_at
       )
       VALUES ($1::uuid, $2, 'representative', $3, now())`,
      [application.id, user.id, message]
    );
    await client.query(
      `INSERT INTO public.event_audit_logs (
         university_id, club_id, actor_user_id, action, metadata, created_at
       )
       VALUES ($1::uuid, $2::uuid, $3, $4, '{}'::jsonb, now())`,
      [application.university_id, application.id, user.id, application.status === "rejected" ? "club_application_resubmitted" : "club_application_clarification_responded"]
    );
    await client.query(
      `insert into public.club_application_history (club_id, actor_user_id, action, snapshot)
       values ($1::uuid, $2, 'resubmitted', jsonb_build_object('response_recorded', true))`,
      [application.id, user.id]
    );
    await client.query(
      `insert into public.club_audit_logs (
         club_id, actor_user_id, action, entity_type, entity_id, after_data, metadata
       ) values ($1::uuid, $2, 'club_application_resubmitted', 'club_application', $1::text,
                 jsonb_build_object('status', 'pending_review'), jsonb_build_object('response_length', $3::int))`,
      [application.id, user.id, message.length]
    );
    await client.query("COMMIT");
  } catch (error) {
    await client.query("ROLLBACK").catch(() => undefined);
    throw error;
  } finally {
    client.release();
  }
  return getCurrentClubApplication();
}

export async function moderateClubStatus(input: {
  clubId: string;
  action: "suspend" | "reactivate";
  actorEmail: string;
  reason?: string | null;
}) {
  if (!/^[0-9a-f-]{36}$/i.test(input.clubId)) throw new StudentClubError("review_invalid", 422);
  const reason = input.reason?.trim().slice(0, 2_000) || null;
  if (input.action === "suspend" && (!reason || reason.length < 2)) {
    throw new StudentClubError("review_invalid", 422);
  }
  const actorHash = adminActorHash(input.actorEmail);
  const pool = await getReadyPool();
  const client = await pool.connect();

  try {
    await client.query("BEGIN");
    const clubResult = await client.query<{ status: ClubApplicationStatus; university_id: string }>(
      `SELECT status, university_id FROM public.student_clubs WHERE id = $1::uuid FOR UPDATE`,
      [input.clubId]
    );
    const club = clubResult.rows[0];
    if (!club) throw new StudentClubError("application_not_found", 404);

    if (input.action === "suspend") {
      if (club.status !== "approved") throw new StudentClubError("review_conflict", 409);
      const suspendedMemberships = await client.query<{ id: string }>(
        `UPDATE public.club_memberships
            SET status = 'suspended', updated_at = now()
          WHERE club_id = $1::uuid AND status = 'active'
        RETURNING id`,
        [input.clubId]
      );
      if (!suspendedMemberships.rowCount) throw new StudentClubError("review_conflict", 409);
      await client.query(
        `UPDATE public.student_clubs
            SET status = 'suspended',
                suspended_at = now(),
                suspended_by = $2,
                suspension_reason = $3,
                updated_at = now()
          WHERE id = $1::uuid`,
        [input.clubId, actorHash, reason]
      );
      await client.query(
        `INSERT INTO public.event_audit_logs (university_id, club_id, action, metadata, created_at)
         VALUES ($1::uuid, $2::uuid, 'club_suspended', $3::jsonb, now())`,
        [
          club.university_id,
          input.clubId,
          JSON.stringify({ adminHash: actorHash, reason, membershipIds: suspendedMemberships.rows.map((row) => row.id) })
        ]
      );
      await client.query(
        `insert into public.club_audit_logs (
           club_id, actor_admin_hash, action, entity_type, entity_id, before_data, after_data, metadata
         ) values ($1::uuid, $2, 'club_suspended', 'club', $1::text,
                   jsonb_build_object('status', 'approved'), jsonb_build_object('status', 'suspended'),
                   jsonb_build_object('has_reason', $3::boolean))`,
        [input.clubId, actorHash, Boolean(reason)]
      );
    } else {
      if (club.status !== "suspended") throw new StudentClubError("review_conflict", 409);
      const auditResult = await client.query<{ membership_ids: string[] | null }>(
        `SELECT ARRAY(
           SELECT jsonb_array_elements_text(audit.metadata -> 'membershipIds')
         ) AS membership_ids
           FROM public.event_audit_logs audit
          WHERE audit.club_id = $1::uuid
            AND audit.action = 'club_suspended'
          ORDER BY audit.created_at DESC
          LIMIT 1`,
        [input.clubId]
      );
      const membershipIds = auditResult.rows[0]?.membership_ids || [];
      if (!membershipIds.length) throw new StudentClubError("review_conflict", 409);
      const restored = await client.query(
        `UPDATE public.club_memberships
            SET status = 'active', updated_at = now()
          WHERE club_id = $1::uuid
            AND id = ANY($2::uuid[])
            AND status = 'suspended'
        RETURNING id`,
        [input.clubId, membershipIds]
      );
      if (!restored.rowCount) throw new StudentClubError("review_conflict", 409);
      await client.query(
        `UPDATE public.student_clubs
            SET status = 'approved',
                suspended_at = NULL,
                suspended_by = NULL,
                suspension_reason = NULL,
                updated_at = now()
          WHERE id = $1::uuid`,
        [input.clubId]
      );
      await client.query(
        `INSERT INTO public.event_audit_logs (university_id, club_id, action, metadata, created_at)
         VALUES ($1::uuid, $2::uuid, 'club_reactivated', $3::jsonb, now())`,
        [club.university_id, input.clubId, JSON.stringify({ adminHash: actorHash, restoredMembershipIds: membershipIds })]
      );
      await client.query(
        `insert into public.club_audit_logs (
           club_id, actor_admin_hash, action, entity_type, entity_id, before_data, after_data, metadata
         ) values ($1::uuid, $2, 'club_reactivated', 'club', $1::text,
                   jsonb_build_object('status', 'suspended'), jsonb_build_object('status', 'approved'), '{}'::jsonb)`,
        [input.clubId, actorHash]
      );
    }
    await client.query("COMMIT");
  } catch (error) {
    await client.query("ROLLBACK").catch(() => undefined);
    throw error;
  } finally {
    client.release();
  }
}

export async function reviewClubApplication(input: {
  clubId: string;
  decision: ClubReviewDecision;
  actorEmail: string;
  message?: string | null;
}) {
  if (!/^[0-9a-f-]{36}$/i.test(input.clubId)) throw new StudentClubError("review_invalid", 422);
  const message = input.message?.trim().slice(0, 2_000) || null;
  if ((input.decision === "reject" || input.decision === "request_clarification") && (!message || message.length < 2)) {
    throw new StudentClubError("review_invalid", 422);
  }
  const actorHash = adminActorHash(input.actorEmail);

  const pool = await getReadyPool();
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const locked = await client.query<{ status: ClubApplicationStatus }>(
      `SELECT status FROM public.student_clubs WHERE id = $1::uuid FOR UPDATE`,
      [input.clubId]
    );
    const current = locked.rows[0]?.status;
    if (!current) throw new StudentClubError("application_not_found", 404);
    if (!['pending_review', 'clarification_requested'].includes(current)) {
      throw new StudentClubError("review_conflict", 409);
    }

    if (input.decision === "approve") {
      await client.query(
        `UPDATE public.student_clubs
            SET status = 'approved',
                approved_at = now(),
                approved_by = $2,
                rejected_at = NULL,
                rejected_by = NULL,
                rejection_reason = NULL,
                clarification_message = NULL,
                updated_at = now()
          WHERE id = $1::uuid`,
        [input.clubId, actorHash]
      );
      const activated = await client.query(
        `UPDATE public.club_memberships
            SET status = 'active', accepted_at = COALESCE(accepted_at, now()), updated_at = now()
          WHERE club_id = $1::uuid AND role = 'club_owner' AND status = 'invited'`,
        [input.clubId]
      );
      if (!activated.rowCount) throw new StudentClubError("review_conflict", 409);
    } else if (input.decision === "reject") {
      await client.query(
        `UPDATE public.student_clubs
            SET status = 'rejected',
                rejected_at = now(),
                rejected_by = $2,
                rejection_reason = $3,
                clarification_message = NULL,
                updated_at = now()
          WHERE id = $1::uuid`,
        [input.clubId, actorHash, message]
      );
    } else {
      await client.query(
        `UPDATE public.student_clubs
            SET status = 'clarification_requested',
                clarification_message = $2,
                updated_at = now()
          WHERE id = $1::uuid`,
        [input.clubId, message]
      );
    }

    if (message) {
      await client.query(
        `INSERT INTO public.club_application_messages (
           club_id, sender_admin_hash, sender_type, message, created_at
         )
         VALUES ($1::uuid, $2, 'admin', $3, now())`,
        [input.clubId, actorHash, message]
      );
    }

    await client.query(
      `INSERT INTO public.event_audit_logs (university_id, club_id, action, metadata, created_at)
       SELECT club.university_id,
              club.id,
              $2,
              jsonb_build_object('admin_hash', $3::text, 'decision', $4::text),
              now()
         FROM public.student_clubs club
        WHERE club.id = $1::uuid`,
      [input.clubId, `club_application_${input.decision}`, actorHash, input.decision]
    );
    const historyAction = input.decision === "approve" ? "approved" : input.decision === "reject" ? "rejected" : "changes_requested";
    const nextStatus = input.decision === "approve" ? "approved" : input.decision === "reject" ? "rejected" : "clarification_requested";
    await client.query(
      `insert into public.club_application_history (
         club_id, actor_admin_hash, action, reviewer_comment, snapshot
       ) values ($1::uuid, $2, $3, $4, jsonb_build_object('status', $5::text))`,
      [input.clubId, actorHash, historyAction, message, nextStatus]
    );
    await client.query(
      `insert into public.club_audit_logs (
         club_id, actor_admin_hash, action, entity_type, entity_id, before_data, after_data, metadata
       ) values ($1::uuid, $2, $3, 'club_application', $1::text,
                 jsonb_build_object('status', $4::text), jsonb_build_object('status', $5::text),
                 jsonb_build_object('has_reviewer_comment', $6::boolean))`,
      [input.clubId, actorHash, `club_application_${input.decision}`, current, nextStatus, Boolean(message)]
    );
    await client.query(
      `INSERT INTO public.notifications (user_id, type, title, body, href, actor_type, actor_id, metadata)
       SELECT DISTINCT membership.user_id,
              $2,
              $3,
              $4,
              '/app/user/club',
              'club',
              $1::text,
              jsonb_build_object('decision', $5::text)
         FROM public.club_memberships membership
        WHERE membership.club_id = $1::uuid
          AND membership.role = 'club_owner'`,
      [
        input.clubId,
        `club_application_${input.decision}`,
        input.decision === "approve" ? "Club application approved" : input.decision === "reject" ? "Club application rejected" : "Club application needs clarification",
        message,
        input.decision
      ]
    );
    await client.query("COMMIT");
  } catch (error) {
    await client.query("ROLLBACK").catch(() => undefined);
    throw error;
  } finally {
    client.release();
  }
}
