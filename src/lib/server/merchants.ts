import "server-only";

import { createHmac, randomBytes, scrypt, timingSafeEqual } from "node:crypto";
import { promisify } from "node:util";
import { Pool, type PoolClient } from "pg";

type MerchantStatus = "active" | "suspended" | "deleted";
type RestaurantStatus = "open" | "closed" | "pending" | "suspended" | "deleted";

export type MerchantErrorCode =
  | "database_connection_failed"
  | "invalid_payload"
  | "merchant_duplicate_email"
  | "restaurant_insert_failed"
  | "merchant_insert_failed"
  | "password_hash_failed"
  | "merchant_not_found"
  | "merchant_password_mismatch"
  | "merchant_missing_password_hash"
  | "merchant_suspended"
  | "merchant_deleted"
  | "merchant_restaurant_missing"
  | "restaurant_not_found"
  | "restaurant_suspended"
  | "restaurant_deleted"
  | "password_update_failed";

export class MerchantDbError extends Error {
  code: MerchantErrorCode;
  status: number;

  constructor(code: MerchantErrorCode, status = 500, message = code) {
    super(message);
    this.name = "MerchantDbError";
    this.code = code;
    this.status = status;
  }
}

export type MerchantAccount = {
  id: string;
  name: string | null;
  email: string;
  password_hash: string;
  status: MerchantStatus | string;
  restaurant_id: string | null;
  created_at: Date;
  updated_at: Date;
  suspended_at: Date | null;
  deleted_at: Date | null;
};

export type RestaurantRecord = {
  id: string;
  owner_merchant_id: string | null;
  name: string;
  bio: string | null;
  address: string | null;
  city: string | null;
  country: string | null;
  latitude: number | null;
  longitude: number | null;
  phone: string | null;
  opening_hours: string | null;
  status: RestaurantStatus | string;
  student_menu_enabled: boolean;
  cadesca_partner: boolean;
  created_at: Date;
  updated_at: Date;
  suspended_at: Date | null;
  deleted_at: Date | null;
};

export type MerchantWithRestaurant = {
  merchant: MerchantAccount;
  restaurant: RestaurantRecord;
};

export type MerchantMutationInput = {
  id?: string;
  email?: string;
  password?: string;
  restaurantId?: string | null;
  status?: string;
  restaurantName?: string;
  merchantOwnerName?: string;
  bio?: string;
  address?: string;
  city?: string;
  country?: string;
  lat?: number | null;
  lng?: number | null;
  phone?: string;
  openingHours?: string;
  studentMenuEligible?: boolean;
  restaurantStatus?: string;
};

const scryptAsync = promisify(scrypt) as (
  password: string,
  salt: string,
  keylen: number,
  options: { N: number; r: number; p: number; maxmem: number }
) => Promise<Buffer>;

const SCRYPT_OPTIONS = { N: 16384, r: 8, p: 1, maxmem: 64 * 1024 * 1024 };
const SCRYPT_KEY_LENGTH = 64;

let poolInstance: Pool | null = null;
let schemaReady = false;

function readPositiveIntEnv(name: string, fallback: number) {
  const value = Number.parseInt(process.env[name] || "", 10);
  return Number.isFinite(value) && value > 0 ? value : fallback;
}

function getPgErrorCode(error: unknown) {
  return typeof error === "object" && error !== null && "code" in error
    ? String((error as { code?: unknown }).code || "")
    : "";
}

function logMerchantEvent(code: string, details: Record<string, unknown> = {}) {
  console.error(`[merchant_auth] ${code}`, details);
}

function normalizeEmail(email: unknown) {
  return typeof email === "string" ? email.trim().toLowerCase() : "";
}

