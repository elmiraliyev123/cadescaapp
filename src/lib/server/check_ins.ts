import "server-only";

import { randomBytes } from "node:crypto";
import type { Pool, PoolClient } from "pg";

import { markStoredQrTokenAsUsed, markTotpCredentialAsUsed, QrCredentialError, verifyQrCredential } from "./qr";
import { getReadyPool } from "./users";

export type StudentCheckInRow = {
  id: string;
  user_id: string;
  restaurant_id: string;
  merchant_user_id: string;
  menu_item_id: string | null;
  qr_token_id: string | null;
  status: string;
  created_at: Date;
  cancelled_at: Date | null;
};

export type CheckInErrorCode =
  | "invalid_format"
  | "token_not_found"
  | "token_already_used"
  | "token_expired"
  | "token_user_mismatch"
  | "user_not_found"
  | "user_suspended"
  | "not_student_eligible"
  | "already_used_today"
  | "merchant_restaurant_mismatch"
  | "merchant_not_found"
  | "check_in_failed";

export class CheckInError extends Error {
  code: CheckInErrorCode;
  status: number;

  constructor(code: CheckInErrorCode, status = 400) {
    super(code);
    this.name = "CheckInError";
    this.code = code;
    this.status = status;
  }
}

type DbExecutor = Pool | PoolClient;

async function createStudentCheckIn(
  input: {
    userId: string;
    restaurantId: string;
    merchantUserId: string;
    menuItemId?: string;
    qrTokenId?: string | null;
  },
  client: PoolClient
): Promise<StudentCheckInRow> {
  const id = `chk_${randomBytes(8).toString("hex")}`;

  const result = await client.query<StudentCheckInRow>(
    `INSERT INTO student_check_ins (id, user_id, restaurant_id, merchant_user_id, menu_item_id, qr_token_id, status)
     VALUES ($1, $2, $3, $4, $5, $6, 'confirmed')
     RETURNING *`,
    [id, input.userId, input.restaurantId, input.merchantUserId, input.menuItemId || null, input.qrTokenId || null]
  );

  return result.rows[0];
}

export async function hasUserCheckedInToday(userId: string, executor?: DbExecutor): Promise<boolean> {
  const db = executor || (await getReadyPool());
  const result = await db.query(
    `SELECT 1
     FROM student_check_ins
     WHERE user_id = $1
       AND status = 'confirmed'
       AND created_at >= date_trunc('day', now())
       AND created_at < date_trunc('day', now()) + interval '1 day'
     LIMIT 1`,
    [userId]
  );

  return result.rows.length > 0;
}

function mapCredentialError(error: QrCredentialError): CheckInError {
  if (error.code === "invalid_format") return new CheckInError("invalid_format", 400);
  if (error.code === "token_not_found") return new CheckInError("token_not_found", 404);
  if (error.code === "token_expired") return new CheckInError("token_expired", 400);
  return new CheckInError("token_already_used", 400);
}

export async function confirmStudentCheckIn(input: {
  token: string;
  userId: string;
  restaurantId: string;
  merchantUserId: string;
  menuItemId?: string;
}): Promise<StudentCheckInRow> {
  const pool = await getReadyPool();
  const client = await pool.connect();

  try {
    await client.query("BEGIN");
    await client.query("SELECT pg_advisory_xact_lock(hashtext($1)::bigint)", [input.userId]);

    const merchantResult = await client.query<{
      id: string;
      status: string;
      merchant_restaurant_id: string | null;
      restaurant_id: string | null;
      restaurant_status: string | null;
      restaurant_deleted_at: Date | null;
    }>(
      `SELECT
         merchant.id,
         merchant.status,
         merchant.restaurant_id as merchant_restaurant_id,
         restaurant.id as restaurant_id,
         restaurant.status as restaurant_status,
         restaurant.deleted_at as restaurant_deleted_at
       FROM merchant_accounts merchant
       LEFT JOIN restaurants restaurant
         ON restaurant.id = merchant.restaurant_id
         OR restaurant.owner_merchant_id = merchant.id
       WHERE merchant.id = $1
       LIMIT 1
       FOR SHARE`,
      [input.merchantUserId]
    );
    const merchant = merchantResult.rows[0];

    if (!merchant || merchant.status !== "active") {
      throw new CheckInError("merchant_not_found", 401);
    }

    const linkedRestaurantId = merchant.merchant_restaurant_id || merchant.restaurant_id;
    if (
      !linkedRestaurantId ||
      linkedRestaurantId !== input.restaurantId ||
      merchant.restaurant_status === "deleted" ||
      merchant.restaurant_status === "suspended" ||
      merchant.restaurant_deleted_at
    ) {
      throw new CheckInError("merchant_restaurant_mismatch", 403);
    }

    let credential;
    try {
      credential = await verifyQrCredential(input.token, { client, lockStoredToken: true });
    } catch (error) {
      if (error instanceof QrCredentialError) throw mapCredentialError(error);
      throw error;
    }

    if (credential.userId !== input.userId) {
      throw new CheckInError("token_user_mismatch", 400);
    }

    const userResult = await client.query<{
      id: string;
      status: string;
      student_status: string;
      student_menu_access: boolean;
    }>(
      `SELECT id, status, student_status, student_menu_access
       FROM users
       WHERE id = $1
       LIMIT 1
       FOR SHARE`,
      [input.userId]
    );
    const user = userResult.rows[0];

    if (!user) throw new CheckInError("user_not_found", 404);
    if (user.status !== "active") throw new CheckInError("user_suspended", 403);
    if (user.student_status !== "verified" || !user.student_menu_access) {
      throw new CheckInError("not_student_eligible", 403);
    }

    if (await hasUserCheckedInToday(input.userId, client)) {
      throw new CheckInError("already_used_today", 403);
    }

    const checkIn = await createStudentCheckIn(
      {
        userId: input.userId,
        restaurantId: input.restaurantId,
        merchantUserId: input.merchantUserId,
        menuItemId: input.menuItemId,
        qrTokenId: credential.qrTokenId
      },
      client
    );

    if (credential.kind === "stored") {
      const marked = await markStoredQrTokenAsUsed(credential.qrTokenId, client);
      if (!marked) throw new CheckInError("token_already_used", 400);
    } else {
      const marked = await markTotpCredentialAsUsed(credential, client);
      if (!marked) throw new CheckInError("token_already_used", 400);
    }

    await client.query("COMMIT");
    return checkIn;
  } catch (error) {
    await client.query("ROLLBACK").catch(() => undefined);
    throw error;
  } finally {
    client.release();
  }
}
