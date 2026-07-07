import "server-only";

import crypto from "node:crypto";

const TOTP_DIGITS = 6;
const LEGACY_TOTP_PERIOD_SECONDS = 300;
export const GOOGLE_WALLET_TOTP_PERIOD_SECONDS = 60;
const TOTP_ALLOWED_WINDOW = 1;
const USER_ID_PATTERN = /^[A-Za-z0-9_-]{3,128}$/;
const WALLET_PASS_ID_PATTERN = /^[A-Za-z0-9_-]{8,128}$/;
const WALLET_QR_PREFIX = "cadesca:google";

/**
 * Deterministically generates a TOTP secret for a given user.
 * The standard base64 secret required by Apple and Google Wallets.
 */
export function getUserTotpSecretBase64(userId: string): string {
  return deriveTotpSecretBytes("legacy", normalizeUserId(userId)).toString("base64");
}

export function getGoogleWalletTotpSecretHex(userId: string, uniqueWalletPassId: string): string {
  return deriveTotpSecretBytes("google_wallet", `${normalizeUserId(userId)}:${normalizeWalletPassId(uniqueWalletPassId)}`).toString("hex");
}

export function getGoogleWalletTotpSecretBase64(userId: string, uniqueWalletPassId: string): string {
  return Buffer.from(getGoogleWalletTotpSecretHex(userId, uniqueWalletPassId), "hex").toString("base64");
}

function normalizeUserId(userId: string) {
  const normalizedUserId = typeof userId === "string" ? userId.trim() : "";
  if (!USER_ID_PATTERN.test(normalizedUserId)) {
    throw new Error("Invalid user id for TOTP secret generation");
  }

  return normalizedUserId;
}

function normalizeWalletPassId(uniqueWalletPassId: string) {
  const normalized = typeof uniqueWalletPassId === "string" ? uniqueWalletPassId.trim() : "";
  if (!WALLET_PASS_ID_PATTERN.test(normalized)) {
    throw new Error("Invalid wallet pass id for TOTP secret generation");
  }

  return normalized;
}

function deriveTotpSecretBytes(scope: string, identity: string) {
  const masterSecret = process.env.AUTH_SECRET;
  if (!masterSecret) {
    throw new Error("AUTH_SECRET is not defined");
  }

  return crypto.createHmac("sha256", masterSecret).update(`totp_secret_${scope}:${identity}`).digest().subarray(0, 20);
}

function timingSafeTokenEquals(left: string, right: string) {
  const leftBuffer = Buffer.from(left);
  const rightBuffer = Buffer.from(right);
  return leftBuffer.length === rightBuffer.length && crypto.timingSafeEqual(leftBuffer, rightBuffer);
}

function generateTotpAtCounter(secretBuffer: Buffer, counter: number) {
  const stepBuffer = Buffer.alloc(8);
  stepBuffer.writeBigInt64BE(BigInt(counter), 0);

  const hmac = crypto.createHmac("sha1", secretBuffer).update(stepBuffer).digest();
  const offset = hmac[hmac.length - 1] & 0xf;
  const binary =
    ((hmac[offset] & 0x7f) << 24) |
    ((hmac[offset + 1] & 0xff) << 16) |
    ((hmac[offset + 2] & 0xff) << 8) |
    (hmac[offset + 3] & 0xff);

  return (binary % 10 ** TOTP_DIGITS).toString().padStart(TOTP_DIGITS, "0");
}

/**
 * Native Node.js TOTP validator implementing RFC 6238.
 */
function verifyNativeTOTP(
  token: string,
  secretBase64: string,
  period = LEGACY_TOTP_PERIOD_SECONDS,
  window = TOTP_ALLOWED_WINDOW,
  now = Date.now()
): { valid: boolean; counter?: number } {
  if (!/^\d{6}$/.test(token)) return { valid: false };
  if (!Number.isFinite(period) || period <= 0) return { valid: false };
  if (!Number.isInteger(window) || window < 0 || window > 2) return { valid: false };

  const secretBuffer = Buffer.from(secretBase64, "base64");
  if (secretBuffer.length < 16) return { valid: false };

  const timeStep = Math.floor(now / 1000 / period);
  if (!Number.isSafeInteger(timeStep) || timeStep < 0) return { valid: false };

  for (let offsetWindow = -window; offsetWindow <= window; offsetWindow += 1) {
    const step = timeStep + offsetWindow;
    if (step < 0) continue;

    const otp = generateTotpAtCounter(secretBuffer, step);
    if (timingSafeTokenEquals(otp, token)) return { valid: true, counter: step };
  }

  return { valid: false };
}

