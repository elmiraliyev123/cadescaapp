import "server-only";

import { randomBytes } from "node:crypto";
import { Pool, type PoolClient } from "pg";
import { hashMerchantPassword, verifyMerchantPassword, MerchantDbError } from "./merchants";
import { isSupportedLocale, type SupportedLocale } from "../localization";
import { isValidCadescaUsername, validateCadescaUsername } from "../usernames";

export type User = {
  id: string;
  auth_user_id: string | null;
  name: string;
  email: string;
  password_hash: string;
  role: string;
  status: string;
  university_id: string | null;
  university_name: string | null;
  university_domain: string | null;
  student_status: string;
  student_menu_access: boolean;
  email_verified: boolean;
  locale: string | null;
  username: string | null;
  display_name: string | null;
  bio: string | null;
  avatar_url: string | null;
  public_profile_enabled: boolean;
  verified_via: string;
  verified_at: Date | null;
  student_id_image_path: string | null;
  student_number: string | null;
  student_id_expires_at: Date | null;
  student_id_issued_at: Date | null;
  student_faculty_department: string | null;
  created_at: Date;
  updated_at: Date;
};

export type CreateUserInput = {
  name: string;
  email: string;
  password: string;
  displayName?: string;
  username?: string;
  universityId?: string;
  universityName?: string;
  universityDomain?: string;
  studentStatus?: "verified" | "pending" | "not_verified" | "rejected";
  studentMenuAccess?: boolean;
  emailVerified?: boolean;
  verifiedVia?: "email" | "ocr";
  verifiedAt?: string;
  acceptedTermsAt?: string;
  authUserId?: string;
  studentIdImagePath?: string | null;
  studentNumber?: string | null;
  studentIdExpiresAt?: string | null;
  studentIdIssuedAt?: string | null;
  studentFacultyDepartment?: string | null;
};

import { getReadyPool as getMerchantReadyPool } from "./merchants";

