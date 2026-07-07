import "server-only";

import crypto, { randomBytes } from "node:crypto";
import { JWT } from "google-auth-library";
import * as jose from "jose";
import type { Pool, PoolClient, QueryResult } from "pg";

import { GOOGLE_WALLET_TOTP_PERIOD_SECONDS, getGoogleWalletTotpSecretHex } from "./totp";
import { getReadyPool } from "./users";

const GOOGLE_WALLET_SCOPE = "https://www.googleapis.com/auth/wallet_object.issuer";
const GOOGLE_WALLET_API_BASE = "https://walletobjects.googleapis.com/walletobjects/v1";
const DEFAULT_WALLET_CLASS_SUFFIX = "cadesca_student_card";
const DEFAULT_EXPIRY_DAYS = 365;

type GoogleServiceAccountCredentials = {
  client_email: string;
  private_key: string;
};

type GoogleWalletConfigIssue = {
  key: "GOOGLE_WALLET_ISSUER_ID" | "GOOGLE_WALLET_CLASS_ID" | "GOOGLE_APPLICATION_CREDENTIALS_JSON";
  reason:
    | "missing"
    | "invalid_json"
    | "missing_client_email"
    | "missing_private_key"
    | "invalid_private_key"
    | "class_id_issuer_mismatch";
};

type GoogleCredentialsParseResult =
  | { credentials: GoogleServiceAccountCredentials; issue: null }
  | { credentials: null; issue: GoogleWalletConfigIssue };

type QueryExecutor = {
  query: <T extends object = Record<string, unknown>>(text: string, values?: unknown[]) => Promise<QueryResult<T>>;
};

type GoogleWalletRequestContext = {
  operation: string;
  issuerId?: string | null;
  classId?: string | null;
  objectId?: string | null;
};

type SanitizedGoogleApiError = NonNullable<GoogleWalletError["googleApiError"]>;

export type WalletPassStatus = "pending" | "active" | "revoked" | "expired";

export type WalletPassRow = {
  id: string;
  user_id: string;
  provider: "google";
  google_object_id: string;
  google_class_id: string;
  unique_wallet_pass_id: string;
  status: WalletPassStatus;
  last_sync: Date | null;
  revoked: boolean;
  revoked_at: Date | null;
  expires_at: Date | null;
  last_totp_counter: string | number | null;
  last_totp_used_at: Date | null;
  created_at: Date;
  updated_at: Date;
};

export type StudentWalletUser = {
  id: string;
  name: string;
  email: string;
  status: string;
  university_name: string | null;
  student_status: string;
  student_menu_access: boolean;
  student_number: string | null;
  student_id_expires_at: Date | string | null;
  student_id_issued_at: Date | string | null;
  student_faculty_department: string | null;
};

export type WalletStatusPayload = {
  configured: boolean;
  eligible: boolean;
  reason?: string;
  pass: {
    id: string;
    googleObjectId: string;
    status: WalletPassStatus;
    uniqueWalletPassId: string;
    expiresAt: string | null;
    lastSync: string | null;
    revoked: boolean;
  } | null;
};

export class GoogleWalletError extends Error {
  code: string;
  status: number;
  googleApiError?: {
    operation: string;
    httpStatus: number;
    googleErrorCode: number | string | null;
    googleErrorStatus: string | null;
    googleErrorMessage: string | null;
    googleErrorDetails: unknown;
    issuerId: string | null;
    classId: string | null;
    objectId: string | null;
    serviceAccountClientEmail: string | null;
  };

  constructor(code: string, status = 500, googleApiError?: GoogleWalletError["googleApiError"]) {
    super(code);
    this.name = "GoogleWalletError";
    this.code = code;
    this.status = status;
    this.googleApiError = googleApiError;
  }
}

let walletSchemaReady = false;
let walletSchemaReadyPromise: Promise<void> | null = null;
let lastConfigDiagnosticSignature = "";

async function ensureWalletPassSchema(executor: QueryExecutor) {
  if (walletSchemaReady) return;

  walletSchemaReadyPromise ??= executor.query(`
    ALTER TABLE public.users
      ADD COLUMN IF NOT EXISTS student_number text,
      ADD COLUMN IF NOT EXISTS student_id_expires_at date,
      ADD COLUMN IF NOT EXISTS student_id_issued_at date,
      ADD COLUMN IF NOT EXISTS student_faculty_department text;

    CREATE TABLE IF NOT EXISTS public.wallet_passes (
      id text PRIMARY KEY,
      user_id text not null REFERENCES public.users(id) ON DELETE CASCADE,
      provider text not null default 'google' CHECK (provider in ('google')),
      google_object_id text not null UNIQUE,
      google_class_id text not null,
      unique_wallet_pass_id text not null UNIQUE,
      status text not null default 'pending' CHECK (status in ('pending', 'active', 'revoked', 'expired')),
      last_sync timestamptz,
      revoked boolean not null default false,
      revoked_at timestamptz,
      expires_at timestamptz,
      last_totp_counter bigint,
      last_totp_used_at timestamptz,
      created_at timestamptz not null default now(),
      updated_at timestamptz not null default now()
    );

    CREATE UNIQUE INDEX IF NOT EXISTS wallet_passes_user_provider_idx
      ON public.wallet_passes (user_id, provider);

    CREATE INDEX IF NOT EXISTS wallet_passes_user_status_idx
      ON public.wallet_passes (user_id, status, expires_at);

    CREATE INDEX IF NOT EXISTS wallet_passes_status_sync_idx
      ON public.wallet_passes (status, last_sync desc);
  `).then(() => {
    walletSchemaReady = true;
  });

  await walletSchemaReadyPromise;
}

