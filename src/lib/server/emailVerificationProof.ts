import "server-only";

import { createHmac, randomUUID, timingSafeEqual } from "node:crypto";

import { normalizeVerificationEmail, type EmailVerificationPurpose } from "./verificationCodes";

const EMAIL_VERIFICATION_PROOF_TTL_MS = 10 * 60 * 1000;

type EmailVerificationProofPayload = {
  email: string;
  purpose: EmailVerificationPurpose;
  verificationId: string;
  nonce: string;
  issuedAt: number;
  expiresAt: number;
};

function base64UrlEncode(value: string | Buffer) {
  return Buffer.from(value).toString("base64url");
}

function base64UrlDecode(value: string) {
  return Buffer.from(value, "base64url").toString("utf8");
}

function getAuthSecret() {
  const secret = process.env.AUTH_SECRET;
  if (!secret) throw new Error("AUTH_SECRET is not configured");
  return secret;
}

function sign(encodedPayload: string) {
  return createHmac("sha256", getAuthSecret()).update(encodedPayload).digest("base64url");
}

function safeEqual(left: string, right: string) {
  const leftBuffer = Buffer.from(left);
  const rightBuffer = Buffer.from(right);
  return leftBuffer.length === rightBuffer.length && timingSafeEqual(leftBuffer, rightBuffer);
}

function parsePayload(encodedPayload: string): EmailVerificationProofPayload | null {
  try {
    const parsed = JSON.parse(base64UrlDecode(encodedPayload)) as Partial<EmailVerificationProofPayload>;
    if (
      typeof parsed.email !== "string" ||
      (parsed.purpose !== "signup" && parsed.purpose !== "login" && parsed.purpose !== "password_reset") ||
      typeof parsed.verificationId !== "string" ||
      typeof parsed.nonce !== "string" ||
      typeof parsed.issuedAt !== "number" ||
      typeof parsed.expiresAt !== "number"
    ) {
      return null;
    }

    return parsed as EmailVerificationProofPayload;
  } catch {
    return null;
  }
}

export async function createEmailVerificationProof({
  email,
  purpose,
  verificationId,
  expiresAt,
  now = Date.now()
}: {
  email: string;
  purpose: EmailVerificationPurpose;
  verificationId: string;
  expiresAt?: string | number | Date;
  now?: number;
}) {
  const sourceExpiresAt =
    expiresAt === undefined
      ? Number.POSITIVE_INFINITY
      : expiresAt instanceof Date
        ? expiresAt.getTime()
        : typeof expiresAt === "number"
          ? expiresAt
          : new Date(expiresAt).getTime();

  const payload: EmailVerificationProofPayload = {
    email: normalizeVerificationEmail(email),
    purpose,
    verificationId,
    nonce: randomUUID(),
    issuedAt: now,
    expiresAt: Math.min(now + EMAIL_VERIFICATION_PROOF_TTL_MS, Number.isFinite(sourceExpiresAt) ? sourceExpiresAt : now)
  };
  const encodedPayload = base64UrlEncode(JSON.stringify(payload));
  return `${encodedPayload}.${sign(encodedPayload)}`;
}

export async function verifyEmailVerificationProof(
  token: unknown,
  {
    email,
    purpose,
    now = Date.now()
  }: {
    email: string;
    purpose: EmailVerificationPurpose;
    now?: number;
  }
) {
  const normalizedToken = typeof token === "string" ? token.trim() : "";
  if (!normalizedToken) return { status: "missing" as const };

  const [encodedPayload, signature] = normalizedToken.split(".");
  if (!encodedPayload || !signature) return { status: "invalid" as const };

  const expectedSignature = sign(encodedPayload);
  if (!safeEqual(signature, expectedSignature)) return { status: "invalid" as const };

  const payload = parsePayload(encodedPayload);
  if (!payload) return { status: "invalid" as const };
  if (payload.expiresAt <= now) return { status: "expired" as const, payload };
  if (payload.email !== normalizeVerificationEmail(email) || payload.purpose !== purpose) {
    return { status: "invalid" as const };
  }

  return { status: "verified" as const, payload };
}
