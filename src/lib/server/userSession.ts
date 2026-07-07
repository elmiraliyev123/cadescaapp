export const USER_SESSION_COOKIE = "cadesca_user_session";
export const USER_SESSION_TTL_SECONDS = 60 * 60 * 24 * 30; // 30 days

export type UserSessionPayload = {
  role: "user" | "merchant";
  id: string;
  email: string;
  issuedAt: number;
  expiresAt: number;
};

const encoder = new TextEncoder();
const decoder = new TextDecoder();

function base64UrlEncode(bytes: Uint8Array) {
  const binary = Array.from(bytes, (byte) => String.fromCharCode(byte)).join("");
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

function base64UrlDecode(value: string) {
  const normalized = value.replace(/-/g, "+").replace(/_/g, "/");
  const padded = normalized.padEnd(normalized.length + ((4 - (normalized.length % 4)) % 4), "=");
  const binary = atob(padded);
  return Uint8Array.from(binary, (character) => character.charCodeAt(0));
}

function encodeJson(value: unknown) {
  return base64UrlEncode(encoder.encode(JSON.stringify(value)));
}

function decodeJson<T>(value: string): T {
  return JSON.parse(decoder.decode(base64UrlDecode(value))) as T;
}

async function getSigningKey(secret: string) {
  if (!globalThis.crypto?.subtle) {
    throw new Error("Web Crypto is required for session signing.");
  }

  return globalThis.crypto.subtle.importKey(
    "raw",
    encoder.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign", "verify"]
  );
}

async function signValue(value: string, secret: string) {
  const key = await getSigningKey(secret);
  const signature = await globalThis.crypto.subtle.sign("HMAC", key, encoder.encode(value));
  return base64UrlEncode(new Uint8Array(signature));
}

async function verifyValue(value: string, signature: string, secret: string) {
  const key = await getSigningKey(secret);
  return globalThis.crypto.subtle.verify("HMAC", key, base64UrlDecode(signature), encoder.encode(value));
}

export async function createUserSessionToken(id: string, email: string, role: "user" | "merchant", secret: string, now = Date.now()) {
  const payload: UserSessionPayload = {
    role,
    id,
    email,
    issuedAt: now,
    expiresAt: now + USER_SESSION_TTL_SECONDS * 1000
  };
  const encodedPayload = encodeJson(payload);
  const signature = await signValue(encodedPayload, secret);

  return {
    token: `${encodedPayload}.${signature}`,
    payload
  };
}

export async function verifyUserSessionToken(token: string | undefined, secret: string, now = Date.now()) {
  if (!token || !secret) return null;

  const parts = token.split(".");
  if (parts.length !== 2 || !parts[0] || !parts[1]) return null;

  const [encodedPayload, signature] = parts;
  const validSignature = await verifyValue(encodedPayload, signature, secret).catch(() => false);
  if (!validSignature) return null;

  const payload = (() => {
    try {
      return decodeJson<UserSessionPayload>(encodedPayload);
    } catch {
      return null;
    }
  })();

  if (!payload || (payload.role !== "user" && payload.role !== "merchant") || !payload.id || payload.expiresAt <= now) {
    return null;
  }

  return payload;
}