function unwrapEnvJsonValue(value: string) {
  const trimmed = value.trim();
  if (
    trimmed.length >= 2 &&
    ((trimmed.startsWith("'") && trimmed.endsWith("'")) || (trimmed.startsWith('"') && trimmed.endsWith('"'))) &&
    !trimmed.startsWith("{")
  ) {
    return trimmed.slice(1, -1).trim();
  }

  return trimmed;
}

function repairRawPrivateKeyNewlines(json: string) {
  return json.replace(/("private_key"\s*:\s*")([\s\S]*?)(")/, (_match, prefix: string, keyBody: string, suffix: string) => {
    const escapedKeyBody = keyBody
      .replace(/\r\n/g, "\n")
      .replace(/\r/g, "\n")
      .replace(/\n/g, "\\n");
    return `${prefix}${escapedKeyBody}${suffix}`;
  });
}

function parseCredentialsJson(value: string) {
  const trimmed = value.trim();
  const unwrapped = unwrapEnvJsonValue(trimmed);
  const candidates = Array.from(new Set([trimmed, unwrapped]));

  for (const candidate of candidates) {
    try {
      const parsed = JSON.parse(candidate) as Partial<GoogleServiceAccountCredentials> | string;
      if (typeof parsed === "string") {
        return JSON.parse(parsed) as Partial<GoogleServiceAccountCredentials>;
      }
      return parsed;
    } catch {
      // Try the next representation before reporting an invalid JSON diagnostic.
    }
  }

  return {
    __parseError: true,
    __raw: unwrapped
  };
}

function parseGoogleCredentials(value: string | undefined): GoogleCredentialsParseResult {
  if (!value || !value.trim()) {
    return { credentials: null, issue: { key: "GOOGLE_APPLICATION_CREDENTIALS_JSON", reason: "missing" } };
  }

  let parsed = parseCredentialsJson(value);
  if ("__parseError" in parsed) {
    const repaired = repairRawPrivateKeyNewlines(parsed.__raw);
    try {
      parsed = JSON.parse(repaired) as Partial<GoogleServiceAccountCredentials>;
    } catch {
      return { credentials: null, issue: { key: "GOOGLE_APPLICATION_CREDENTIALS_JSON", reason: "invalid_json" } };
    }
  }

  if (typeof parsed.client_email !== "string" || !parsed.client_email.trim()) {
    return { credentials: null, issue: { key: "GOOGLE_APPLICATION_CREDENTIALS_JSON", reason: "missing_client_email" } };
  }

  if (typeof parsed.private_key !== "string" || !parsed.private_key.trim()) {
    return { credentials: null, issue: { key: "GOOGLE_APPLICATION_CREDENTIALS_JSON", reason: "missing_private_key" } };
  }

  const privateKey = parsed.private_key
    .replace(/\\r\\n/g, "\n")
    .replace(/\\n/g, "\n")
    .replace(/\r\n/g, "\n")
    .replace(/\r/g, "\n")
    .trim();

  if (!privateKey.includes("-----BEGIN PRIVATE KEY-----") || !privateKey.includes("-----END PRIVATE KEY-----")) {
    return { credentials: null, issue: { key: "GOOGLE_APPLICATION_CREDENTIALS_JSON", reason: "invalid_private_key" } };
  }

  return {
    credentials: {
      client_email: parsed.client_email.trim(),
      private_key: privateKey
    },
    issue: null
  };
}

function googleWalletConfigIssues() {
  const issues: GoogleWalletConfigIssue[] = [];
  const expectedIds = getGoogleWalletExpectedIds();

  if (!expectedIds.issuerId) {
    issues.push({ key: "GOOGLE_WALLET_ISSUER_ID", reason: "missing" });
  }
  if (!expectedIds.classIdRaw) {
    issues.push({ key: "GOOGLE_WALLET_CLASS_ID", reason: "missing" });
  } else if (expectedIds.issuerId && !expectedIds.classIdStartsWithIssuerId) {
    issues.push({ key: "GOOGLE_WALLET_CLASS_ID", reason: "class_id_issuer_mismatch" });
  }

  const parsedCredentials = parseGoogleCredentials(process.env.GOOGLE_APPLICATION_CREDENTIALS_JSON);
  if (parsedCredentials.issue) issues.push(parsedCredentials.issue);

  return { issues, credentials: parsedCredentials.credentials };
}

function logGoogleWalletConfigIssues(issues: GoogleWalletConfigIssue[], source: string) {
  if (!issues.length) return;

  const signature = JSON.stringify(issues);
  if (signature === lastConfigDiagnosticSignature) return;
  lastConfigDiagnosticSignature = signature;

  console.error("[google_wallet] configuration_invalid", {
    source,
    issues,
    expectedIds: getGoogleWalletExpectedIds()
  });
}

