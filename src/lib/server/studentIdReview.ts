import "server-only";

import { createHash, randomUUID } from "node:crypto";
import { GoogleGenAI, Type, type Schema } from "@google/genai";

import { getSupabaseAdminClient } from "@/lib/supabase/admin";

export const STUDENT_ID_BUCKET = "student_ids";
export const MAX_STUDENT_ID_IMAGE_BYTES = 1 * 1024 * 1024;
export const DEFAULT_GEMINI_OCR_MODEL = "gemini-3.5-flash";
const OCR_TIMEOUT_MS = 20_000;
const MIN_NAME_CONFIDENCE = 0.72;
const MIN_UNIVERSITY_CONFIDENCE = 0.72;
const MIN_STUDENT_NUMBER_CONFIDENCE = 0.65;
const MIN_OVERALL_CONFIDENCE = 0.74;

export type StudentIdImagePayload = {
  dataUrl: string;
  rawBase64: string;
  bytes: Buffer;
  mimeType: "image/jpeg" | "image/png";
  extension: "jpg" | "png";
  byteLength: number;
  sha256: string;
};

type OcrLogContext = {
  requestId?: string;
  userId?: string;
  objectPath?: string;
  source?: string;
};

type StudentIdOcrConfidence = {
  studentName: number;
  universityName: number;
  studentNumber: number;
  dates: number;
  overall: number;
};

export type StudentIdOcrData = {
  fullName: string;
  firstName: string;
  lastName: string;
  universityName: string;
  studentNumber: string;
  expiryDate: string | null;
  issueDate: string | null;
  facultyOrDepartment: string | null;
  isCurrentlyValid: boolean;
  isStudentId: boolean;
  confidence: StudentIdOcrConfidence;
  validationFailureReasons: string[];
};

function encodedByteLength(base64: string) {
  const padding = base64.endsWith("==") ? 2 : base64.endsWith("=") ? 1 : 0;
  return Math.floor((base64.length * 3) / 4) - padding;
}

function logOcr(stage: string, event: string, details: Record<string, unknown> = {}) {
  console.info("[student_id_ocr]", { stage, event, ...details });
}

function logOcrError(stage: string, event: string, details: Record<string, unknown> = {}) {
  console.error("[student_id_ocr]", { stage, event, ...details });
}

function errorReason(error: unknown) {
  return error instanceof Error ? error.message : "unknown";
}

function imageHash(bytes: Buffer) {
  return createHash("sha256").update(bytes).digest("hex");
}

function hashPrefix(hash: string) {
  return hash.slice(0, 16);
}

function normalizeMimeType(value: string | undefined | null): StudentIdImagePayload["mimeType"] | null {
  const mimeType = String(value || "").split(";")[0]?.trim().toLowerCase();
  if (mimeType === "image/jpeg" || mimeType === "image/jpg") return "image/jpeg";
  if (mimeType === "image/png") return "image/png";
  return null;
}

function normalizeBase64(rawBase64: string) {
  const compact = rawBase64.replace(/\s/g, "");
  if (!/^[A-Za-z0-9+/]*={0,2}$/.test(compact)) return null;
  const unpadded = compact.replace(/=+$/, "");
  const remainder = unpadded.length % 4;
  if (remainder === 1) return null;
  return `${unpadded}${remainder === 2 ? "==" : remainder === 3 ? "=" : ""}`;
}

function detectImageMimeType(bytes: Buffer): StudentIdImagePayload["mimeType"] | null {
  if (bytes.length >= 4 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) {
    return "image/jpeg";
  }

  if (
    bytes.length >= 8 &&
    bytes[0] === 0x89 &&
    bytes[1] === 0x50 &&
    bytes[2] === 0x4e &&
    bytes[3] === 0x47 &&
    bytes[4] === 0x0d &&
    bytes[5] === 0x0a &&
    bytes[6] === 0x1a &&
    bytes[7] === 0x0a
  ) {
    return "image/png";
  }

  return null;
}

