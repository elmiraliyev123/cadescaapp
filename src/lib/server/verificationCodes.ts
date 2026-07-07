import "server-only";

import { createHmac, randomInt, randomUUID, timingSafeEqual } from "node:crypto";
import type { Pool } from "pg";

import { getPool as getSharedDbPool, MerchantDbError } from "./merchants";

export const VERIFICATION_CODE_TTL_MS = 10 * 60 * 1000;
export const MAX_VERIFICATION_ATTEMPTS = 5;

export type EmailVerificationPurpose = "signup" | "login" | "password_reset";

export type EmailVerificationCode = {
  id: string;
  email: string;
  codeHash: string;
  purpose: EmailVerificationPurpose;
  expiresAt: string;
  consumedAt?: string | null;
  attempts: number;
  createdAt: string;
};

type VerificationStore = {
  codes: EmailVerificationCode[];
  sentAtByEmailAndPurpose: Map<string, number>;
  pool?: Pool | null;
  tableReady?: Promise<void>;
};

type VerificationCodeLookup = {
  email: string;
  purpose: EmailVerificationPurpose;
  now?: number;
  includeExpired?: boolean;
};

type VerificationCodeRow = {
  id: string;
  email: string;
  code_hash: string;
  purpose: EmailVerificationPurpose;
  expires_at: Date | string;
  consumed_at: Date | string | null;
  attempts: number;
  created_at: Date | string;
};

export class VerificationCodeConfigurationError extends Error {
  constructor(message = "AUTH_SECRET and DATABASE_URL must be configured before creating or verifying email codes.") {
    super(message);
    this.name = "VerificationCodeConfigurationError";
  }
}

const globalForVerification = globalThis as typeof globalThis & {
  __cadescaEmailVerificationStore?: VerificationStore;
};

function getStore() {
  globalForVerification.__cadescaEmailVerificationStore ??= {
    codes: [],
    sentAtByEmailAndPurpose: new Map<string, number>()
  };
  return globalForVerification.__cadescaEmailVerificationStore;
}

function toIso(value: Date | string | null | undefined) {
  if (!value) return null;
  return value instanceof Date ? value.toISOString() : new Date(value).toISOString();
}

function mapRow(row: VerificationCodeRow): EmailVerificationCode {
  return {
    id: row.id,
    email: row.email,
    codeHash: row.code_hash,
    purpose: row.purpose,
    expiresAt: toIso(row.expires_at) || new Date().toISOString(),
    consumedAt: toIso(row.consumed_at),
    attempts: row.attempts,
    createdAt: toIso(row.created_at) || new Date().toISOString()
  };
}

function getPool() {
  const store = getStore();
  if (store.pool !== undefined) return store.pool;

  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    if (process.env.NODE_ENV === "production") {
      throw new VerificationCodeConfigurationError("DATABASE_URL must be configured for production email verification.");
    }
    store.pool = null;
    return store.pool;
  }

  try {
    store.pool = getSharedDbPool();
  } catch (error) {
    if (error instanceof MerchantDbError && error.code === "database_connection_failed") {
      throw new VerificationCodeConfigurationError("DATABASE_URL must be configured for production email verification.");
    }
    throw error;
  }
  return store.pool;
}

async function ensureVerificationTable() {
  const pool = getPool();
  if (!pool) return null;

  const store = getStore();
  store.tableReady ??= pool.query(`
    CREATE TABLE IF NOT EXISTS email_verification_codes (
      id text PRIMARY KEY,
      email text NOT NULL,
      code_hash text NOT NULL,
      purpose text NOT NULL CHECK (purpose IN ('signup', 'login', 'password_reset')),
      expires_at timestamptz NOT NULL,
      consumed_at timestamptz,
      attempts integer NOT NULL DEFAULT 0,
      created_at timestamptz NOT NULL DEFAULT now()
    );

    CREATE INDEX IF NOT EXISTS email_verification_codes_active_idx
      ON email_verification_codes (email, purpose, created_at DESC)
      WHERE consumed_at IS NULL;
  `).then(() => undefined);

  await store.tableReady;
  return pool;
}

export function normalizeVerificationEmail(email: string) {
  return email.trim().toLowerCase();
}

export function isValidVerificationEmail(email: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizeVerificationEmail(email));
}

export function generateVerificationCode() {
  return randomInt(0, 1_000_000).toString().padStart(6, "0");
}

function getAuthSecret() {
  const secret = process.env.AUTH_SECRET;
  if (!secret) throw new VerificationCodeConfigurationError("AUTH_SECRET must be configured before creating or verifying email codes.");
  return secret;
}