export function parseGoogleWalletQrPayload(scannedPayload: string) {
  const payload = typeof scannedPayload === "string" ? scannedPayload.trim() : "";
  if (!payload || payload.length > 512) return null;
  if (!payload.startsWith(`${WALLET_QR_PREFIX}:`)) return null;

  const parts = payload.split(":");
  if (parts.length !== 6 || `${parts[0]}:${parts[1]}` !== WALLET_QR_PREFIX) return null;

  const uniqueWalletPassId = parts[2]?.trim() || "";
  const userId = parts[3]?.trim() || "";
  const rawTimestamp = parts[4]?.trim() || "";
  const totp = parts[5]?.trim() || "";
  const timestampValue = Number(rawTimestamp);
  const timestampSeconds = rawTimestamp.length >= 13 ? Math.floor(timestampValue / 1000) : timestampValue;

  if (!WALLET_PASS_ID_PATTERN.test(uniqueWalletPassId) || !USER_ID_PATTERN.test(userId)) return null;
  if (!/^\d{6}$/.test(totp)) return null;
  if (!/^\d{10,13}$/.test(rawTimestamp) || !Number.isSafeInteger(timestampValue) || !Number.isSafeInteger(timestampSeconds)) return null;

  return { uniqueWalletPassId, userId, timestampSeconds, totp };
}

export function verifyGoogleWalletQR(
  scannedPayload: string,
  uniqueWalletPassId: string,
  now = Date.now()
): {
  valid: boolean;
  userId?: string;
  uniqueWalletPassId?: string;
  counter?: number;
  reason?: "invalid_format" | "expired" | "server_misconfigured";
} {
  const parsed = parseGoogleWalletQrPayload(scannedPayload);
  if (!parsed || parsed.uniqueWalletPassId !== uniqueWalletPassId) {
    return { valid: false, reason: "invalid_format" };
  }

  const nowSeconds = Math.floor(now / 1000);
  const maxDriftSeconds = GOOGLE_WALLET_TOTP_PERIOD_SECONDS * (TOTP_ALLOWED_WINDOW + 1);
  if (Math.abs(nowSeconds - parsed.timestampSeconds) > maxDriftSeconds) {
    return { valid: false, reason: "expired" };
  }

  try {
    const secretBuffer = Buffer.from(getGoogleWalletTotpSecretHex(parsed.userId, parsed.uniqueWalletPassId), "hex");
    const counter = Math.floor(parsed.timestampSeconds / GOOGLE_WALLET_TOTP_PERIOD_SECONDS);
    if (!Number.isSafeInteger(counter) || counter < 0) return { valid: false, reason: "invalid_format" };

    const expected = generateTotpAtCounter(secretBuffer, counter);
    if (!timingSafeTokenEquals(expected, parsed.totp)) return { valid: false, reason: "expired" };

    return {
      valid: true,
      userId: parsed.userId,
      uniqueWalletPassId: parsed.uniqueWalletPassId,
      counter
    };
  } catch {
    return { valid: false, reason: "server_misconfigured" };
  }
}

function parseLegacyDynamicQrPayload(scannedPayload: string) {
  const payload = typeof scannedPayload === "string" ? scannedPayload.trim() : "";
  if (!payload || payload.length > 256) return null;

  const separator = payload.includes("\n") ? "\n" : payload.includes(":") ? ":" : "";
  if (!separator) return null;

  const [rawUserId, rawTotp, ...extra] = payload.split(separator);
  if (extra.length > 0) return null;

  const userId = rawUserId.trim();
  const totp = rawTotp.trim();
  if (!USER_ID_PATTERN.test(userId) || !/^\d{6}$/.test(totp)) return null;

  return { userId, totp };
}

/**
 * Verifies the incoming dynamic QR payload from Apple/Google Wallet.
 */
export function verifyDynamicQR(
  scannedPayload: string,
  now = Date.now()
): { valid: boolean; userId?: string; reason?: "invalid_format" | "expired" | "server_misconfigured" } {
  const parsed = parseLegacyDynamicQrPayload(scannedPayload);
  if (!parsed) return { valid: false, reason: "invalid_format" };

  try {
    const secretBase64 = getUserTotpSecretBase64(parsed.userId);
    const result = verifyNativeTOTP(parsed.totp, secretBase64, LEGACY_TOTP_PERIOD_SECONDS, TOTP_ALLOWED_WINDOW, now);
    return result.valid ? { valid: true, userId: parsed.userId } : { valid: false, reason: "expired" };
  } catch {
    return { valid: false, reason: "server_misconfigured" };
  }
}