async function ensureUserSchema(clientOrPool: Pool | PoolClient) {

  await clientOrPool.query(`
    CREATE TABLE IF NOT EXISTS users (
      id text PRIMARY KEY,
      auth_user_id uuid UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
      name text NOT NULL,
      email text UNIQUE NOT NULL,
      password_hash text NOT NULL,
      role text NOT NULL DEFAULT 'user',
      status text NOT NULL DEFAULT 'active',
      university_name text,
      university_domain text,
      student_status text NOT NULL DEFAULT 'not_verified',
      student_menu_access boolean NOT NULL DEFAULT false,
      email_verified boolean NOT NULL DEFAULT false,
      locale text,
      public_profile_enabled boolean NOT NULL DEFAULT true,
      verified_via text NOT NULL DEFAULT 'email',
      student_id_image_path text,
      student_number text,
      student_id_expires_at date,
      student_id_issued_at date,
      student_faculty_department text,
      accepted_terms_at timestamptz,
      created_at timestamptz NOT NULL DEFAULT now(),
      updated_at timestamptz NOT NULL DEFAULT now(),
      suspended_at timestamptz,
      deleted_at timestamptz
    );

    CREATE TABLE IF NOT EXISTS restaurant_menu_items (
      id text PRIMARY KEY,
      restaurant_id text NOT NULL REFERENCES restaurants(id) ON DELETE CASCADE,
      name text NOT NULL,
      description text,
      price numeric(10, 2) NOT NULL DEFAULT 0,
      currency text NOT NULL DEFAULT 'AZN',
      category text NOT NULL DEFAULT 'Menu',
      student_menu_eligible boolean NOT NULL DEFAULT false,
      status text NOT NULL DEFAULT 'active',
      created_at timestamptz NOT NULL DEFAULT now(),
      updated_at timestamptz NOT NULL DEFAULT now(),
      deleted_at timestamptz
    );

    CREATE TABLE IF NOT EXISTS qr_tokens (
      id text PRIMARY KEY,
      token text UNIQUE NOT NULL,
      user_id text NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      status text NOT NULL DEFAULT 'active',
      expires_at timestamptz NOT NULL,
      created_at timestamptz NOT NULL DEFAULT now(),
      used_at timestamptz
    );

    CREATE TABLE IF NOT EXISTS student_check_ins (
      id text PRIMARY KEY,
      user_id text NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      restaurant_id text NOT NULL REFERENCES restaurants(id) ON DELETE CASCADE,
      merchant_user_id text NOT NULL REFERENCES merchant_accounts(id),
      menu_item_id text REFERENCES restaurant_menu_items(id),
      qr_token_id text REFERENCES qr_tokens(id),
      status text NOT NULL DEFAULT 'confirmed',
      created_at timestamptz NOT NULL DEFAULT now(),
      cancelled_at timestamptz
    );

    CREATE INDEX IF NOT EXISTS qr_tokens_user_status_idx
      ON qr_tokens (user_id, status, expires_at DESC);

    CREATE INDEX IF NOT EXISTS student_check_ins_user_created_idx
      ON student_check_ins (user_id, created_at DESC)
      WHERE status = 'confirmed';

    ALTER TABLE public.users ADD COLUMN IF NOT EXISTS auth_user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE;
    ALTER TABLE public.users ADD COLUMN IF NOT EXISTS role text NOT NULL DEFAULT 'user';
    ALTER TABLE public.users ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'active';
    ALTER TABLE public.users ADD COLUMN IF NOT EXISTS university_id uuid;
    ALTER TABLE public.users ADD COLUMN IF NOT EXISTS university_name text;
    ALTER TABLE public.users ADD COLUMN IF NOT EXISTS university_domain text;
    ALTER TABLE public.users ADD COLUMN IF NOT EXISTS student_status text NOT NULL DEFAULT 'not_verified';
    ALTER TABLE public.users ADD COLUMN IF NOT EXISTS student_menu_access boolean NOT NULL DEFAULT false;
    ALTER TABLE public.users ADD COLUMN IF NOT EXISTS email_verified boolean NOT NULL DEFAULT false;
    ALTER TABLE public.users ADD COLUMN IF NOT EXISTS locale text;
    ALTER TABLE public.users ADD COLUMN IF NOT EXISTS username text;
    ALTER TABLE public.users ADD COLUMN IF NOT EXISTS display_name text;
    ALTER TABLE public.users ADD COLUMN IF NOT EXISTS bio text;
    ALTER TABLE public.users ADD COLUMN IF NOT EXISTS avatar_url text;
    ALTER TABLE public.users ADD COLUMN IF NOT EXISTS public_profile_enabled boolean NOT NULL DEFAULT true;
    ALTER TABLE public.users ADD COLUMN IF NOT EXISTS verified_via text NOT NULL DEFAULT 'email';
    ALTER TABLE public.users ADD COLUMN IF NOT EXISTS verified_at timestamptz;
    ALTER TABLE public.users ADD COLUMN IF NOT EXISTS student_id_image_path text;
    ALTER TABLE public.users ADD COLUMN IF NOT EXISTS student_number text;
    ALTER TABLE public.users ADD COLUMN IF NOT EXISTS student_id_expires_at date;
    ALTER TABLE public.users ADD COLUMN IF NOT EXISTS student_id_issued_at date;
    ALTER TABLE public.users ADD COLUMN IF NOT EXISTS student_faculty_department text;
    ALTER TABLE public.users ADD COLUMN IF NOT EXISTS accepted_terms_at timestamptz;
    ALTER TABLE public.users ADD COLUMN IF NOT EXISTS created_at timestamptz NOT NULL DEFAULT now();
    ALTER TABLE public.users ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now();
    ALTER TABLE public.users ADD COLUMN IF NOT EXISTS suspended_at timestamptz;
    ALTER TABLE public.users ADD COLUMN IF NOT EXISTS deleted_at timestamptz;

    UPDATE public.users
    SET role = COALESCE(NULLIF(role, ''), 'user'),
        status = COALESCE(NULLIF(status, ''), 'active'),
        student_status = COALESCE(NULLIF(student_status, ''), 'not_verified'),
        student_menu_access = COALESCE(student_menu_access, false),
        email_verified = COALESCE(email_verified, false),
        public_profile_enabled = COALESCE(public_profile_enabled, true),
        verified_via = COALESCE(NULLIF(verified_via, ''), 'email');

    ALTER TABLE public.users ALTER COLUMN role SET DEFAULT 'user';
    ALTER TABLE public.users ALTER COLUMN status SET DEFAULT 'active';
    ALTER TABLE public.users ALTER COLUMN student_status SET DEFAULT 'not_verified';
    ALTER TABLE public.users ALTER COLUMN student_menu_access SET DEFAULT false;
    ALTER TABLE public.users ALTER COLUMN email_verified SET DEFAULT false;
    ALTER TABLE public.users ALTER COLUMN public_profile_enabled SET DEFAULT true;
    ALTER TABLE public.users ALTER COLUMN verified_via SET DEFAULT 'email';
    ALTER TABLE public.users ALTER COLUMN created_at SET DEFAULT now();
    ALTER TABLE public.users ALTER COLUMN updated_at SET DEFAULT now();

    CREATE UNIQUE INDEX IF NOT EXISTS users_auth_user_id_key
      ON public.users (auth_user_id)
      WHERE auth_user_id IS NOT NULL;

    CREATE UNIQUE INDEX IF NOT EXISTS users_username_key
      ON public.users (username)
      WHERE username IS NOT NULL;

    CREATE UNIQUE INDEX IF NOT EXISTS users_username_lower_key
      ON public.users (lower(username))
      WHERE username IS NOT NULL;

    CREATE INDEX IF NOT EXISTS users_university_id_idx
      ON public.users (university_id);

    CREATE INDEX IF NOT EXISTS users_public_profile_search_idx
      ON public.users (lower(username), updated_at DESC)
      WHERE role = 'user'
        AND status = 'active'
        AND student_status = 'verified'
        AND public_profile_enabled = true
        AND suspended_at IS NULL
        AND deleted_at IS NULL;
  `);
}