function hashVerificationCode(email: string, purpose: EmailVerificationPurpose, code: string) {
  return createHmac("sha256", getAuthSecret())
    .update(`${normalizeVerificationEmail(email)}:${purpose}:${code.trim()}`)
    .digest("hex");
}

function logVerificationQuery(event: string, details: Record<string, unknown>) {
  console.log(`[email_verification] ${event}`, details);
}

function safeHashEquals(left: string, right: string) {
  const leftBuffer = Buffer.from(left);
  const rightBuffer = Buffer.from(right);
  return leftBuffer.length === rightBuffer.length && timingSafeEqual(leftBuffer, rightBuffer);
}

function lookupKey(email: string, purpose: EmailVerificationPurpose) {
  return `${purpose}:${normalizeVerificationEmail(email)}`;
}

export function getLastVerificationCodeSentAt(email: string, purpose: EmailVerificationPurpose) {
  return getStore().sentAtByEmailAndPurpose.get(lookupKey(email, purpose)) || 0;
}

export function setLastVerificationCodeSentAt(email: string, purpose: EmailVerificationPurpose, sentAt: number) {
  getStore().sentAtByEmailAndPurpose.set(lookupKey(email, purpose), sentAt);
}

export async function createVerificationCode({
  email,
  code,
  purpose,
  now = Date.now()
}: {
  email: string;
  code: string;
  purpose: EmailVerificationPurpose;
  now?: number;
}) {
  const normalizedEmail = normalizeVerificationEmail(email);
  const codeHash = hashVerificationCode(email, purpose, code);
  const createdAt = new Date(now).toISOString();
  const expiresAt = new Date(now + VERIFICATION_CODE_TTL_MS).toISOString();
  const pool = await ensureVerificationTable();

  if (pool) {
    const result = await pool.query<VerificationCodeRow>(
      `INSERT INTO email_verification_codes (id, email, code_hash, purpose, expires_at, consumed_at, attempts, created_at)
       VALUES ($1, $2, $3, $4, $5, NULL, 0, $6)
       RETURNING id, email, code_hash, purpose, expires_at, consumed_at, attempts, created_at`,
      [randomUUID(), normalizedEmail, codeHash, purpose, expiresAt, createdAt]
    );
    return mapRow(result.rows[0]);
  }

  const record: EmailVerificationCode = {
    id: randomUUID(),
    email: normalizedEmail,
    codeHash,
    purpose,
    expiresAt,
    consumedAt: null,
    attempts: 0,
    createdAt
  };

  getStore().codes.push(record);
  return record;
}

export async function findActiveVerificationCode({ email, purpose, now = Date.now(), includeExpired = false }: VerificationCodeLookup) {
  const normalizedEmail = normalizeVerificationEmail(email);
  const pool = await ensureVerificationTable();

  if (pool) {
    const result = await pool.query<VerificationCodeRow>(
      `SELECT id, email, code_hash, purpose, expires_at, consumed_at, attempts, created_at
       FROM email_verification_codes
       WHERE email = $1
         AND purpose = $2
         AND consumed_at IS NULL
         AND ($3::boolean OR expires_at > $4::timestamptz)
       ORDER BY created_at DESC
       LIMIT 1`,
      [normalizedEmail, purpose, includeExpired, new Date(now).toISOString()]
    );
    return result.rows[0] ? mapRow(result.rows[0]) : null;
  }

  return (
    [...getStore().codes]
      .filter((record) => {
        if (record.email !== normalizedEmail || record.purpose !== purpose || record.consumedAt) return false;
        return includeExpired || new Date(record.expiresAt).getTime() > now;
      })
      .sort((left, right) => new Date(right.createdAt).getTime() - new Date(left.createdAt).getTime())[0] || null
  );
}

export async function consumeVerificationCode(id: string, now = Date.now()) {
  const pool = await ensureVerificationTable();
  const consumedAt = new Date(now).toISOString();

  if (pool) {
    const result = await pool.query<VerificationCodeRow>(
      `UPDATE email_verification_codes
       SET consumed_at = $2
       WHERE id = $1 AND consumed_at IS NULL
       RETURNING id, email, code_hash, purpose, expires_at, consumed_at, attempts, created_at`,
      [id, consumedAt]
    );
    return result.rows[0] ? mapRow(result.rows[0]) : null;
  }

  const record = getStore().codes.find((item) => item.id === id);
  if (!record || record.consumedAt) return null;
  record.consumedAt = consumedAt;
  return record;
}

