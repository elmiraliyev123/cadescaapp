import "server-only";

import { randomBytes } from "node:crypto";
import type { PoolClient, QueryResult } from "pg";

import { consumeGoogleWalletTotpCounter, loadGoogleWalletPassByUniqueId } from "./googleWallet";
import { parseGoogleWalletQrPayload, verifyDynamicQR, verifyGoogleWalletQR } from "./totp";
import { getReadyPool } from "./users";

export type QrTokenRow = {
  id: string;
  token: string;
  user_id: string;
  status: string;
  expires_at: Date;
  created_at: Date;
  used_at: Date | null;
};

export type QrCredential =
  | { kind: "stored"; userId: string; qrTokenId: string; token: string }
  | {
      kind: "totp";
      userId: string;
      qrTokenId: null;
      token: string;
      uniqueWalletPassId: string | null;
      totpCounter: number | null;
    };

export type QrCredentialErrorCode =
  | "invalid_format"
  | "token_not_found"
  | "token_already_used"
  | "token_expired";

export class QrCredentialError extends Error {
  code: QrCredentialErrorCode;

  constructor(code: QrCredentialErrorCode) {
    super(code);
    this.name = "QrCredentialError";
    this.code = code;
  }
}

type QueryExecutor = {
  query: <T extends object = Record<string, unknown>>(text: string, values?: unknown[]) => Promise<QueryResult<T>>;
};

function generateStoredQrToken() {
  return `cqt_${randomBytes(18).toString("base64url")}`;
}

export function extractScannedCredential(input: string) {
  const value = String(input || "").trim();
  if (!value || value.length > 512) return "";

  try {
    const url = new URL(value);
    const queryToken = url.searchParams.get("t");
    if (queryToken) return queryToken.trim();
  } catch {
    // Raw QR payloads are expected for Wallet rotating barcodes.
  }

  return value;
}

export function normalizeStoredQrToken(input: string) {
  const token = extractScannedCredential(input).replace(/\s+/g, "");
  return /^cqt_[A-Za-z0-9_-]{16,128}$/.test(token) ? token : "";
}

export async function createFreshQrTokenForUser(userId: string): Promise<QrTokenRow> {
  const pool = await getReadyPool();
  const client = await pool.connect();
  const id = `qr_${randomBytes(8).toString("hex")}`;
  const tokenString = generateStoredQrToken();
  const expiresAt = new Date(Date.now() + 15 * 60 * 1000);

  try {
    await client.query("BEGIN");
    await client.query("UPDATE qr_tokens SET status = 'expired' WHERE user_id = $1 AND status = 'active'", [userId]);
    const result = await client.query<QrTokenRow>(
      `INSERT INTO qr_tokens (id, token, user_id, status, expires_at)
       VALUES ($1, $2, $3, 'active', $4)
       RETURNING *`,
      [id, tokenString, userId, expiresAt]
    );
    await client.query("COMMIT");
    return result.rows[0];
  } catch (error) {
    await client.query("ROLLBACK").catch(() => undefined);
    throw error;
  } finally {
    client.release();
  }
}

export async function verifyStoredQrToken(
  tokenInput: string,
  options: { client?: PoolClient; lock?: boolean } = {}
): Promise<QrCredential> {
  const tokenString = normalizeStoredQrToken(tokenInput);
  if (!tokenString) throw new QrCredentialError("invalid_format");

  const executor: QueryExecutor = options.client || (await getReadyPool());
  const result = await executor.query<QrTokenRow>(
    `SELECT *
     FROM qr_tokens
     WHERE token = $1
     LIMIT 1${options.lock ? " FOR UPDATE" : ""}`,
    [tokenString]
  );

  const record = result.rows[0];
  if (!record) throw new QrCredentialError("token_not_found");
  if (record.status !== "active") throw new QrCredentialError("token_already_used");
  if (Date.now() > record.expires_at.getTime()) throw new QrCredentialError("token_expired");

  return { kind: "stored", userId: record.user_id, qrTokenId: record.id, token: tokenString };
}

export async function verifyQrCredential(
  scannedPayload: string,
  options: { client?: PoolClient; lockStoredToken?: boolean } = {}
): Promise<QrCredential> {
  const credential = extractScannedCredential(scannedPayload);
  if (!credential) throw new QrCredentialError("invalid_format");

  if (credential.startsWith("cqt_")) {
    return verifyStoredQrToken(credential, { client: options.client, lock: options.lockStoredToken });
  }

  const googleWalletPayload = parseGoogleWalletQrPayload(credential);
  if (googleWalletPayload) {
    const pass = await loadGoogleWalletPassByUniqueId(googleWalletPayload.uniqueWalletPassId, {
      executor: options.client,
      lock: options.lockStoredToken
    });

    if (!pass) throw new QrCredentialError("token_not_found");
    if (pass.revoked || pass.status === "revoked") throw new QrCredentialError("token_already_used");
    if (pass.status === "expired" || (pass.expires_at && Date.now() > new Date(pass.expires_at).getTime())) {
      throw new QrCredentialError("token_expired");
    }

    const walletResult = verifyGoogleWalletQR(credential, pass.unique_wallet_pass_id);
    const walletCounter = walletResult.counter;
    if (!walletResult.valid || !walletResult.userId || typeof walletCounter !== "number" || !Number.isSafeInteger(walletCounter)) {
      throw new QrCredentialError(walletResult.reason === "expired" ? "token_expired" : "invalid_format");
    }
    if (walletResult.userId !== pass.user_id) throw new QrCredentialError("invalid_format");

    const lastCounter = pass.last_totp_counter === null ? null : Number(pass.last_totp_counter);
    if (lastCounter !== null && Number.isFinite(lastCounter) && lastCounter >= walletCounter) {
      throw new QrCredentialError("token_already_used");
    }

    return {
      kind: "totp",
      userId: walletResult.userId,
      qrTokenId: null,
      token: credential,
      uniqueWalletPassId: pass.unique_wallet_pass_id,
      totpCounter: walletCounter
    };
  }

  const dynamicResult = verifyDynamicQR(credential);
  if (!dynamicResult.valid || !dynamicResult.userId) {
    throw new QrCredentialError(dynamicResult.reason === "expired" ? "token_expired" : "invalid_format");
  }

  return { kind: "totp", userId: dynamicResult.userId, qrTokenId: null, token: credential, uniqueWalletPassId: null, totpCounter: null };
}

export async function markStoredQrTokenAsUsed(qrTokenId: string, client?: PoolClient) {
  const executor: QueryExecutor = client || (await getReadyPool());
  const result = await executor.query(
    `UPDATE qr_tokens
     SET status = 'used', used_at = now()
     WHERE id = $1 AND status = 'active'`,
    [qrTokenId]
  );
  return result.rowCount === 1;
}

export async function markTotpCredentialAsUsed(credential: QrCredential, client: PoolClient) {
  if (credential.kind !== "totp" || !credential.uniqueWalletPassId || credential.totpCounter === null) {
    return true;
  }

  return consumeGoogleWalletTotpCounter({
    uniqueWalletPassId: credential.uniqueWalletPassId,
    userId: credential.userId,
    counter: credential.totpCounter,
    client
  });
}