let userSchemaReady = false;
let userSchemaReadyPromise: Promise<void> | null = null;

export async function getReadyPool() {
  const pool = await getMerchantReadyPool();
  if (!userSchemaReady) {
    userSchemaReadyPromise ??= ensureUserSchema(pool).then(() => {
      userSchemaReady = true;
    });
    await userSchemaReadyPromise;
  }
  return pool;
}

function normalizeEmail(email: string) {
  return email.trim().toLowerCase();
}

function getPgErrorCode(error: unknown) {
  return typeof error === "object" && error !== null && "code" in error
    ? String((error as { code?: unknown }).code || "")
    : "";
}

function getPgErrorDetails(error: unknown) {
  if (typeof error !== "object" || error === null) {
    return { message: "unknown" };
  }

  const details = error as {
    code?: unknown;
    message?: unknown;
    table?: unknown;
    column?: unknown;
    constraint?: unknown;
  };

  return {
    code: typeof details.code === "string" ? details.code : undefined,
    message: typeof details.message === "string" ? details.message : "unknown",
    table: typeof details.table === "string" ? details.table : undefined,
    column: typeof details.column === "string" ? details.column : undefined,
    constraint: typeof details.constraint === "string" ? details.constraint : undefined
  };
}

function normalizeVerifiedVia(value: CreateUserInput["verifiedVia"]) {
  return value === "ocr" ? "ocr" : "email";
}

function normalizeUsernameSeed(value: string) {
  return value
    .trim()
    .toLowerCase()
    .replace(/^@+/, "")
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9_.]+/g, ".")
    .replace(/\.+/g, ".")
    .replace(/^\.+|\.+$/g, "")
    .slice(0, 30);
}

async function usernameExists(pool: Pool, username: string) {
  const result = await pool.query<{ exists: boolean }>(
    `SELECT EXISTS (
       SELECT 1
       FROM public.users
       WHERE lower(username) = lower($1)
     )`,
    [username]
  );
  return result.rows[0]?.exists === true;
}

async function resolveSignupUsername(pool: Pool, input: CreateUserInput, email: string) {
  if (input.username?.trim()) {
    const requested = validateCadescaUsername(input.username);
    if (await usernameExists(pool, requested)) throw new Error("duplicate_username");
    return requested;
  }

  const emailLocalPart = email.split("@")[0] || "student";
  const base =
    normalizeUsernameSeed(input.displayName || input.name || emailLocalPart) ||
    normalizeUsernameSeed(emailLocalPart) ||
    "student";
  const safeBase = isValidCadescaUsername(base) ? base : `student.${randomBytes(2).toString("hex")}`;

  for (let index = 0; index < 25; index += 1) {
    const suffix = index === 0 ? "" : `.${index + 1}`;
    const candidate = `${safeBase.slice(0, 30 - suffix.length)}${suffix}`;
    if (isValidCadescaUsername(candidate) && !(await usernameExists(pool, candidate))) {
      return candidate;
    }
  }

  for (let index = 0; index < 10; index += 1) {
    const suffix = `.${randomBytes(3).toString("hex")}`;
    const candidate = `${safeBase.slice(0, 30 - suffix.length)}${suffix}`;
    if (isValidCadescaUsername(candidate) && !(await usernameExists(pool, candidate))) {
      return candidate;
    }
  }

  throw new Error("username_generation_failed");
}