function asRecord(value: unknown): Record<string, unknown> | null {
  return typeof value === "object" && value !== null ? (value as Record<string, unknown>) : null;
}

function extractGoogleErrorFields(data: unknown) {
  const record = asRecord(data);
  const nestedError = asRecord(record?.error);
  const source = nestedError || record || {};
  const rawCode = source.code ?? null;
  const rawStatus = source.status ?? (typeof record?.error === "string" ? record.error : null);
  const rawMessage = source.message ?? record?.error_description ?? record?.message;
  const rawDetails = source.details ?? source.errors ?? record?.error_description ?? null;

  return {
    googleErrorCode:
      typeof rawCode === "string" || typeof rawCode === "number"
        ? rawCode
        : null,
    googleErrorStatus:
      typeof rawStatus === "string"
        ? rawStatus
        : null,
    googleErrorMessage:
      typeof rawMessage === "string"
        ? rawMessage
        : null,
    googleErrorDetails: rawDetails
  };
}

function logGoogleWalletEvent(
  level: "info" | "error",
  event: string,
  payload: Record<string, unknown>
) {
  const line = JSON.stringify({
    level,
    event,
    component: "google_wallet",
    ...payload
  });

  if (level === "error") {
    console.error(line);
  } else {
    console.info(line);
  }
}

function logGoogleWalletApiFailure(input: {
  context: GoogleWalletRequestContext;
  httpStatus: number;
  credentials: GoogleServiceAccountCredentials;
  data: unknown;
}): SanitizedGoogleApiError {
  const fields = extractGoogleErrorFields(input.data);
  const googleApiError = {
    operation: input.context.operation,
    httpStatus: input.httpStatus,
    googleErrorCode: fields.googleErrorCode,
    googleErrorStatus: fields.googleErrorStatus,
    googleErrorMessage: fields.googleErrorMessage,
    googleErrorDetails: fields.googleErrorDetails,
    issuerId: input.context.issuerId || null,
    classId: input.context.classId || null,
    objectId: input.context.objectId || null,
    serviceAccountClientEmail: input.credentials.client_email || null
  };

  logGoogleWalletEvent("error", "api_request_failed", googleApiError);
  return googleApiError;
}

