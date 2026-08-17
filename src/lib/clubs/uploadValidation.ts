export const MAX_CLUB_IMAGE_BYTES = 4 * 1024 * 1024;
export const MAX_CLUB_DOCUMENT_BYTES = 9 * 1024 * 1024;

export const CLUB_IMAGE_ACCEPT = [
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/heic",
  "image/heif",
  ".jpg",
  ".jpeg",
  ".png",
  ".webp",
  ".heic",
  ".heif"
].join(",");

export const CLUB_DOCUMENT_ACCEPT = ["application/pdf", CLUB_IMAGE_ACCEPT, ".pdf"].join(",");

export type ClubImageKind = "jpg" | "png" | "webp" | "heic" | "heif";
export type ClubDocumentKind = ClubImageKind | "pdf";
export type ClubUploadValidationCode =
  | "empty_file"
  | "image_file_too_large"
  | "document_file_too_large"
  | "unsupported_image_type"
  | "unsupported_document_type";

export type ValidatedClubUpload = {
  extension: ClubDocumentKind;
  contentType: string;
  isHeif: boolean;
};

export class ClubUploadValidationError extends Error {
  code: ClubUploadValidationCode;

  constructor(code: ClubUploadValidationCode) {
    super(code);
    this.name = "ClubUploadValidationError";
    this.code = code;
  }
}

const IMAGE_KIND_BY_EXTENSION: Record<string, ClubImageKind> = {
  heic: "heic",
  heif: "heif",
  jpeg: "jpg",
  jpg: "jpg",
  png: "png",
  webp: "webp"
};

const IMAGE_KIND_BY_MIME: Record<string, ClubImageKind> = {
  "image/heic": "heic",
  "image/heic-sequence": "heic",
  "image/heif": "heif",
  "image/heif-sequence": "heif",
  "image/jpeg": "jpg",
  "image/jpg": "jpg",
  "image/png": "png",
  "image/webp": "webp"
};

const CONTENT_TYPE_BY_KIND: Record<ClubDocumentKind, string> = {
  heic: "image/heic",
  heif: "image/heif",
  jpg: "image/jpeg",
  pdf: "application/pdf",
  png: "image/png",
  webp: "image/webp"
};

function ascii(bytes: Uint8Array, start: number, end: number) {
  return String.fromCharCode(...bytes.subarray(start, end));
}

function filenameExtension(name: string) {
  const match = name.trim().toLowerCase().match(/\.([a-z0-9]+)$/);
  return match?.[1] || null;
}

function normalizeDeclaredMime(value: string) {
  const normalized = value.split(";", 1)[0]?.trim().toLowerCase() || "";
  if (!normalized || normalized === "application/octet-stream") return null;
  return normalized;
}

function sameImageFamily(left: ClubImageKind, right: ClubImageKind) {
  const canonical = (kind: ClubImageKind) => kind === "heic" || kind === "heif" ? "heif" : kind;
  return canonical(left) === canonical(right);
}

function detectIsoImage(bytes: Uint8Array): ClubImageKind | "avif" | null {
  if (bytes.length < 16 || ascii(bytes, 4, 8) !== "ftyp") return null;
  const declaredSize = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength).getUint32(0, false);
  const boxEnd = Math.min(bytes.length, declaredSize >= 16 ? declaredSize : bytes.length);
  const brands: string[] = [ascii(bytes, 8, 12).toLowerCase()];
  for (let offset = 16; offset + 4 <= boxEnd; offset += 4) brands.push(ascii(bytes, offset, offset + 4).toLowerCase());
  if (brands.some((brand) => brand === "avif" || brand === "avis")) return "avif";
  if (brands.some((brand) => ["heic", "heix", "hevc", "hevx", "heim", "heis", "hevm", "hevs"].includes(brand))) {
    return "heic";
  }
  if (brands.some((brand) => brand === "mif1" || brand === "msf1")) return "heif";
  return null;
}

function detectImageKind(bytes: Uint8Array): ClubImageKind | null {
  if (bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) return "jpg";
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
  ) return "png";
  if (bytes.length >= 12 && ascii(bytes, 0, 4) === "RIFF" && ascii(bytes, 8, 12) === "WEBP") return "webp";
  const isoKind = detectIsoImage(bytes);
  return isoKind === "avif" ? null : isoKind;
}

function isPdf(bytes: Uint8Array) {
  return bytes.length >= 5 && ascii(bytes, 0, 5) === "%PDF-";
}

async function leadingBytes(file: File) {
  return new Uint8Array(await file.slice(0, 128).arrayBuffer());
}

async function validateImage(
  file: File,
  maximumBytes: number,
  tooLargeCode: ClubUploadValidationCode,
  unsupportedCode: ClubUploadValidationCode
) {
  if (!file.size) throw new ClubUploadValidationError("empty_file");
  if (file.size > maximumBytes) throw new ClubUploadValidationError(tooLargeCode);

  const extension = filenameExtension(file.name || "");
  const extensionKind = extension ? IMAGE_KIND_BY_EXTENSION[extension] : null;
  const declaredMime = normalizeDeclaredMime(file.type || "");
  const declaredKind = declaredMime ? IMAGE_KIND_BY_MIME[declaredMime] : null;
  const detectedKind = detectImageKind(await leadingBytes(file));

  if (
    !extensionKind ||
    (declaredMime && !declaredKind) ||
    !detectedKind ||
    !sameImageFamily(extensionKind, detectedKind) ||
    (declaredKind && !sameImageFamily(declaredKind, detectedKind))
  ) {
    throw new ClubUploadValidationError(unsupportedCode);
  }

  return {
    extension: detectedKind,
    contentType: CONTENT_TYPE_BY_KIND[detectedKind],
    isHeif: detectedKind === "heic" || detectedKind === "heif"
  } satisfies ValidatedClubUpload;
}

export async function validateClubImageFile(file: File) {
  return validateImage(file, MAX_CLUB_IMAGE_BYTES, "image_file_too_large", "unsupported_image_type");
}

export async function validateClubDocumentFile(file: File) {
  if (!file.size) throw new ClubUploadValidationError("empty_file");
  if (file.size > MAX_CLUB_DOCUMENT_BYTES) throw new ClubUploadValidationError("document_file_too_large");

  const extension = filenameExtension(file.name || "");
  const declaredMime = normalizeDeclaredMime(file.type || "");
  const bytes = await leadingBytes(file);
  if (extension === "pdf") {
    if ((declaredMime && declaredMime !== "application/pdf") || !isPdf(bytes)) {
      throw new ClubUploadValidationError("unsupported_document_type");
    }
    return { extension: "pdf", contentType: "application/pdf", isHeif: false } satisfies ValidatedClubUpload;
  }

  try {
    return await validateImage(file, MAX_CLUB_DOCUMENT_BYTES, "document_file_too_large", "unsupported_document_type");
  } catch (error) {
    if (error instanceof ClubUploadValidationError && error.code === "image_file_too_large") {
      throw new ClubUploadValidationError("document_file_too_large");
    }
    throw error instanceof ClubUploadValidationError
      ? new ClubUploadValidationError("unsupported_document_type")
      : error;
  }
}
