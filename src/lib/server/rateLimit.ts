import "server-only";

import crypto from "node:crypto";
import type { Pool, PoolClient, QueryResult } from "pg";

import { getReadyPool } from "./users";

type QueryExecutor = {
  query: <T extends object = Record<string, unknown>>(text: string, values?: unknown[]) => Promise<QueryResult<T>>;
};

type RateLimitInput = {
  namespace: string;
  identifier: string;
  limit: number;
  windowSeconds: number;
  executor?: Pool | PoolClient;
};

export class RateLimitError extends Error {
  retryAfterSeconds: number;

  constructor(retryAfterSeconds: number) {
    super("rate_limited");
    this.name = "RateLimitError";
    this.retryAfterSeconds = retryAfterSeconds;
  }
}

let schemaReady = false;
let schemaReadyPromise: Promise<void> | null = null;

async function ensureRateLimitSchema(executor: QueryExecutor) {
  if (schemaReady) return;

  schemaReadyPromise ??= executor.query(`
    CREATE TABLE IF NOT EXISTS public.security_rate_limits (
      id text primary key,
      count integer not null default 0,
      reset_at timestamptz not null,
      updated_at timestamptz not null default now()
    );
  `).then(() => {
    schemaReady = true;
  });

  await schemaReadyPromise;
}

function bucketId(namespace: string, identifier: string) {
  const secret = process.env.AUTH_SECRET;
  if (!secret) throw new Error("AUTH_SECRET is not defined");

  return crypto
    .createHmac("sha256", secret)
    .update(`${namespace}:${identifier}`)
    .digest("base64url");
}

export async function assertRateLimit(input: RateLimitInput) {
  if (!input.identifier || input.limit < 1 || input.windowSeconds < 1) {
    throw new Error("invalid_rate_limit_input");
  }

  const executor = input.executor || (await getReadyPool());
  await ensureRateLimitSchema(executor);

  const result = await executor.query<{ count: number; reset_at: Date }>(
    `INSERT INTO security_rate_limits (id, count, reset_at, updated_at)
     VALUES ($1, 1, now() + ($2::int * interval '1 second'), now())
     ON CONFLICT (id) DO UPDATE SET
       count = CASE
         WHEN security_rate_limits.reset_at <= now() THEN 1
         ELSE security_rate_limits.count + 1
       END,
       reset_at = CASE
         WHEN security_rate_limits.reset_at <= now() THEN now() + ($2::int * interval '1 second')
         ELSE security_rate_limits.reset_at
       END,
       updated_at = now()
     RETURNING count, reset_at`,
    [bucketId(input.namespace, input.identifier), input.windowSeconds]
  );

  const row = result.rows[0];
  if (!row || row.count <= input.limit) return;

  const retryAfterSeconds = Math.max(1, Math.ceil((new Date(row.reset_at).getTime() - Date.now()) / 1000));
  throw new RateLimitError(retryAfterSeconds);
}

export function rateLimitResponseHeaders(error: RateLimitError) {
  return { "Retry-After": String(error.retryAfterSeconds) };
}