function googleWalletErrorText(error: SanitizedGoogleApiError) {
  const details = Array.isArray(error.googleErrorDetails)
    ? error.googleErrorDetails
    : [error.googleErrorDetails];
  return [
    error.googleErrorCode,
    error.googleErrorStatus,
    error.googleErrorMessage,
    ...details
      .map((detail) => {
        const record = asRecord(detail);
        return [
          record?.message,
          record?.domain,
          record?.reason
        ].filter(Boolean).join(" ");
      })
      .filter(Boolean)
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();
}

function isIssuerNotFound(error: SanitizedGoogleApiError) {
  const text = googleWalletErrorText(error);
  return text.includes("issuer") && text.includes("not found")
    || text.includes("gpay_merchant_external_id");
}

function isGenericClassNotFound(error: SanitizedGoogleApiError, classId: string) {
  if (error.httpStatus !== 404 || isIssuerNotFound(error)) return false;
  const text = googleWalletErrorText(error);
  return !text
    || text.includes(classId.toLowerCase())
    || text.includes("class")
    || text.includes("genericclass")
    || text.includes("resource not found")
    || text.includes("resourcenotfound");
}

function logGenericClassDecision(input: {
  event: string;
  level?: "info" | "error";
  issuerId: string;
  classId: string;
  credentials: GoogleServiceAccountCredentials;
  getStatus: number;
  insertSkipped: boolean;
  googleApiError?: SanitizedGoogleApiError | null;
}) {
  logGoogleWalletEvent(input.level || "info", input.event, {
    issuerId: input.issuerId,
    classId: input.classId,
    serviceAccountClientEmail: input.credentials.client_email,
    genericClassGetStatus: input.getStatus,
    insertSkipped: input.insertSkipped,
    googleApiError: input.googleApiError || null
  });
}

function googleAuthFailureDetails(error: unknown) {
  const record = asRecord(error);
  const response = asRecord(record?.response);
  const responseData = response?.data ?? asRecord(record?.error) ?? record;
  const status = typeof response?.status === "number" ? response.status : 0;
  return { status, responseData };
}

function appOrigin() {
  const configured = process.env.NEXT_PUBLIC_APP_URL || "https://app.cadesca.com";
  try {
    return new URL(configured).origin;
  } catch {
    return "https://app.cadesca.com";
  }
}

function appUrl(path = "/") {
  const origin = appOrigin();
  return new URL(path, origin).toString();
}

function normalizeGoogleIdPart(value: string) {
  return value
    .trim()
    .replace(/[^A-Za-z0-9._-]/g, "_")
    .replace(/_+/g, "_")
    .replace(/^[._-]+|[._-]+$/g, "")
    .slice(0, 128);
}

function qualifyGoogleWalletId(issuerId: string, idOrSuffix: string, fallbackSuffix: string) {
  const value = idOrSuffix.trim();
  if (value.includes(".")) return value;
  return `${issuerId}.${normalizeGoogleIdPart(value || fallbackSuffix)}`;
}

export function getGoogleWalletExpectedIds() {
  const issuerId = process.env.GOOGLE_WALLET_ISSUER_ID?.trim() || null;
  const classIdRaw = process.env.GOOGLE_WALLET_CLASS_ID?.trim() || null;

  return {
    issuerId,
    classIdRaw,
    classId: issuerId && classIdRaw ? qualifyGoogleWalletId(issuerId, classIdRaw, DEFAULT_WALLET_CLASS_SUFFIX) : null,
    classIdStartsWithIssuerId: Boolean(
      issuerId &&
        classIdRaw &&
        qualifyGoogleWalletId(issuerId, classIdRaw, DEFAULT_WALLET_CLASS_SUFFIX).startsWith(`${issuerId}.`)
    )
  };
}

function walletOrigins() {
  const configured = (process.env.GOOGLE_WALLET_ORIGINS || "")
    .split(",")
    .map((origin) => origin.trim())
    .filter(Boolean);

  return Array.from(new Set([appOrigin(), ...configured]));
}

export function isGoogleWalletConfigured() {
  const { issues } = googleWalletConfigIssues();
  if (issues.length) {
    logGoogleWalletConfigIssues(issues, "isGoogleWalletConfigured");
    return false;
  }
  return true;
}

function getGoogleWalletConfig() {
  const issuerId = process.env.GOOGLE_WALLET_ISSUER_ID?.trim();
  const classIdRaw = process.env.GOOGLE_WALLET_CLASS_ID?.trim();
  const { issues, credentials } = googleWalletConfigIssues();
  if (issues.length || !issuerId || !classIdRaw || !credentials) {
    logGoogleWalletConfigIssues(issues, "getGoogleWalletConfig");
    throw new GoogleWalletError("wallet_configuration_missing", 503);
  }

  const classId = qualifyGoogleWalletId(
    issuerId,
    classIdRaw,
    DEFAULT_WALLET_CLASS_SUFFIX
  );

  return {
    issuerId,
    classId,
    credentials,
    origins: walletOrigins(),
    logoUrl: process.env.GOOGLE_WALLET_LOGO_URL || appUrl("/cadesca-mark.png"),
    heroImageUrl: process.env.GOOGLE_WALLET_HERO_IMAGE_URL || appUrl("/cadesca-logo.png"),
    issuerName: process.env.GOOGLE_WALLET_ISSUER_NAME || "Cadesca"
  };
}

async function googleAccessToken(credentials: GoogleServiceAccountCredentials) {
  const client = new JWT({
    email: credentials.client_email,
    key: credentials.private_key,
    scopes: [GOOGLE_WALLET_SCOPE]
  });

  let result;
  try {
    result = await client.authorize();
  } catch (error) {
    const details = googleAuthFailureDetails(error);
    const googleApiError = logGoogleWalletApiFailure({
      context: { operation: "googleAccessToken" },
      httpStatus: details.status,
      credentials,
      data: details.responseData
    });
    throw new GoogleWalletError("wallet_google_auth_failed", 503, googleApiError);
  }

  if (!result.access_token) {
    const googleApiError = logGoogleWalletApiFailure({
      context: { operation: "googleAccessToken" },
      httpStatus: 0,
      credentials,
      data: { error: { status: "missing_access_token", message: "Google auth response did not include an access token." } }
    });
    throw new GoogleWalletError("wallet_google_auth_failed", 503, googleApiError);
  }
  return result.access_token;
}

async function googleWalletRequest<T>(
  method: "GET" | "POST" | "PATCH",
  path: string,
  credentials: GoogleServiceAccountCredentials,
  context: GoogleWalletRequestContext,
  body?: unknown
): Promise<{ ok: true; data: T } | { ok: false; status: number; error: string; googleApiError: NonNullable<GoogleWalletError["googleApiError"]> }> {
  const accessToken = await googleAccessToken(credentials);
  const response = await fetch(`${GOOGLE_WALLET_API_BASE}${path}`, {
    method,
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json"
    },
    body: body ? JSON.stringify(body) : undefined
  });

  const text = await response.text();
  const data = text
    ? (() => {
        try {
          return JSON.parse(text);
        } catch {
          return null;
        }
      })()
    : null;
  if (!response.ok) {
    const googleApiError = logGoogleWalletApiFailure({
      context,
      httpStatus: response.status,
      credentials,
      data
    });

    return {
      ok: false,
      status: response.status,
      error: googleApiError.googleErrorMessage || response.statusText,
      googleApiError
    };
  }

  return { ok: true, data: data as T };
}