export async function createUserInDb(input: CreateUserInput): Promise<User> {
  const pool = await getReadyPool();
  const email = normalizeEmail(input.email);
  const passwordHash = await hashMerchantPassword(input.password);
  const id = `user_${randomBytes(8).toString("hex")}`;
  const authUserId = input.authUserId || null;
  const userId = authUserId ? `user_${authUserId.replace(/-/g, "")}` : id;
  const verifiedVia = normalizeVerifiedVia(input.verifiedVia);
  const acceptedTermsAt = input.acceptedTermsAt ? new Date(input.acceptedTermsAt) : null;
  const verifiedAt = input.studentStatus === "verified" ? (input.verifiedAt ? new Date(input.verifiedAt) : new Date()) : null;
  const displayName = input.displayName?.trim() || input.name.trim();
  const username = await resolveSignupUsername(pool, input, email);

  try {
    const result = await pool.query(
      `INSERT INTO users (
         id, auth_user_id, name, email, password_hash, university_id, university_name, university_domain,
         student_status, student_menu_access, email_verified, username, display_name, verified_via, verified_at,
         student_id_image_path, accepted_terms_at, student_number, student_id_expires_at, student_id_issued_at, student_faculty_department
       ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21)
       ON CONFLICT (email) DO UPDATE SET
         auth_user_id = EXCLUDED.auth_user_id,
         name = EXCLUDED.name,
         password_hash = EXCLUDED.password_hash,
         university_id = EXCLUDED.university_id,
         university_name = EXCLUDED.university_name,
         university_domain = EXCLUDED.university_domain,
         student_status = EXCLUDED.student_status,
         student_menu_access = EXCLUDED.student_menu_access,
         email_verified = EXCLUDED.email_verified,
         username = EXCLUDED.username,
         display_name = EXCLUDED.display_name,
         verified_via = EXCLUDED.verified_via,
         verified_at = COALESCE(EXCLUDED.verified_at, users.verified_at),
         student_id_image_path = COALESCE(EXCLUDED.student_id_image_path, users.student_id_image_path),
         student_number = COALESCE(EXCLUDED.student_number, users.student_number),
         student_id_expires_at = COALESCE(EXCLUDED.student_id_expires_at, users.student_id_expires_at),
         student_id_issued_at = COALESCE(EXCLUDED.student_id_issued_at, users.student_id_issued_at),
         student_faculty_department = COALESCE(EXCLUDED.student_faculty_department, users.student_faculty_department),
         accepted_terms_at = EXCLUDED.accepted_terms_at,
         updated_at = now()
       WHERE users.auth_user_id = EXCLUDED.auth_user_id
       RETURNING *`,
      [
        userId,
        authUserId,
        input.name.trim(),
        email,
        passwordHash,
        input.universityId || null,
        input.universityName || null,
        input.universityDomain || null,
        input.studentStatus || "not_verified",
        input.studentMenuAccess || false,
        input.emailVerified || false,
        username,
        displayName,
        verifiedVia,
        verifiedAt,
        input.studentIdImagePath || null,
        acceptedTermsAt,
        input.studentNumber || null,
        input.studentIdExpiresAt || null,
        input.studentIdIssuedAt || null,
        input.studentFacultyDepartment || null
      ]
    );
    if (!result.rows[0]) throw new Error("duplicate_email");
    return result.rows[0];
  } catch (error) {
    if (getPgErrorCode(error) === "23505") throw new Error("duplicate_email");
    console.error("[user_db] create_failed", {
      email,
      ...getPgErrorDetails(error)
    });
    throw error;
  }
}