function hasCompleteImageEnvelope(bytes: Buffer, mimeType: StudentIdImagePayload["mimeType"]) {
  if (mimeType === "image/jpeg") {
    const searchStart = Math.max(0, bytes.length - 64);
    for (let index = bytes.length - 2; index >= searchStart; index--) {
      if (bytes[index] === 0xff && bytes[index + 1] === 0xd9) return true;
    }
    return false;
  }

  return bytes.length >= 12 && bytes.subarray(Math.max(0, bytes.length - 16)).includes(Buffer.from("IEND", "ascii"));
}

function payloadFromBytes(
  bytes: Buffer,
  declaredMimeType?: string | null,
  context: OcrLogContext = {}
): StudentIdImagePayload | null {
  const byteLength = bytes.length;
  const declared = normalizeMimeType(declaredMimeType);
  const detected = detectImageMimeType(bytes);
  const mimeType = declared || detected;

  if (!byteLength || byteLength > MAX_STUDENT_ID_IMAGE_BYTES || !mimeType || detected !== mimeType) {
    logOcr("base64", "image_payload_rejected", {
      ...context,
      byteLength,
      declaredMimeType: declaredMimeType || null,
      detectedMimeType: detected,
      maxBytes: MAX_STUDENT_ID_IMAGE_BYTES
    });
    return null;
  }

  if (!hasCompleteImageEnvelope(bytes, mimeType)) {
    logOcr("base64", "image_payload_truncated_or_invalid", {
      ...context,
      byteLength,
      mimeType
    });
    return null;
  }

  const rawBase64 = bytes.toString("base64");
  const sha256 = imageHash(bytes);
  const extension = mimeType === "image/png" ? "png" : "jpg";

  logOcr("base64", "image_payload_ready", {
    ...context,
    mimeType,
    byteLength,
    base64Length: rawBase64.length,
    sha256Prefix: hashPrefix(sha256)
  });

  return {
    dataUrl: `data:${mimeType};base64,${rawBase64}`,
    rawBase64,
    bytes: Buffer.from(rawBase64, "base64"),
    mimeType,
    extension,
    byteLength,
    sha256
  };
}

export function parseStudentIdImagePayload(base64Image: string, context: OcrLogContext = {}): StudentIdImagePayload | null {
  logOcr("base64", "data_url_parse_start", {
    ...context,
    inputLength: base64Image.length
  });

  const match = base64Image.match(/^data:([^;]+);base64,([\s\S]+)$/);
  if (!match) {
    logOcr("base64", "data_url_parse_failed", { ...context, reason: "invalid_data_url" });
    return null;
  }

  const canonicalBase64 = normalizeBase64(match[2]);
  const declaredMimeType = match[1];
  if (!canonicalBase64) {
    logOcr("base64", "data_url_parse_failed", { ...context, reason: "invalid_base64" });
    return null;
  }

  if (encodedByteLength(canonicalBase64) > MAX_STUDENT_ID_IMAGE_BYTES) {
    logOcr("base64", "data_url_parse_failed", {
      ...context,
      reason: "image_too_large",
      byteLength: encodedByteLength(canonicalBase64),
      maxBytes: MAX_STUDENT_ID_IMAGE_BYTES
    });
    return null;
  }

  const bytes = Buffer.from(canonicalBase64, "base64");
  if (bytes.length !== encodedByteLength(canonicalBase64) || bytes.toString("base64") !== canonicalBase64) {
    logOcr("base64", "data_url_parse_failed", { ...context, reason: "base64_roundtrip_failed" });
    return null;
  }

  return payloadFromBytes(bytes, declaredMimeType, context);
}