function dateFromUnknown(value: Date | string | null | undefined) {
  if (!value) return null;
  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

function isoDate(value: Date | string | null | undefined) {
  const date = dateFromUnknown(value);
  return date ? date.toISOString().slice(0, 10) : null;
}

function isoDateTime(value: Date | string | null | undefined) {
  const date = dateFromUnknown(value);
  return date ? date.toISOString() : null;
}

function defaultExpiry() {
  const days = Number.parseInt(process.env.GOOGLE_WALLET_DEFAULT_EXPIRY_DAYS || "", 10);
  const safeDays = Number.isFinite(days) && days >= 1 && days <= 1825 ? days : DEFAULT_EXPIRY_DAYS;
  return new Date(Date.now() + safeDays * 24 * 60 * 60 * 1000);
}

function effectiveExpiry(user: StudentWalletUser) {
  return dateFromUnknown(user.student_id_expires_at) || defaultExpiry();
}

function stableStudentNumber(user: StudentWalletUser) {
  const fromCard = user.student_number?.trim();
  if (fromCard) return fromCard;
  return user.id.replace(/^user_/, "").slice(0, 18).toUpperCase();
}

function passStatusForDate(row: WalletPassRow) {
  if (row.revoked || row.status === "revoked") return "revoked";
  if (row.expires_at && new Date(row.expires_at).getTime() <= Date.now()) return "expired";
  return row.status === "pending" ? "pending" : "active";
}

function isEligibleStudent(user: StudentWalletUser | null): user is StudentWalletUser {
  return Boolean(user && user.status === "active" && user.student_status === "verified" && user.student_menu_access);
}

function userEligibilityReason(user: StudentWalletUser | null) {
  if (!user) return "user_not_found";
  if (user.status !== "active") return "account_inactive";
  if (user.student_status !== "verified" || !user.student_menu_access) return "student_not_verified";
  return undefined;
}

function walletPassId() {
  return `gwp_${randomBytes(16).toString("base64url")}`;
}

function walletRowId() {
  return `wpass_${randomBytes(8).toString("hex")}`;
}

function googleObjectId(issuerId: string, userId: string) {
  const hash = crypto.createHash("sha256").update(userId).digest("hex").slice(0, 24);
  return `${issuerId}.cadesca_student_${hash}`;
}

function localized(value: string, language = "en-US") {
  return {
    defaultValue: {
      language,
      value
    }
  };
}

function buildGoogleWalletClass(input: { classId: string; issuerName: string }) {
  return {
    id: input.classId,
    issuerName: input.issuerName
  };
}

function buildGoogleWalletObject(input: {
  user: StudentWalletUser;
  pass: WalletPassRow;
  issuerName: string;
  logoUrl: string;
  heroImageUrl: string;
}) {
  const expiresAt = dateFromUnknown(input.pass.expires_at) || effectiveExpiry(input.user);
  const issueDate = isoDate(input.user.student_id_issued_at);
  const expiryDate = isoDate(expiresAt);
  const faculty = input.user.student_faculty_department?.trim();
  const studentNumber = stableStudentNumber(input.user);
  const state = passStatusForDate(input.pass) === "active" || passStatusForDate(input.pass) === "pending"
    ? "ACTIVE"
    : passStatusForDate(input.pass) === "expired"
      ? "EXPIRED"
      : "INACTIVE";

  const textModulesData = [
    { id: "full_name", header: "Full Name", body: input.user.name },
    { id: "university", header: "University", body: input.user.university_name || "Cadesca verified university" },
    { id: "student_number", header: "Student Number", body: studentNumber },
    { id: "student_status", header: "Student Status", body: "Verified student" },
    { id: "wallet_pass_id", header: "Wallet Pass ID", body: input.pass.unique_wallet_pass_id },
    { id: "expiration_date", header: "Expiration Date", body: expiryDate || "Not set" }
  ];

  if (issueDate) textModulesData.push({ id: "issue_date", header: "Issue Date", body: issueDate });
  if (faculty) textModulesData.push({ id: "faculty_department", header: "Faculty / Department", body: faculty });

  return {
    id: input.pass.google_object_id,
    classId: input.pass.google_class_id,
    state,
    genericType: "GENERIC_OTHER",
    logo: {
      sourceUri: { uri: input.logoUrl },
      contentDescription: localized("Cadesca logo")
    },
    heroImage: {
      sourceUri: { uri: input.heroImageUrl },
      contentDescription: localized("Cadesca student card")
    },
    cardTitle: localized("Cadesca Student Card"),
    subheader: localized(input.user.university_name || input.issuerName),
    header: localized(input.user.name),
    hexBackgroundColor: "#050505",
    validTimeInterval: {
      end: {
        date: expiresAt.toISOString()
      }
    },
    textModulesData,
    rotatingBarcode: {
      type: "QR_CODE",
      renderEncoding: "UTF_8",
      valuePattern: `cadesca:google:${input.pass.unique_wallet_pass_id}:${input.user.id}:{totp_timestamp_seconds}:{totp_value_0}`,
      alternateText: "Cadesca server verified",
      totpDetails: {
        periodMillis: String(GOOGLE_WALLET_TOTP_PERIOD_SECONDS * 1000),
        algorithm: "TOTP_SHA1",
        parameters: [
          {
            key: getGoogleWalletTotpSecretHex(input.user.id, input.pass.unique_wallet_pass_id),
            valueLength: 6
          }
        ]
      }
    },
    appLinkData: {
      webAppLinkInfo: {
        appTarget: {
          targetUri: {
            uri: appUrl("/app/user/pass"),
            description: "Open Cadesca"
          }
        }
      },
      displayText: localized("Open Cadesca")
    }
  };
}

async function loadUser(userId: string, executor?: QueryExecutor): Promise<StudentWalletUser | null> {
  const db = executor || (await getReadyPool());
  await ensureWalletPassSchema(db);

  const result = await db.query<StudentWalletUser>(
    `SELECT id, name, email, status, university_name, student_status, student_menu_access,
            student_number, student_id_expires_at, student_id_issued_at, student_faculty_department
     FROM users
     WHERE id = $1
     LIMIT 1`,
    [userId]
  );
  return result.rows[0] || null;
}

async function loadWalletPassByUser(userId: string, executor?: QueryExecutor) {
  const db = executor || (await getReadyPool());
  await ensureWalletPassSchema(db);
  const result = await db.query<WalletPassRow>(
    `SELECT *
     FROM wallet_passes
     WHERE user_id = $1 AND provider = 'google'
     LIMIT 1`,
    [userId]
  );
  return result.rows[0] || null;
}

export async function loadGoogleWalletPassByUniqueId(
  uniqueWalletPassId: string,
  options: { executor?: QueryExecutor; lock?: boolean } = {}
) {
  const db = options.executor || (await getReadyPool());
  await ensureWalletPassSchema(db);
  const result = await db.query<WalletPassRow>(
    `SELECT *
     FROM wallet_passes
     WHERE provider = 'google'
       AND unique_wallet_pass_id = $1
     LIMIT 1${options.lock ? " FOR UPDATE" : ""}`,
    [uniqueWalletPassId]
  );
  return result.rows[0] || null;
}

function serializeWalletPass(row: WalletPassRow | null): WalletStatusPayload["pass"] {
  if (!row) return null;
  return {
    id: row.id,
    googleObjectId: row.google_object_id,
    status: passStatusForDate(row),
    uniqueWalletPassId: row.unique_wallet_pass_id,
    expiresAt: isoDateTime(row.expires_at),
    lastSync: isoDateTime(row.last_sync),
    revoked: row.revoked
  };
}

async function insertOrUpdatePass(input: {
  user: StudentWalletUser;
  classId: string;
  issuerId: string;
  status?: WalletPassStatus;
  regenerateSecret?: boolean;
  executor?: QueryExecutor;
}) {
  const db = input.executor || (await getReadyPool());
  await ensureWalletPassSchema(db);

  const expiresAt = effectiveExpiry(input.user);
  const existing = await loadWalletPassByUser(input.user.id, db);
  const nextUniqueWalletPassId = input.regenerateSecret || !existing ? walletPassId() : existing.unique_wallet_pass_id;
  const nextStatus: WalletPassStatus = input.status || "active";

  const result = await db.query<WalletPassRow>(
    `INSERT INTO wallet_passes (
       id, user_id, provider, google_object_id, google_class_id, unique_wallet_pass_id,
       status, revoked, revoked_at, expires_at, last_totp_counter, last_totp_used_at, updated_at
     )
     VALUES ($1, $2, 'google', $3, $4, $5, $6, false, null, $7, null, null, now())
     ON CONFLICT (user_id, provider) DO UPDATE SET
       google_object_id = EXCLUDED.google_object_id,
       google_class_id = EXCLUDED.google_class_id,
       unique_wallet_pass_id = EXCLUDED.unique_wallet_pass_id,
       status = EXCLUDED.status,
       revoked = false,
       revoked_at = null,
       expires_at = EXCLUDED.expires_at,
       last_totp_counter = CASE
         WHEN wallet_passes.unique_wallet_pass_id = EXCLUDED.unique_wallet_pass_id THEN wallet_passes.last_totp_counter
         ELSE null
       END,
       last_totp_used_at = CASE
         WHEN wallet_passes.unique_wallet_pass_id = EXCLUDED.unique_wallet_pass_id THEN wallet_passes.last_totp_used_at
         ELSE null
       END,
       updated_at = now()
     RETURNING *`,
    [
      existing?.id || walletRowId(),
      input.user.id,
      googleObjectId(input.issuerId, input.user.id),
      input.classId,
      nextUniqueWalletPassId,
      nextStatus,
      expiresAt
    ]
  );

  return result.rows[0];
}

async function upsertGoogleClass(config: ReturnType<typeof getGoogleWalletConfig>) {
  const classPath = `/genericClass/${encodeURIComponent(config.classId)}`;
  logGenericClassDecision({
    event: "generic_class_lookup_start",
    issuerId: config.issuerId,
    classId: config.classId,
    credentials: config.credentials,
    getStatus: 0,
    insertSkipped: true
  });

  const existing = await googleWalletRequest<Record<string, unknown>>(
    "GET",
    classPath,
    config.credentials,
    { operation: "genericClass.get", issuerId: config.issuerId, classId: config.classId }
  );

  if (existing.ok) {
    logGenericClassDecision({
      event: "generic_class_exists",
      issuerId: config.issuerId,
      classId: config.classId,
      credentials: config.credentials,
      getStatus: 200,
      insertSkipped: true
    });
    return;
  }

  if (!isGenericClassNotFound(existing.googleApiError, config.classId)) {
    logGenericClassDecision({
      event: "generic_class_lookup_failed",
      level: "error",
      issuerId: config.issuerId,
      classId: config.classId,
      credentials: config.credentials,
      getStatus: existing.status,
      insertSkipped: true,
      googleApiError: existing.googleApiError
    });
    throw new GoogleWalletError("wallet_class_lookup_failed", 502, existing.googleApiError);
  }

  logGenericClassDecision({
    event: "generic_class_missing",
    issuerId: config.issuerId,
    classId: config.classId,
    credentials: config.credentials,
    getStatus: existing.status,
    insertSkipped: false,
    googleApiError: existing.googleApiError
  });

  const created = await googleWalletRequest<Record<string, unknown>>(
    "POST",
    "/genericClass",
    config.credentials,
    { operation: "genericClass.insert", issuerId: config.issuerId, classId: config.classId },
    buildGoogleWalletClass({ classId: config.classId, issuerName: config.issuerName })
  );
  if (!created.ok) {
    logGenericClassDecision({
      event: "generic_class_insert_failed",
      level: "error",
      issuerId: config.issuerId,
      classId: config.classId,
      credentials: config.credentials,
      getStatus: existing.status,
      insertSkipped: false,
      googleApiError: created.googleApiError
    });
    throw new GoogleWalletError("wallet_class_create_failed", 502, created.googleApiError);
  }

  logGenericClassDecision({
    event: "generic_class_created",
    issuerId: config.issuerId,
    classId: config.classId,
    credentials: config.credentials,
    getStatus: existing.status,
    insertSkipped: false
  });
}

async function upsertGoogleObject(
  config: ReturnType<typeof getGoogleWalletConfig>,
  objectPayload: ReturnType<typeof buildGoogleWalletObject>
) {
  const objectPath = `/genericObject/${encodeURIComponent(objectPayload.id)}`;
  const existing = await googleWalletRequest<Record<string, unknown>>(
    "GET",
    objectPath,
    config.credentials,
    { operation: "genericObject.get", issuerId: config.issuerId, classId: config.classId, objectId: objectPayload.id }
  );

  if (existing.ok) {
    const updated = await googleWalletRequest<Record<string, unknown>>(
      "PATCH",
      objectPath,
      config.credentials,
      { operation: "genericObject.patch", issuerId: config.issuerId, classId: config.classId, objectId: objectPayload.id },
      objectPayload
    );
    if (!updated.ok) throw new GoogleWalletError("wallet_object_update_failed", 502, updated.googleApiError);
    return;
  }

  if (existing.status !== 404) throw new GoogleWalletError("wallet_object_lookup_failed", 502, existing.googleApiError);

  const created = await googleWalletRequest<Record<string, unknown>>(
    "POST",
    "/genericObject",
    config.credentials,
    { operation: "genericObject.insert", issuerId: config.issuerId, classId: config.classId, objectId: objectPayload.id },
    objectPayload
  );
  if (!created.ok) throw new GoogleWalletError("wallet_object_create_failed", 502, created.googleApiError);
}

async function markPassSynced(passId: string, executor?: QueryExecutor) {
  const db = executor || (await getReadyPool());
  const result = await db.query<WalletPassRow>(
    `UPDATE wallet_passes
     SET status = CASE WHEN revoked THEN 'revoked' ELSE 'active' END,
         last_sync = now(),
         updated_at = now()
     WHERE id = $1
     RETURNING *`,
    [passId]
  );
  return result.rows[0];
}

async function signSaveToWalletJwt(
  config: ReturnType<typeof getGoogleWalletConfig>,
  objectPayload: ReturnType<typeof buildGoogleWalletObject>
) {
  const objectReference = {
    id: objectPayload.id,
    classId: objectPayload.classId
  };

  const claims = {
    iss: config.credentials.client_email,
    aud: "google",
    typ: "savetowallet",
    iat: Math.floor(Date.now() / 1000),
    origins: config.origins,
    payload: {
      genericObjects: [objectReference]
    }
  };

  const privateKey = await jose.importPKCS8(config.credentials.private_key, "RS256");
  const jwt = await new jose.SignJWT(claims)
    .setProtectedHeader({ alg: "RS256", typ: "JWT" })
    .sign(privateKey);

  return `https://pay.google.com/gp/v/save/${jwt}`;
}

export async function getGoogleWalletStatus(userId: string): Promise<WalletStatusPayload> {
  const pool = await getReadyPool();
  await ensureWalletPassSchema(pool);
  const user = await loadUser(userId, pool);
  const pass = await loadWalletPassByUser(userId, pool);

  return {
    configured: isGoogleWalletConfigured(),
    eligible: isEligibleStudent(user),
    reason: userEligibilityReason(user),
    pass: serializeWalletPass(pass)
  };
}

export async function generateGoogleWalletSaveUrl(userId: string) {
  const config = getGoogleWalletConfig();
  const pool = await getReadyPool();
  await ensureWalletPassSchema(pool);

  const user = await loadUser(userId, pool);
  if (!isEligibleStudent(user)) {
    throw new GoogleWalletError(userEligibilityReason(user) || "student_not_verified", 403);
  }

  const pass = await insertOrUpdatePass({ user, classId: config.classId, issuerId: config.issuerId, status: "active", executor: pool });
  const objectPayload = buildGoogleWalletObject({
    user,
    pass,
    issuerName: config.issuerName,
    logoUrl: config.logoUrl,
    heroImageUrl: config.heroImageUrl
  });

  await upsertGoogleClass(config);
  await upsertGoogleObject(config, objectPayload);
  const synced = await markPassSynced(pass.id, pool);
  const saveUrl = await signSaveToWalletJwt(config, objectPayload);

  return { saveUrl, pass: synced };
}

export async function refreshGoogleWalletPass(userId: string, options: { regenerateSecret?: boolean } = {}) {
  const config = getGoogleWalletConfig();
  const pool = await getReadyPool();
  await ensureWalletPassSchema(pool);

  const user = await loadUser(userId, pool);
  if (!isEligibleStudent(user)) {
    throw new GoogleWalletError(userEligibilityReason(user) || "student_not_verified", 403);
  }

  const pass = await insertOrUpdatePass({
    user,
    classId: config.classId,
    issuerId: config.issuerId,
    status: "active",
    regenerateSecret: options.regenerateSecret,
    executor: pool
  });

  const objectPayload = buildGoogleWalletObject({
    user,
    pass,
    issuerName: config.issuerName,
    logoUrl: config.logoUrl,
    heroImageUrl: config.heroImageUrl
  });

  await upsertGoogleClass(config);
  await upsertGoogleObject(config, objectPayload);
  return markPassSynced(pass.id, pool);
}

export async function revokeGoogleWalletPass(userId: string) {
  const config = getGoogleWalletConfig();
  const pool = await getReadyPool();
  await ensureWalletPassSchema(pool);

  const user = await loadUser(userId, pool);
  const pass = await loadWalletPassByUser(userId, pool);
  if (!user || !pass) throw new GoogleWalletError("wallet_pass_not_found", 404);

  const revokedResult = await pool.query<WalletPassRow>(
    `UPDATE wallet_passes
     SET status = 'revoked',
         revoked = true,
         revoked_at = now(),
         updated_at = now()
     WHERE id = $1
     RETURNING *`,
    [pass.id]
  );
  const revokedPass = revokedResult.rows[0];

  const objectPayload = buildGoogleWalletObject({
    user,
    pass: revokedPass,
    issuerName: config.issuerName,
    logoUrl: config.logoUrl,
    heroImageUrl: config.heroImageUrl
  });

  await upsertGoogleObject(config, objectPayload);
  await markPassSynced(revokedPass.id, pool);
  return revokedPass;
}

export async function reissueGoogleWalletPass(userId: string) {
  return refreshGoogleWalletPass(userId, { regenerateSecret: true });
}

export async function markExpiredWalletPasses() {
  const pool = await getReadyPool();
  await ensureWalletPassSchema(pool);
  await pool.query(
    `UPDATE wallet_passes
     SET status = 'expired',
         updated_at = now()
     WHERE status = 'active'
       AND revoked = false
       AND expires_at IS NOT NULL
       AND expires_at <= now()`
  );
}

export async function listGoogleWalletPasses(limit = 100) {
  const pool = await getReadyPool();
  await ensureWalletPassSchema(pool);
  await markExpiredWalletPasses();

  const result = await pool.query<WalletPassRow & StudentWalletUser>(
    `SELECT
       wallet_passes.*,
       users.id as user_id,
       users.name,
       users.email,
       users.status as user_status,
       users.university_name,
       users.student_status,
       users.student_menu_access,
       users.student_number,
       users.student_id_expires_at,
       users.student_id_issued_at,
       users.student_faculty_department
     FROM wallet_passes
     JOIN users ON users.id = wallet_passes.user_id
     WHERE wallet_passes.provider = 'google'
     ORDER BY wallet_passes.updated_at DESC
     LIMIT $1`,
    [Math.max(1, Math.min(limit, 200))]
  );

  return result.rows;
}

export async function disableStudentAndRevokeWalletPass(userId: string) {
  const pool = await getReadyPool();
  await ensureWalletPassSchema(pool);
  const client = await pool.connect();

  try {
    await client.query("BEGIN");
    await client.query(
      `UPDATE users
       SET status = 'suspended',
           student_menu_access = false,
           updated_at = now(),
           suspended_at = COALESCE(suspended_at, now())
       WHERE id = $1`,
      [userId]
    );
    await client.query("COMMIT");
  } catch (error) {
    await client.query("ROLLBACK").catch(() => undefined);
    throw error;
  } finally {
    client.release();
  }

  return revokeGoogleWalletPass(userId);
}

export async function consumeGoogleWalletTotpCounter(input: {
  uniqueWalletPassId: string;
  userId: string;
  counter: number;
  client: PoolClient;
}) {
  await ensureWalletPassSchema(input.client);
  const result = await input.client.query(
    `UPDATE wallet_passes
     SET last_totp_counter = $3,
         last_totp_used_at = now(),
         updated_at = now()
     WHERE unique_wallet_pass_id = $1
       AND user_id = $2
       AND provider = 'google'
       AND status = 'active'
       AND revoked = false
       AND (expires_at IS NULL OR expires_at > now())
       AND (last_totp_counter IS NULL OR last_totp_counter < $3)
     RETURNING id`,
    [input.uniqueWalletPassId, input.userId, input.counter]
  );

  return result.rowCount === 1;
}