async function recordVerificationAttempt(id: string) {
  const pool = await ensureVerificationTable();

  if (pool) {
    const result = await pool.query<VerificationCodeRow>(
      `UPDATE email_verification_codes
       SET attempts = attempts + 1
       WHERE id = $1
       RETURNING id, email, code_hash, purpose, expires_at, consumed_at, attempts, created_at`,
      [id]
    );
    return result.rows[0] ? mapRow(result.rows[0]) : null;
  }

  const record = getStore().codes.find((item) => item.id === id);
  if (!record) return null;
  record.attempts += 1;
  return record;
}

export async function invalidateVerificationCodesForEmail(email: string, purpose: EmailVerificationPurpose, now = Date.now()) {
  const normalizedEmail = normalizeVerificationEmail(email);
  const consumedAt = new Date(now).toISOString();
  const pool = await ensureVerificationTable();

  if (pool) {
    await pool.query(
      `UPDATE email_verification_codes
       SET consumed_at = $3
       WHERE email = $1 AND purpose = $2 AND consumed_at IS NULL`,
      [normalizedEmail, purpose, consumedAt]
    );
    return;
  }

  getStore().codes.forEach((record) => {
    if (record.email === normalizedEmail && record.purpose === purpose && !record.consumedAt) {
      record.consumedAt = consumedAt;
    }
  });
}