export async function markUserStudentVerificationPending(userId: string, studentIdImagePath?: string | null): Promise<User> {
  const pool = await getReadyPool();
  const result = await pool.query<User>(
    `UPDATE users
     SET student_status = 'pending',
         student_menu_access = false,
         verified_via = 'ocr',
         student_id_image_path = COALESCE($2, student_id_image_path),
         updated_at = now()
     WHERE id = $1
     RETURNING *`,
    [userId, studentIdImagePath || null]
  );

  if (!result.rows[0]) throw new Error("user_not_found");
  return result.rows[0];
}

export async function markUserStudentVerificationVerified(input: {
  userId: string;
  universityName?: string | null;
  universityDomain?: string | null;
  studentIdImagePath?: string | null;
  studentNumber?: string | null;
  studentIdExpiresAt?: string | null;
  studentIdIssuedAt?: string | null;
  studentFacultyDepartment?: string | null;
}): Promise<User> {
  const pool = await getReadyPool();
  const result = await pool.query<User>(
    `UPDATE users
     SET student_status = 'verified',
         student_menu_access = true,
         verified_via = 'ocr',
         verified_at = COALESCE(verified_at, now()),
         university_name = COALESCE($2, university_name),
         university_domain = COALESCE($3, university_domain),
         student_id_image_path = COALESCE($4, student_id_image_path),
         student_number = COALESCE($5, student_number),
         student_id_expires_at = COALESCE($6::date, student_id_expires_at),
         student_id_issued_at = COALESCE($7::date, student_id_issued_at),
         student_faculty_department = COALESCE($8, student_faculty_department),
         updated_at = now()
     WHERE id = $1
     RETURNING *`,
    [
      input.userId,
      input.universityName || null,
      input.universityDomain || null,
      input.studentIdImagePath || null,
      input.studentNumber || null,
      input.studentIdExpiresAt || null,
      input.studentIdIssuedAt || null,
      input.studentFacultyDepartment || null
    ]
  );

  if (!result.rows[0]) throw new Error("user_not_found");
  return result.rows[0];
}

export async function clearUserStudentIdImagePath(userId: string): Promise<User> {
  const pool = await getReadyPool();
  const result = await pool.query<User>(
    `UPDATE users
     SET student_id_image_path = null,
         updated_at = now()
     WHERE id = $1
     RETURNING *`,
    [userId]
  );

  if (!result.rows[0]) throw new Error("user_not_found");
  return result.rows[0];
}

export async function authenticateUserInDb(identifierInput: string, password: string): Promise<User> {
  const pool = await getReadyPool();
  const rawIdentifier = identifierInput.trim().toLowerCase();
  const isEmail = rawIdentifier.includes("@");
  const identifier = isEmail ? rawIdentifier : rawIdentifier.replace(/^@/, "");
  
  const result = await pool.query<User>(
    `SELECT *
     FROM users
     WHERE (
       ($2::boolean = true AND lower(email) = lower($1))
       OR ($2::boolean = false AND lower(coalesce(username, '')) = lower($1))
     )
     LIMIT 1`,
    [identifier, isEmail]
  );
  const user = result.rows[0];
  if (!user) throw new Error("user_not_found");
  
  const matches = await verifyMerchantPassword(password, user.password_hash);
  if (!matches) throw new Error("password_mismatch");
  
  return user;
}

export async function resetUserPasswordByEmail(emailInput: string, password: string): Promise<User> {
  const pool = await getReadyPool();
  const email = normalizeEmail(emailInput);
  const passwordHash = await hashMerchantPassword(password);
  const result = await pool.query<User>(
    `UPDATE public.users
     SET password_hash = $2,
         updated_at = now()
     WHERE lower(email) = lower($1)
       AND role = 'user'
       AND deleted_at IS NULL
     RETURNING *`,
    [email, passwordHash]
  );

  if (!result.rows[0]) throw new Error("user_not_found");
  return result.rows[0];
}

export async function updateUserLocale(userId: string, locale: string): Promise<void> {
  if (!isSupportedLocale(locale)) {
    throw new Error("invalid_locale");
  }

  const pool = await getReadyPool();
  await pool.query(
    "UPDATE users SET locale = $1, updated_at = now() WHERE id = $2",
    [locale satisfies SupportedLocale, userId]
  );
}
