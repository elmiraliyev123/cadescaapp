import crypto from "node:crypto";

export function isExactRedirectAllowed(allowedRedirectUris: readonly string[], requestedRedirectUri: string) {
  return allowedRedirectUris.includes(requestedRedirectUri);
}

export function isValidOAuthState(value: string | null) {
  return Boolean(value && value.length >= 16 && value.length <= 512);
}

export function isValidPkceValue(value: string | null) {
  return Boolean(value && value.length >= 43 && value.length <= 128 && /^[A-Za-z0-9._~-]+$/.test(value));
}

export function derivePkceChallenge(verifier: string) {
  return crypto.createHash("sha256").update(verifier, "utf8").digest("base64url");
}