function getString(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function nullableString(value: unknown) {
  const text = getString(value);
  return text.length ? text : null;
}

function confidenceScore(value: unknown) {
  const numeric = typeof value === "number" ? value : typeof value === "string" ? Number(value) : 0;
  if (!Number.isFinite(numeric)) return 0;
  return Math.max(0, Math.min(1, numeric));
}

function splitName(fullName: string, firstName: string, lastName: string) {
  if (firstName && lastName) return { firstName, lastName };

  const parts = fullName.split(/\s+/).filter(Boolean);
  if (!firstName && parts.length >= 2) firstName = parts[0];
  if (!lastName && parts.length >= 2) lastName = parts.slice(1).join(" ");

  return { firstName, lastName };
}

function extractJsonObject(content: string) {
  const trimmed = content.trim();
  if (trimmed.startsWith("{") && trimmed.endsWith("}")) {
    return { json: trimmed, repaired: false };
  }

  const fenced = trimmed.match(/^```(?:json)?\s*([\s\S]*?)\s*```$/i);
  if (fenced?.[1]) {
    const fencedContent = fenced[1].trim();
    if (fencedContent.startsWith("{") && fencedContent.endsWith("}")) {
      return { json: fencedContent, repaired: true };
    }
  }

  const start = trimmed.indexOf("{");
  const end = trimmed.lastIndexOf("}");
  if (start >= 0 && end > start) {
    return { json: trimmed.slice(start, end + 1), repaired: true };
  }

  return { json: trimmed, repaired: false };
}

function isIsoDate(value: string | null) {
  return value === null || /^\d{4}-\d{2}-\d{2}$/.test(value);
}

function todayIsoDate() {
  return new Date().toISOString().slice(0, 10);
}

class StudentIdOcrValidationError extends Error {
  reasons: string[];

  constructor(reasons: string[]) {
    super("ocr_validation_failed");
    this.reasons = reasons;
  }
}

function validateOCRData(data: StudentIdOcrData) {
  const failures: string[] = [];
  const today = todayIsoDate();

  if (!data.isStudentId) failures.push("not_student_id_card");
  if (!data.firstName || !data.lastName) failures.push("student_name_missing");
  if (!data.universityName) failures.push("university_name_missing");
  if (!data.studentNumber) failures.push("student_number_missing");
  if (!data.isCurrentlyValid) failures.push("not_currently_valid");
  if (!isIsoDate(data.expiryDate)) failures.push("expiry_date_not_iso");
  if (!isIsoDate(data.issueDate)) failures.push("issue_date_not_iso");
  if (data.expiryDate && data.expiryDate < today) failures.push("student_id_expired");
  if (data.issueDate && data.issueDate > today) failures.push("student_id_issue_date_in_future");
  if (data.confidence.studentName < MIN_NAME_CONFIDENCE) failures.push("student_name_low_confidence");
  if (data.confidence.universityName < MIN_UNIVERSITY_CONFIDENCE) failures.push("university_name_low_confidence");
  if (data.confidence.studentNumber < MIN_STUDENT_NUMBER_CONFIDENCE) failures.push("student_number_low_confidence");
  if (data.confidence.overall < MIN_OVERALL_CONFIDENCE) failures.push("overall_low_confidence");

  return failures;
}

function parseOCRJson(content: string, context: OcrLogContext = {}): StudentIdOcrData {
  const { json, repaired } = extractJsonObject(content);
  let parsed: Record<string, unknown>;

  try {
    parsed = JSON.parse(json) as Record<string, unknown>;
  } catch (error) {
    logOcr("parsing", "json_parse_failed", {
      ...context,
      reason: errorReason(error),
      responseLength: content.length,
      repaired
    });
    throw new Error("malformed_ocr_json");
  }

  const confidenceSource =
    typeof parsed.confidence === "object" && parsed.confidence !== null
      ? (parsed.confidence as Record<string, unknown>)
      : {};

  const fullName = getString(parsed.fullName) || [getString(parsed.firstName), getString(parsed.lastName)].filter(Boolean).join(" ");
  const split = splitName(fullName, getString(parsed.firstName), getString(parsed.lastName));
  const data: StudentIdOcrData = {
    fullName,
    firstName: split.firstName,
    lastName: split.lastName,
    universityName: getString(parsed.universityName),
    studentNumber: getString(parsed.studentNumber),
    expiryDate: nullableString(parsed.expiryDate),
    issueDate: nullableString(parsed.issueDate),
    facultyOrDepartment: nullableString(parsed.facultyOrDepartment),
    isCurrentlyValid: parsed.isCurrentlyValid === true,
    isStudentId: parsed.isStudentId === true,
    confidence: {
      studentName: confidenceScore(confidenceSource.studentName),
      universityName: confidenceScore(confidenceSource.universityName),
      studentNumber: confidenceScore(confidenceSource.studentNumber),
      dates: confidenceScore(confidenceSource.dates),
      overall: confidenceScore(confidenceSource.overall)
    },
    validationFailureReasons: []
  };

  if (
    typeof parsed.isCurrentlyValid !== "boolean" ||
    typeof parsed.isStudentId !== "boolean" ||
    typeof parsed.confidence !== "object" ||
    parsed.confidence === null
  ) {
    throw new Error("invalid_ocr_schema");
  }

  data.validationFailureReasons = validateOCRData(data);
  logOcr("parsing", "json_parse_succeeded", {
    ...context,
    repaired,
    hasFullName: Boolean(data.fullName),
    hasUniversityName: Boolean(data.universityName),
    hasStudentNumber: Boolean(data.studentNumber),
    hasExpiryDate: Boolean(data.expiryDate),
    hasIssueDate: Boolean(data.issueDate),
    hasFacultyOrDepartment: Boolean(data.facultyOrDepartment),
    isStudentId: data.isStudentId,
    isCurrentlyValid: data.isCurrentlyValid,
    confidence: data.confidence,
    validationFailureReasons: data.validationFailureReasons
  });

  if (data.validationFailureReasons.length) {
    throw new StudentIdOcrValidationError(data.validationFailureReasons);
  }

  return data;
}

async function withTimeout<T>(promise: Promise<T>, timeoutMs: number): Promise<T> {
  let timeout: ReturnType<typeof setTimeout> | undefined;
  const timeoutPromise = new Promise<never>((_, reject) => {
    timeout = setTimeout(() => reject(new Error("ocr_timeout")), timeoutMs);
  });

  try {
    return await Promise.race([promise, timeoutPromise]);
  } finally {
    if (timeout) clearTimeout(timeout);
  }
}

export function studentIdObjectPath(userId: string, extension: "jpg" | "png" = "jpg") {
  return `${userId}.${extension}`;
}

async function ensureStudentIdsBucket() {
  const supabase = getSupabaseAdminClient();
  const { data: buckets, error: listError } = await supabase.storage.listBuckets();
  if (listError) throw listError;
  if (buckets?.some((bucket) => bucket.name === STUDENT_ID_BUCKET)) return;

  const { error: createError } = await supabase.storage.createBucket(STUDENT_ID_BUCKET, {
    public: false,
    fileSizeLimit: `${MAX_STUDENT_ID_IMAGE_BYTES}`,
    allowedMimeTypes: ["image/jpeg", "image/png"]
  });
  if (createError) throw createError;
  logOcr("storage", "bucket_created", { bucket: STUDENT_ID_BUCKET });
}

export async function uploadStudentIdImage({
  userId,
  image,
  context = {}
}: {
  userId: string;
  image: StudentIdImagePayload;
  context?: OcrLogContext;
}) {
  await ensureStudentIdsBucket();

  const objectPath = studentIdObjectPath(userId, image.extension);
  logOcr("storage", "upload_start", {
    ...context,
    bucket: STUDENT_ID_BUCKET,
    path: objectPath,
    userId,
    mimeType: image.mimeType,
    byteLength: image.byteLength,
    sha256Prefix: hashPrefix(image.sha256)
  });

  const { error } = await getSupabaseAdminClient()
    .storage
    .from(STUDENT_ID_BUCKET)
    .upload(objectPath, image.bytes, {
      contentType: image.mimeType,
      upsert: true
    });

  if (error) throw error;

  logOcr("storage", "upload_succeeded", {
    ...context,
    bucket: STUDENT_ID_BUCKET,
    path: objectPath,
    userId,
    byteLength: image.byteLength,
    sha256Prefix: hashPrefix(image.sha256)
  });

  return objectPath;
}

export async function downloadStudentIdImage({
  objectPath,
  expectedSha256,
  context = {}
}: {
  objectPath: string;
  expectedSha256?: string;
  context?: OcrLogContext;
}) {
  logOcr("storage", "download_start", {
    ...context,
    bucket: STUDENT_ID_BUCKET,
    path: objectPath
  });

  const { data, error } = await getSupabaseAdminClient()
    .storage
    .from(STUDENT_ID_BUCKET)
    .download(objectPath);

  if (error || !data) {
    logOcrError("storage", "download_failed", {
      ...context,
      bucket: STUDENT_ID_BUCKET,
      path: objectPath,
      reason: error?.message || "empty_blob"
    });
    throw error || new Error("student_id_download_failed");
  }

  const bytes = Buffer.from(await data.arrayBuffer());
  const payload = payloadFromBytes(bytes, data.type, {
    ...context,
    objectPath,
    source: "storage_download"
  });
  if (!payload) throw new Error("student_id_download_invalid_image");

  const hashMatches = expectedSha256 ? payload.sha256 === expectedSha256 : undefined;
  logOcr("storage", "download_succeeded", {
    ...context,
    bucket: STUDENT_ID_BUCKET,
    path: objectPath,
    mimeType: payload.mimeType,
    byteLength: payload.byteLength,
    sha256Prefix: hashPrefix(payload.sha256),
    hashMatches
  });

  if (expectedSha256 && !hashMatches) throw new Error("student_id_storage_bytes_mismatch");
  return payload;
}

export async function deleteStudentIdImage(objectPath: string, context: OcrLogContext = {}) {
  logOcr("privacy_cleanup", "delete_start", {
    ...context,
    bucket: STUDENT_ID_BUCKET,
    path: objectPath
  });

  const { error } = await getSupabaseAdminClient()
    .storage
    .from(STUDENT_ID_BUCKET)
    .remove([objectPath]);

  if (error) {
    logOcrError("privacy_cleanup", "delete_failed", {
      ...context,
      bucket: STUDENT_ID_BUCKET,
      path: objectPath,
      reason: error.message
    });
    throw error;
  }

  logOcr("privacy_cleanup", "delete_succeeded", {
    ...context,
    bucket: STUDENT_ID_BUCKET,
    path: objectPath
  });
}

export async function createStudentIdSignedUrl(objectPath: string, expiresInSeconds = 10 * 60) {
  const { data, error } = await getSupabaseAdminClient()
    .storage
    .from(STUDENT_ID_BUCKET)
    .createSignedUrl(objectPath, expiresInSeconds);

  if (error || !data?.signedUrl) return null;
  return data.signedUrl;
}

function buildStudentIdOcrPrompt() {
  return `
Extract structured OCR data from this university student ID card.

Current date: ${todayIsoDate()}.

Rules:
- The card text may be Turkish, English, Azerbaijani, or mixed-language.
- Read printed text on the physical card only. Ignore logos, seals, holograms, QR codes, barcodes, watermarks, decorative graphics, and background patterns unless they contain readable university text.
- Handle reflections, low lighting, rotated cards, mixed casing, Turkish/Azerbaijani characters, and common student-card labels such as Ogrenci, Öğrenci, Tələbə, Student, Kimlik, ID, No, Number, Fakulte, Fakülte, Faculty, Bolum, Bölüm, Department.
- Do not infer a missing student number from a barcode or QR code. Use only human-readable text.
- Dates must be ISO format YYYY-MM-DD when visible. Use an empty string when a date is not visible.
- Set isCurrentlyValid to true only when the visible expiry date, validity year, academic year, or explicit current-status text supports that the ID is current. If validity is uncertain, set it to false.
- Set isStudentId to false if the image is not a university student ID card.
- Return ONLY valid JSON matching the schema. Do not return Markdown. Do not wrap JSON in a code block.
`.trim();
}

export async function verifyStudentIdWithGemini(
  payload: StudentIdImagePayload,
  context: OcrLogContext = {}
): Promise<StudentIdOcrData> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) throw new Error("gemini_api_key_missing");

  const requestId = context.requestId || randomUUID();
  const model = process.env.GEMINI_OCR_MODEL || DEFAULT_GEMINI_OCR_MODEL;
  const ai = new GoogleGenAI({ apiKey });
  const confidenceSchema: Schema = {
    type: Type.OBJECT,
    properties: {
      studentName: { type: Type.NUMBER, minimum: 0, maximum: 1 },
      universityName: { type: Type.NUMBER, minimum: 0, maximum: 1 },
      studentNumber: { type: Type.NUMBER, minimum: 0, maximum: 1 },
      dates: { type: Type.NUMBER, minimum: 0, maximum: 1 },
      overall: { type: Type.NUMBER, minimum: 0, maximum: 1 }
    },
    required: ["studentName", "universityName", "studentNumber", "dates", "overall"]
  };
  const responseSchema: Schema = {
    type: Type.OBJECT,
    properties: {
      fullName: { type: Type.STRING, description: "Full student name exactly as printed on the card." },
      firstName: { type: Type.STRING },
      lastName: { type: Type.STRING },
      universityName: { type: Type.STRING },
      studentNumber: { type: Type.STRING, description: "Human-readable student number or student ID printed on the card." },
      expiryDate: { type: Type.STRING, description: "Expiry/valid-until date in YYYY-MM-DD, or empty string if not visible." },
      issueDate: { type: Type.STRING, description: "Issue/start date in YYYY-MM-DD, or empty string if not visible." },
      facultyOrDepartment: { type: Type.STRING, description: "Faculty, school, program, or department if printed, otherwise empty string." },
      isStudentId: { type: Type.BOOLEAN },
      isCurrentlyValid: {
        type: Type.BOOLEAN,
        description: "True only when the visible validity information supports current student status."
      },
      confidence: confidenceSchema
    },
    required: [
      "fullName",
      "firstName",
      "lastName",
      "universityName",
      "studentNumber",
      "expiryDate",
      "issueDate",
      "facultyOrDepartment",
      "isStudentId",
      "isCurrentlyValid",
      "confidence"
    ],
    propertyOrdering: [
      "fullName",
      "firstName",
      "lastName",
      "universityName",
      "studentNumber",
      "expiryDate",
      "issueDate",
      "facultyOrDepartment",
      "isStudentId",
      "isCurrentlyValid",
      "confidence"
    ]
  };

  logOcr("gemini_request", "request_start", {
    ...context,
    requestId,
    model,
    mimeType: payload.mimeType,
    byteLength: payload.byteLength,
    base64Length: payload.rawBase64.length,
    sha256Prefix: hashPrefix(payload.sha256),
    responseMimeType: "application/json",
    inlineData: true
  });

  const response = await withTimeout(
    ai.models.generateContent({
      model,
      contents: [
        {
          role: "user",
          parts: [
            { text: buildStudentIdOcrPrompt() },
            {
              inlineData: {
                data: payload.rawBase64,
                mimeType: payload.mimeType
              }
            }
          ]
        }
      ],
      config: {
        systemInstruction: "You are a strict OCR extraction engine for university student ID cards. Output only schema-valid JSON.",
        responseMimeType: "application/json",
        responseSchema,
        maxOutputTokens: 1200
      }
    }),
    OCR_TIMEOUT_MS
  );

  logOcr("gemini_response", "response_received", {
    ...context,
    requestId,
    model,
    responseTextLength: response.text?.length || 0,
    candidateCount: response.candidates?.length || 0,
    finishReason: response.candidates?.[0]?.finishReason || null
  });

  if (!response.text) throw new Error("gemini_empty_response");
  return parseOCRJson(response.text, { ...context, requestId });
}
