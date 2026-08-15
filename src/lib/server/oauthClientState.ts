import "server-only";

import crypto from "node:crypto";

type OAuthClientState = {
  state: string;
  nonce: string;
  verifier: string;
  returnTo: string;
  expiresAt: number;
};

function secret() {
  const value = process.env.AUTH_SECRET;
  if (!value) throw new Error("AUTH_SECRET is not defined");
  return value;
}

function signature(payload: string) {
  return crypto.createHmac("sha256", secret()).update(payload).digest("base64url");
}

export function createOAuthClientState(returnTo: string) {
  const state: OAuthClientState = {
    state: crypto.randomBytes(24).toString("base64url"),
    nonce: crypto.randomBytes(24).toString("base64url"),
    verifier: crypto.randomBytes(48).toString("base64url"),
    returnTo,
    expiresAt: Date.now() + 10 * 60 * 1000
  };
  const payload = Buffer.from(JSON.stringify(state), "utf8").toString("base64url");
  return { state, token: `${payload}.${signature(payload)}` };
}

export function verifyOAuthClientState(token: string | undefined) {
  if (!token) return null;
  const [payload, suppliedSignature, extra] = token.split(".");
  if (!payload || !suppliedSignature || extra) return null;
  const expected = signature(payload);
  const expectedBytes = Buffer.from(expected);
  const suppliedBytes = Buffer.from(suppliedSignature);
  if (expectedBytes.length !== suppliedBytes.length || !crypto.timingSafeEqual(expectedBytes, suppliedBytes)) return null;
  try {
    const state = JSON.parse(Buffer.from(payload, "base64url").toString("utf8")) as OAuthClientState;
    if (!state.state || !state.nonce || !state.verifier || state.expiresAt <= Date.now()) return null;
    return state;
  } catch {
    return null;
  }
}

export function oauthPkceChallenge(verifier: string) {
  return crypto.createHash("sha256").update(verifier, "utf8").digest("base64url");
}