export async function verifyVerificationCode({
  email,
  code,
  purpose,
  consume = true,
  now = Date.now()
}: {
  email: string;
  code: string;
  purpose: EmailVerificationPurpose;
  consume?: boolean;
  now?: number;
}) {
  const normalizedEmail = normalizeVerificationEmail(email);
  const pool = await ensureVerificationTable();

  if (pool) {
    const expectedHash = hashVerificationCode(normalizedEmail, purpose, code);
    const nowIso = new Date(now).toISOString();
    const client = await pool.connect();

    try {
      await client.query("BEGIN");
      const matchingResult = await client.query<VerificationCodeRow>(
        `SELECT id, email, code_hash, purpose, expires_at, consumed_at, attempts, created_at
         FROM email_verification_codes
         WHERE email = $1
           AND purpose = $2
           AND consumed_at IS NULL
           AND code_hash = $3
         ORDER BY created_at DESC
         LIMIT 1
         FOR UPDATE`,
        [normalizedEmail, purpose, expectedHash]
      );

      const latestResult = await client.query<VerificationCodeRow>(
        `SELECT id, email, code_hash, purpose, expires_at, consumed_at, attempts, created_at
         FROM email_verification_codes
         WHERE email = $1
           AND purpose = $2
           AND consumed_at IS NULL
         ORDER BY created_at DESC
         LIMIT 1
         FOR UPDATE`,
        [normalizedEmail, purpose]
      );

      const summaryResult = await client.query<{
        unconsumed_count: string;
        unconsumed_unexpired_count: string;
        hash_match_count: string;
        latest_created_at: Date | string | null;
        latest_expires_at: Date | string | null;
      }>(
        `SELECT
           count(*) FILTER (WHERE consumed_at IS NULL)::text AS unconsumed_count,
           count(*) FILTER (WHERE consumed_at IS NULL AND expires_at > $4::timestamptz)::text AS unconsumed_unexpired_count,
           count(*) FILTER (WHERE consumed_at IS NULL AND code_hash = $3)::text AS hash_match_count,
           max(created_at) FILTER (WHERE consumed_at IS NULL) AS latest_created_at,
           max(expires_at) FILTER (WHERE consumed_at IS NULL) AS latest_expires_at
         FROM email_verification_codes
         WHERE email = $1
           AND purpose = $2`,
        [normalizedEmail, purpose, expectedHash, nowIso]
      );

      const summary = summaryResult.rows[0];
      logVerificationQuery("query_result", {
        email: normalizedEmail,
        purpose,
        matchedHash: (matchingResult.rowCount || 0) > 0,
        unconsumedCount: Number(summary?.unconsumed_count || 0),
        unconsumedUnexpiredCount: Number(summary?.unconsumed_unexpired_count || 0),
        hashMatchCount: Number(summary?.hash_match_count || 0),
        latestCreatedAt: toIso(summary?.latest_created_at),
        latestExpiresAt: toIso(summary?.latest_expires_at),
        now: nowIso
      });

      const record = matchingResult.rows[0] ? mapRow(matchingResult.rows[0]) : null;
      if (!record) {
        const latestRecord = latestResult.rows[0] ? mapRow(latestResult.rows[0]) : null;
        if (!latestRecord) {
          logVerificationQuery("not_found", { email: normalizedEmail, purpose });
          await client.query("COMMIT");
          return { status: "not_found" as const };
        }

        if (new Date(latestRecord.expiresAt).getTime() <= now) {
          logVerificationQuery("expired", {
            email: normalizedEmail,
            purpose,
            recordId: latestRecord.id,
            expiresAt: latestRecord.expiresAt,
            now: nowIso
          });
          await client.query("COMMIT");
          return { status: "expired" as const, record: latestRecord };
        }

        if (latestRecord.attempts >= MAX_VERIFICATION_ATTEMPTS) {
          logVerificationQuery("too_many_attempts", {
            email: normalizedEmail,
            purpose,
            recordId: latestRecord.id,
            attempts: latestRecord.attempts
          });
          await client.query("COMMIT");
          return { status: "too_many_attempts" as const, record: latestRecord };
        }

        const updatedResult = await client.query<VerificationCodeRow>(
          `UPDATE email_verification_codes
           SET attempts = attempts + 1
           WHERE id = $1
           RETURNING id, email, code_hash, purpose, expires_at, consumed_at, attempts, created_at`,
          [latestRecord.id]
        );
        const updatedRecord = updatedResult.rows[0] ? mapRow(updatedResult.rows[0]) : latestRecord;
        logVerificationQuery("hash_mismatch", {
          email: normalizedEmail,
          purpose,
          recordId: updatedRecord.id,
          attempts: updatedRecord.attempts,
          status: updatedRecord.attempts >= MAX_VERIFICATION_ATTEMPTS ? "too_many_attempts" : "invalid"
        });
        await client.query("COMMIT");
        return {
          status: updatedRecord.attempts >= MAX_VERIFICATION_ATTEMPTS ? ("too_many_attempts" as const) : ("invalid" as const),
          record: updatedRecord
        };
      }

      if (new Date(record.expiresAt).getTime() <= now) {
        logVerificationQuery("expired", {
          email: normalizedEmail,
          purpose,
          recordId: record.id,
          expiresAt: record.expiresAt,
          now: nowIso
        });
        await client.query("COMMIT");
        return { status: "expired" as const, record };
      }

      if (record.attempts >= MAX_VERIFICATION_ATTEMPTS) {
        logVerificationQuery("too_many_attempts", {
          email: normalizedEmail,
          purpose,
          recordId: record.id,
          attempts: record.attempts
        });
        await client.query("COMMIT");
        return { status: "too_many_attempts" as const, record };
      }

      if (!consume) {
        await client.query("COMMIT");

        logVerificationQuery("verified_unconsumed", {
          email: normalizedEmail,
          purpose,
          recordId: record.id,
          expiresAt: record.expiresAt
        });

        return { status: "verified" as const, record };
      }

      const consumedResult = await client.query<VerificationCodeRow>(
        `UPDATE email_verification_codes
         SET consumed_at = $2
         WHERE id = $1 AND consumed_at IS NULL
         RETURNING id, email, code_hash, purpose, expires_at, consumed_at, attempts, created_at`,
        [record.id, nowIso]
      );
      await client.query("COMMIT");

      logVerificationQuery("verified", {
        email: normalizedEmail,
        purpose,
        recordId: record.id,
        expiresAt: record.expiresAt
      });

      return consumedResult.rows[0]
        ? { status: "verified" as const, record: mapRow(consumedResult.rows[0]) }
        : { status: "not_found" as const };
    } catch (error) {
      await client.query("ROLLBACK").catch(() => undefined);
      throw error;
    } finally {
      client.release();
    }
  }

  const record = await findActiveVerificationCode({ email, purpose, now, includeExpired: true });

  logVerificationQuery("memory_query_result", {
    email: normalizedEmail,
    purpose,
    found: Boolean(record),
    expiresAt: record?.expiresAt,
    attempts: record?.attempts,
    now: new Date(now).toISOString()
  });

  if (!record) {
    return { status: "not_found" as const };
  }

  if (new Date(record.expiresAt).getTime() <= now) {
    return { status: "expired" as const, record };
  }

  if (record.attempts >= MAX_VERIFICATION_ATTEMPTS) {
    return { status: "too_many_attempts" as const, record };
  }

  const expectedHash = hashVerificationCode(email, purpose, code);
  if (!safeHashEquals(expectedHash, record.codeHash)) {
    const updatedRecord = await recordVerificationAttempt(record.id);
    const attempts = updatedRecord?.attempts ?? record.attempts + 1;
    return {
      status: attempts >= MAX_VERIFICATION_ATTEMPTS ? ("too_many_attempts" as const) : ("invalid" as const),
      record: updatedRecord || record
    };
  }

  if (consume) {
    await consumeVerificationCode(record.id, now);
  }

  return { status: "verified" as const, record };
}