function isValidEmail(email: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

function requiredText(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function optionalText(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function finiteNumber(value: unknown) {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function newId(prefix: string) {
  return `${prefix}_${randomBytes(8).toString("hex")}`;
}

function normalizeMerchantStatus(value: unknown): MerchantStatus {
  return value === "suspended" || value === "deleted" || value === "active" ? value : "active";
}

function normalizeRestaurantStatus(value: unknown): RestaurantStatus {
  return value === "closed" || value === "pending" || value === "suspended" || value === "deleted" || value === "open" ? value : "open";
}

function statusTimestamps(status: string) {
  return {
    suspendedAt: status === "suspended" ? new Date() : null,
    deletedAt: status === "deleted" ? new Date() : null
  };
}

export function getPool() {
  if (poolInstance) return poolInstance;

  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    logMerchantEvent("database_connection_failed", { reason: "DATABASE_URL missing" });
    throw new MerchantDbError("database_connection_failed", 503);
  }

  poolInstance = new Pool({
    connectionString,
    ssl: connectionString.includes("sslmode=require") ? { rejectUnauthorized: false } : undefined,
    max: readPositiveIntEnv("DATABASE_POOL_MAX", 5),
    idleTimeoutMillis: readPositiveIntEnv("DATABASE_IDLE_TIMEOUT_MS", 10_000),
    connectionTimeoutMillis: readPositiveIntEnv("DATABASE_CONNECTION_TIMEOUT_MS", 5_000)
  });

  return poolInstance;
}

async function ensureMerchantSchema(clientOrPool: Pool | PoolClient) {
  if (schemaReady) return;

  await clientOrPool.query(`
    CREATE TABLE IF NOT EXISTS restaurants (
      id text PRIMARY KEY,
      owner_merchant_id text,
      name text NOT NULL,
      bio text,
      address text,
      city text,
      country text,
      latitude double precision,
      longitude double precision,
      phone text,
      opening_hours text,
      status text NOT NULL DEFAULT 'open',
      student_menu_enabled boolean NOT NULL DEFAULT false,
      cadesca_partner boolean NOT NULL DEFAULT true,
      created_at timestamptz NOT NULL DEFAULT now(),
      updated_at timestamptz NOT NULL DEFAULT now(),
      suspended_at timestamptz,
      deleted_at timestamptz
    );
  `);

  await clientOrPool.query(`
    CREATE TABLE IF NOT EXISTS merchant_accounts (
      id text PRIMARY KEY,
      name text,
      email text NOT NULL,
      password_hash text NOT NULL,
      status text NOT NULL DEFAULT 'active',
      restaurant_id text,
      created_at timestamptz NOT NULL DEFAULT now(),
      updated_at timestamptz NOT NULL DEFAULT now(),
      suspended_at timestamptz,
      deleted_at timestamptz
    );
  `);

  await clientOrPool.query(`
    ALTER TABLE merchant_accounts ADD COLUMN IF NOT EXISTS name text;
    ALTER TABLE merchant_accounts ADD COLUMN IF NOT EXISTS restaurant_id text;
    ALTER TABLE merchant_accounts ADD COLUMN IF NOT EXISTS status text;
    ALTER TABLE merchant_accounts ADD COLUMN IF NOT EXISTS created_at timestamptz;
    ALTER TABLE merchant_accounts ADD COLUMN IF NOT EXISTS updated_at timestamptz;
    ALTER TABLE merchant_accounts ADD COLUMN IF NOT EXISTS suspended_at timestamptz;
    ALTER TABLE merchant_accounts ADD COLUMN IF NOT EXISTS deleted_at timestamptz;

    ALTER TABLE restaurants ADD COLUMN IF NOT EXISTS owner_merchant_id text;
    ALTER TABLE restaurants ADD COLUMN IF NOT EXISTS bio text;
    ALTER TABLE restaurants ADD COLUMN IF NOT EXISTS address text;
    ALTER TABLE restaurants ADD COLUMN IF NOT EXISTS city text;
    ALTER TABLE restaurants ADD COLUMN IF NOT EXISTS country text;
    ALTER TABLE restaurants ADD COLUMN IF NOT EXISTS latitude double precision;
    ALTER TABLE restaurants ADD COLUMN IF NOT EXISTS longitude double precision;
    ALTER TABLE restaurants ADD COLUMN IF NOT EXISTS phone text;
    ALTER TABLE restaurants ADD COLUMN IF NOT EXISTS opening_hours text;
    ALTER TABLE restaurants ADD COLUMN IF NOT EXISTS status text;
    ALTER TABLE restaurants ADD COLUMN IF NOT EXISTS student_menu_enabled boolean;
    ALTER TABLE restaurants ADD COLUMN IF NOT EXISTS cadesca_partner boolean;
    ALTER TABLE restaurants ADD COLUMN IF NOT EXISTS created_at timestamptz;
    ALTER TABLE restaurants ADD COLUMN IF NOT EXISTS updated_at timestamptz;
    ALTER TABLE restaurants ADD COLUMN IF NOT EXISTS suspended_at timestamptz;
    ALTER TABLE restaurants ADD COLUMN IF NOT EXISTS deleted_at timestamptz;
  `);

  await clientOrPool.query(`
    ALTER TABLE merchant_accounts DROP CONSTRAINT IF EXISTS merchant_accounts_email_key;

    DELETE FROM merchant_accounts
    WHERE email IS NULL OR btrim(email) = '';

    UPDATE merchant_accounts
    SET email = lower(btrim(email)),
        password_hash = coalesce(password_hash, ''),
        status = coalesce(nullif(status, ''), 'active'),
        created_at = coalesce(created_at, now()),
        updated_at = coalesce(updated_at, created_at, now());

    UPDATE restaurants
    SET name = coalesce(nullif(name, ''), 'Unnamed restaurant'),
        status = coalesce(nullif(status, ''), 'open'),
        student_menu_enabled = coalesce(student_menu_enabled, false),
        cadesca_partner = coalesce(cadesca_partner, true),
        created_at = coalesce(created_at, now()),
        updated_at = coalesce(updated_at, created_at, now());
  `);

  await clientOrPool.query(`
    WITH ranked AS (
      SELECT
        id,
        row_number() OVER (
          PARTITION BY lower(email)
          ORDER BY
            CASE
              WHEN deleted_at IS NULL AND status = 'active' THEN 0
              WHEN deleted_at IS NULL THEN 1
              ELSE 2
            END,
            created_at DESC NULLS LAST,
            updated_at DESC NULLS LAST,
            id DESC
        ) AS duplicate_rank
      FROM merchant_accounts
      WHERE email IS NOT NULL AND btrim(email) <> ''
    )
    UPDATE merchant_accounts AS merchant
    SET status = 'deleted',
        deleted_at = coalesce(merchant.deleted_at, now()),
        updated_at = now()
    FROM ranked
    WHERE merchant.id = ranked.id
      AND ranked.duplicate_rank > 1
      AND merchant.deleted_at IS NULL;
  `);

  await clientOrPool.query(`
    ALTER TABLE merchant_accounts ALTER COLUMN email SET NOT NULL;
    ALTER TABLE merchant_accounts ALTER COLUMN password_hash SET NOT NULL;
    ALTER TABLE merchant_accounts ALTER COLUMN status SET DEFAULT 'active';
    ALTER TABLE merchant_accounts ALTER COLUMN status SET NOT NULL;
    ALTER TABLE merchant_accounts ALTER COLUMN created_at SET DEFAULT now();
    ALTER TABLE merchant_accounts ALTER COLUMN created_at SET NOT NULL;
    ALTER TABLE merchant_accounts ALTER COLUMN updated_at SET DEFAULT now();
    ALTER TABLE merchant_accounts ALTER COLUMN updated_at SET NOT NULL;

    ALTER TABLE restaurants ALTER COLUMN name SET NOT NULL;
    ALTER TABLE restaurants ALTER COLUMN status SET DEFAULT 'open';
    ALTER TABLE restaurants ALTER COLUMN status SET NOT NULL;
    ALTER TABLE restaurants ALTER COLUMN student_menu_enabled SET DEFAULT false;
    ALTER TABLE restaurants ALTER COLUMN student_menu_enabled SET NOT NULL;
    ALTER TABLE restaurants ALTER COLUMN cadesca_partner SET DEFAULT true;
    ALTER TABLE restaurants ALTER COLUMN cadesca_partner SET NOT NULL;
    ALTER TABLE restaurants ALTER COLUMN created_at SET DEFAULT now();
    ALTER TABLE restaurants ALTER COLUMN created_at SET NOT NULL;
    ALTER TABLE restaurants ALTER COLUMN updated_at SET DEFAULT now();
    ALTER TABLE restaurants ALTER COLUMN updated_at SET NOT NULL;

    CREATE UNIQUE INDEX IF NOT EXISTS merchant_accounts_email_lower_active_idx
      ON merchant_accounts (lower(email))
      WHERE deleted_at IS NULL;
    CREATE INDEX IF NOT EXISTS restaurants_owner_merchant_id_idx ON restaurants (owner_merchant_id);
    CREATE INDEX IF NOT EXISTS merchant_accounts_restaurant_id_idx ON merchant_accounts (restaurant_id);
    CREATE INDEX IF NOT EXISTS restaurants_status_idx ON restaurants (status);
  `);

  schemaReady = true;
}

export async function getReadyPool() {
  const pool = getPool();
  await ensureMerchantSchema(pool);
  return pool;
}

async function withTransaction<T>(callback: (client: PoolClient) => Promise<T>) {
  const pool = getPool();
  await ensureMerchantSchema(pool);
  const client = await pool.connect();

  try {
    await client.query("BEGIN");
    const result = await callback(client);
    await client.query("COMMIT");
    return result;
  } catch (error) {
    await client.query("ROLLBACK").catch(() => undefined);
    throw error;
  } finally {
    client.release();
  }
}

export async function hashMerchantPassword(password: string) {
  if (!password) throw new MerchantDbError("invalid_payload", 400);

  try {
    const salt = randomBytes(16).toString("base64url");
    const derived = await scryptAsync(password, salt, SCRYPT_KEY_LENGTH, SCRYPT_OPTIONS);
    return `scrypt$${salt}$${derived.toString("base64url")}`;
  } catch (error) {
    logMerchantEvent("password_hash_failed", { reason: error instanceof Error ? error.name : "unknown" });
    throw new MerchantDbError("password_hash_failed", 500);
  }
}

function legacyHmacMerchantPassword(password: string) {
  const secret = process.env.AUTH_SECRET;
  if (!secret) return "";
  return createHmac("sha256", secret).update(password).digest("hex");
}

export async function verifyMerchantPassword(password: string, storedHash: string | null | undefined) {
  if (!storedHash) return false;

  if (storedHash.startsWith("scrypt$")) {
    const [, salt, hash] = storedHash.split("$");
    if (!salt || !hash) return false;

    const actual = Buffer.from(hash, "base64url");
    const derived = await scryptAsync(password, salt, actual.length, SCRYPT_OPTIONS);
    return actual.length === derived.length && timingSafeEqual(actual, derived);
  }

  if (/^[a-f0-9]{64}$/i.test(storedHash)) {
    const legacyHash = legacyHmacMerchantPassword(password);
    if (!legacyHash) return false;
    const actual = Buffer.from(storedHash, "hex");
    const expected = Buffer.from(legacyHash, "hex");
    return actual.length === expected.length && timingSafeEqual(actual, expected);
  }

  return false;
}

async function findActiveDuplicate(client: PoolClient, email: string, allowedId?: string) {
  const result = await client.query<Pick<MerchantAccount, "id">>(
    `SELECT id
     FROM merchant_accounts
     WHERE lower(email) = lower($1)
       AND deleted_at IS NULL
       AND ($2::text IS NULL OR id <> $2)
     LIMIT 1`,
    [email, allowedId || null]
  );

  return result.rows[0] || null;
}

async function selectMerchantWithRestaurant(client: PoolClient, merchantId: string): Promise<MerchantWithRestaurant> {
  const result = await client.query<MerchantAccount & { restaurant_json: RestaurantRecord | null }>(
    `SELECT
       merchant_accounts.*,
       to_jsonb(restaurants.*) AS restaurant_json
     FROM merchant_accounts
     LEFT JOIN restaurants ON restaurants.id = merchant_accounts.restaurant_id
     WHERE merchant_accounts.id = $1
     LIMIT 1`,
    [merchantId]
  );
  const row = result.rows[0];

  if (!row) throw new MerchantDbError("merchant_not_found", 404);
  if (!row.restaurant_json) throw new MerchantDbError("restaurant_not_found", 404);

  const { restaurant_json: restaurant, ...merchant } = row;
  return { merchant, restaurant };
}

export async function createMerchantWithRestaurantInDb(input: MerchantMutationInput): Promise<MerchantWithRestaurant> {
  const email = normalizeEmail(input.email);
  const password = typeof input.password === "string" ? input.password : "";
  const merchantName = requiredText(input.merchantOwnerName || input.email);
  const restaurantName = requiredText(input.restaurantName);
  const city = requiredText(input.city);

  if (!isValidEmail(email) || !password || !merchantName || !restaurantName || !city) {
    throw new MerchantDbError("invalid_payload", 400);
  }

  const passwordHash = await hashMerchantPassword(password);
  const merchantId = requiredText(input.id) || newId("merchant");
  const restaurantId = requiredText(input.restaurantId) || newId("rest");
  const merchantStatus = normalizeMerchantStatus(input.status);
  const restaurantStatus = normalizeRestaurantStatus(input.restaurantStatus);
  const merchantTimes = statusTimestamps(merchantStatus);
  const restaurantTimes = statusTimestamps(restaurantStatus);

  return withTransaction(async (client) => {
    const duplicate = await findActiveDuplicate(client, email);
    if (duplicate) throw new MerchantDbError("merchant_duplicate_email", 409);

    try {
      await client.query(
        `INSERT INTO restaurants (
           id, owner_merchant_id, name, bio, address, city, country, latitude, longitude,
           phone, opening_hours, status, student_menu_enabled, cadesca_partner,
           suspended_at, deleted_at
         )
         VALUES ($1, NULL, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, true, $13, $14)`,
        [
          restaurantId,
          restaurantName,
          optionalText(input.bio),
          optionalText(input.address),
          city,
          optionalText(input.country) || "Azerbaijan",
          finiteNumber(input.lat),
          finiteNumber(input.lng),
          optionalText(input.phone),
          optionalText(input.openingHours),
          restaurantStatus,
          Boolean(input.studentMenuEligible),
          restaurantTimes.suspendedAt,
          restaurantTimes.deletedAt
        ]
    );
  } catch (error) {
      logMerchantEvent("restaurant_insert_failed", { restaurantId, pgCode: getPgErrorCode(error) });
      throw new MerchantDbError("restaurant_insert_failed", 500);
    }

    try {
      await client.query(
        `INSERT INTO merchant_accounts (
           id, name, email, password_hash, status, restaurant_id, suspended_at, deleted_at
         )
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
        [merchantId, merchantName, email, passwordHash, merchantStatus, restaurantId, merchantTimes.suspendedAt, merchantTimes.deletedAt]
      );
    } catch (error) {
      const pgCode = getPgErrorCode(error);
      logMerchantEvent(pgCode === "23505" ? "merchant_duplicate_email" : "merchant_insert_failed", { email, pgCode });
      throw new MerchantDbError(pgCode === "23505" ? "merchant_duplicate_email" : "merchant_insert_failed", pgCode === "23505" ? 409 : 500);
    }

    await client.query(
      `UPDATE restaurants
       SET owner_merchant_id = $2,
           updated_at = now()
       WHERE id = $1`,
      [restaurantId, merchantId]
    );

    return selectMerchantWithRestaurant(client, merchantId);
  });
}

export async function updateMerchantWithRestaurantInDb(input: MerchantMutationInput): Promise<MerchantWithRestaurant> {
  const merchantId = requiredText(input.id);
  if (!merchantId) throw new MerchantDbError("invalid_payload", 400);

  return withTransaction(async (client) => {
    const existingResult = await client.query<MerchantAccount>("SELECT * FROM merchant_accounts WHERE id = $1 LIMIT 1", [merchantId]);
    const existing = existingResult.rows[0];
    if (!existing) throw new MerchantDbError("merchant_not_found", 404);

    const email = input.email ? normalizeEmail(input.email) : existing.email;
    if (!isValidEmail(email)) throw new MerchantDbError("invalid_payload", 400);

    const duplicate = await findActiveDuplicate(client, email, merchantId);
    if (duplicate) throw new MerchantDbError("merchant_duplicate_email", 409);

    const restaurantId = requiredText(input.restaurantId) || existing.restaurant_id;
    if (!restaurantId) throw new MerchantDbError("merchant_restaurant_missing", 400);

    const merchantStatus = normalizeMerchantStatus(input.status || existing.status);
    const merchantTimes = statusTimestamps(merchantStatus);
    const passwordHash = input.password ? await hashMerchantPassword(input.password) : null;

    try {
      await client.query(
        `UPDATE merchant_accounts
         SET name = coalesce(nullif($2, ''), name),
             email = $3,
             password_hash = coalesce($4, password_hash),
             restaurant_id = $5,
             status = $6,
             suspended_at = $7,
             deleted_at = $8,
             updated_at = now()
         WHERE id = $1`,
        [
          merchantId,
          optionalText(input.merchantOwnerName),
          email,
          passwordHash,
          restaurantId,
          merchantStatus,
          merchantTimes.suspendedAt,
          merchantTimes.deletedAt
        ]
      );
    } catch (error) {
      const pgCode = getPgErrorCode(error);
      logMerchantEvent(pgCode === "23505" ? "merchant_duplicate_email" : "merchant_insert_failed", { email, pgCode });
      throw new MerchantDbError(pgCode === "23505" ? "merchant_duplicate_email" : "merchant_insert_failed", pgCode === "23505" ? 409 : 500);
    }

    const restaurantExists = await client.query<Pick<RestaurantRecord, "id">>("SELECT id FROM restaurants WHERE id = $1 LIMIT 1", [restaurantId]);
    if (!restaurantExists.rows[0]) {
      if (!input.restaurantName || !input.city) throw new MerchantDbError("restaurant_not_found", 404);

      try {
        await client.query(
          `INSERT INTO restaurants (
             id, owner_merchant_id, name, bio, address, city, country, latitude, longitude,
             phone, opening_hours, status, student_menu_enabled, cadesca_partner
           )
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, true)`,
          [
            restaurantId,
            merchantId,
            requiredText(input.restaurantName),
            optionalText(input.bio),
            optionalText(input.address),
            requiredText(input.city),
            optionalText(input.country) || "Azerbaijan",
            finiteNumber(input.lat),
            finiteNumber(input.lng),
            optionalText(input.phone),
            optionalText(input.openingHours),
            normalizeRestaurantStatus(input.restaurantStatus),
            Boolean(input.studentMenuEligible)
          ]
        );
      } catch (error) {
        logMerchantEvent("restaurant_insert_failed", { restaurantId, pgCode: getPgErrorCode(error) });
        throw new MerchantDbError("restaurant_insert_failed", 500);
      }
    } else if (
      input.restaurantName !== undefined ||
      input.city !== undefined ||
      input.restaurantStatus !== undefined ||
      input.studentMenuEligible !== undefined
    ) {
      const restaurantStatus = normalizeRestaurantStatus(input.restaurantStatus);
      const restaurantTimes = statusTimestamps(restaurantStatus);
      await client.query(
        `UPDATE restaurants
         SET owner_merchant_id = $2,
             name = coalesce(nullif($3, ''), name),
             bio = $4,
             address = $5,
             city = coalesce(nullif($6, ''), city),
             country = coalesce(nullif($7, ''), country),
             latitude = $8,
             longitude = $9,
             phone = $10,
             opening_hours = $11,
             status = $12,
             student_menu_enabled = $13,
             suspended_at = $14,
             deleted_at = $15,
             updated_at = now()
         WHERE id = $1`,
        [
          restaurantId,
          merchantId,
          optionalText(input.restaurantName),
          optionalText(input.bio),
          optionalText(input.address),
          optionalText(input.city),
          optionalText(input.country),
          finiteNumber(input.lat),
          finiteNumber(input.lng),
          optionalText(input.phone),
          optionalText(input.openingHours),
          restaurantStatus,
          Boolean(input.studentMenuEligible),
          restaurantTimes.suspendedAt,
          restaurantTimes.deletedAt
        ]
      );
    }

    return selectMerchantWithRestaurant(client, merchantId);
  });
}

export async function resetMerchantPasswordInDb(input: { id?: string; email?: string; password?: string }) {
  const id = requiredText(input.id);
  const email = normalizeEmail(input.email);
  const password = typeof input.password === "string" ? input.password : "";

  if ((!id && !isValidEmail(email)) || !password) throw new MerchantDbError("invalid_payload", 400);

  const passwordHash = await hashMerchantPassword(password);
  const pool = await getReadyPool();

  const result = await pool.query<Pick<MerchantAccount, "id">>(
    `UPDATE merchant_accounts
     SET password_hash = $1,
         updated_at = now()
     WHERE (${id ? "id = $2" : "lower(email) = lower($2)"})
       AND deleted_at IS NULL
     RETURNING id`,
    [passwordHash, id || email]
  );

  if (!result.rows[0]) {
    logMerchantEvent("merchant_not_found", id ? { merchantId: id } : { email });
    throw new MerchantDbError("merchant_not_found", 404);
  }

  logMerchantEvent("password_reset_success", { merchantId: result.rows[0].id });
  return result.rows[0];
}

export async function authenticateMerchantInDb(emailInput: string, password: string): Promise<MerchantWithRestaurant> {
  const email = normalizeEmail(emailInput);
  if (!isValidEmail(email) || !password) throw new MerchantDbError("invalid_payload", 400);

  const pool = await getReadyPool();
  const merchantResult = await pool.query<MerchantAccount>(
    `SELECT *
     FROM merchant_accounts
     WHERE lower(email) = lower($1)
     ORDER BY deleted_at ASC NULLS FIRST, created_at DESC NULLS LAST
     LIMIT 1`,
    [email]
  );
  const merchant = merchantResult.rows[0];

  if (!merchant) {
    logMerchantEvent("merchant_not_found", { email });
    throw new MerchantDbError("merchant_not_found", 401);
  }

  if (merchant.deleted_at || merchant.status === "deleted") {
    logMerchantEvent("merchant_deleted", { merchantId: merchant.id });
    throw new MerchantDbError("merchant_deleted", 401);
  }

  if (merchant.suspended_at || merchant.status === "suspended" || merchant.status !== "active") {
    logMerchantEvent("merchant_suspended", { merchantId: merchant.id, status: merchant.status });
    throw new MerchantDbError("merchant_suspended", 401);
  }

  if (!merchant.password_hash) {
    logMerchantEvent("merchant_missing_password_hash", { merchantId: merchant.id });
    throw new MerchantDbError("merchant_missing_password_hash", 401);
  }

  const passwordMatches = await verifyMerchantPassword(password, merchant.password_hash);
  if (!passwordMatches) {
    logMerchantEvent("merchant_password_mismatch", { merchantId: merchant.id });
    throw new MerchantDbError("merchant_password_mismatch", 401);
  }

  if (!merchant.restaurant_id) {
    logMerchantEvent("merchant_restaurant_missing", { merchantId: merchant.id });
    throw new MerchantDbError("merchant_restaurant_missing", 401);
  }

  const restaurantResult = await pool.query<RestaurantRecord>("SELECT * FROM restaurants WHERE id = $1 LIMIT 1", [merchant.restaurant_id]);
  const restaurant = restaurantResult.rows[0];

  if (!restaurant) {
    logMerchantEvent("restaurant_not_found", { merchantId: merchant.id, restaurantId: merchant.restaurant_id });
    throw new MerchantDbError("restaurant_not_found", 401);
  }

  if (restaurant.deleted_at || restaurant.status === "deleted") {
    logMerchantEvent("restaurant_deleted", { merchantId: merchant.id, restaurantId: restaurant.id });
    throw new MerchantDbError("restaurant_deleted", 401);
  }

  if (restaurant.suspended_at || restaurant.status === "suspended") {
    logMerchantEvent("restaurant_suspended", { merchantId: merchant.id, restaurantId: restaurant.id });
    throw new MerchantDbError("restaurant_suspended", 401);
  }

  logMerchantEvent("login_success", { merchantId: merchant.id, restaurantId: restaurant.id });
  return { merchant, restaurant };
}
