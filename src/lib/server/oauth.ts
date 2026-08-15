import "server-only";

import crypto from "node:crypto";

import {
  CLIENT_ACCESS_POLICIES,
  evaluateClientAccess,
  type ClientAccessPolicy
} from "@/lib/auth/clientAccessPolicy";
import {
  derivePkceChallenge,
  isExactRedirectAllowed,
  isValidOAuthState,
  isValidPkceValue
} from "@/lib/auth/oauthSecurity";
import { getCurrentStudentContext } from "@/lib/server/social";
import { getReadyPool } from "@/lib/server/users";

const AUTHORIZATION_CODE_TTL_SECONDS = 5 * 60;
const ACCESS_TOKEN_TTL_SECONDS = 60 * 60;
const OAUTH_TOKEN_BYTES = 32;

type OAuthClientRow = {
  client_id: string;
  name: string;
  client_type: "public" | "confidential";
  redirect_uris: string[];
  allowed_scopes: string[];
  access_policy: string;
  status: "active" | "disabled";
};

type AuthorizationCodeRow = {
  id: string;
  client_id: string;
  user_id: string;
  redirect_uri: string;
  scope: string[];
  code_challenge: string;
  code_challenge_method: string;
  expires_at: Date | string;
  used_at: Date | string | null;
};

export class OAuthError extends Error {
  code: string;
  status: number;

  constructor(code: string, status = 400) {
    super(code);
    this.name = "OAuthError";
    this.code = code;
    this.status = status;
  }
}

function sha256(value: string) {
  return crypto.createHash("sha256").update(value, "utf8").digest("hex");
}

function safeEqual(left: string, right: string) {
  const leftBytes = Buffer.from(left);
  const rightBytes = Buffer.from(right);
  return leftBytes.length === rightBytes.length && crypto.timingSafeEqual(leftBytes, rightBytes);
}

function randomCredential() {
  return crypto.randomBytes(OAUTH_TOKEN_BYTES).toString("base64url");
}

function isPolicy(value: string): value is ClientAccessPolicy {
  return (CLIENT_ACCESS_POLICIES as readonly string[]).includes(value);
}

function requestedScopes(value: string | null) {
  return Array.from(new Set((value || "openid profile").split(/\s+/).map((item) => item.trim()).filter(Boolean)));
}

async function loadClient(clientId: string) {
  const pool = await getReadyPool();
  const result = await pool.query<OAuthClientRow>(
    `select client_id, name, client_type, redirect_uris, allowed_scopes, access_policy, status
       from public.oauth_clients
      where client_id = $1
      limit 1`,
    [clientId]
  );
  const client = result.rows[0];
  if (!client || client.status !== "active") throw new OAuthError("invalid_client", 400);
  return client;
}

export type AuthorizationRequest = {
  clientId: string;
  redirectUri: string;
  responseType: string;
  scope: string | null;
  state: string | null;
  nonce: string | null;
  codeChallenge: string | null;
  codeChallengeMethod: string | null;
};

export async function authorizeClient(request: AuthorizationRequest) {
  const client = await loadClient(request.clientId);

  // Never redirect until the exact URI is known to belong to this client.
  if (!isExactRedirectAllowed(client.redirect_uris, request.redirectUri)) throw new OAuthError("invalid_redirect_uri", 400);
  if (request.responseType !== "code") throw new OAuthError("unsupported_response_type", 400);
  if (!isValidOAuthState(request.state)) throw new OAuthError("invalid_state", 400);
  if (!isValidPkceValue(request.codeChallenge) || request.codeChallengeMethod !== "S256") {
    throw new OAuthError("invalid_pkce", 400);
  }

  const scopes = requestedScopes(request.scope);
  if (!scopes.length || scopes.some((scope) => !client.allowed_scopes.includes(scope))) {
    throw new OAuthError("invalid_scope", 400);
  }
  if (scopes.includes("openid") && (!request.nonce || request.nonce.length < 16 || request.nonce.length > 512)) {
    throw new OAuthError("invalid_nonce", 400);
  }
  if (!isPolicy(client.access_policy)) throw new OAuthError("server_error", 500);

  const user = await getCurrentStudentContext();
  if (!user) throw new OAuthError("login_required", 401);

  const access = evaluateClientAccess(user, client.access_policy);
  if (!access.allowed) {
    return {
      redirectUri: request.redirectUri,
      state: request.state!,
      error: "access_denied" as const,
      errorDescription: access.reason
    };
  }

  const rawCode = randomCredential();
  const pool = await getReadyPool();
  await pool.query(
    `insert into public.oauth_authorization_codes (
       code_hash, client_id, user_id, redirect_uri, scope, nonce,
       code_challenge, code_challenge_method, expires_at
     ) values ($1, $2, $3, $4, $5::text[], $6, $7, 'S256', now() + ($8::int * interval '1 second'))`,
    [
      sha256(rawCode),
      client.client_id,
      user.id,
      request.redirectUri,
      scopes,
      request.nonce,
      request.codeChallenge,
      AUTHORIZATION_CODE_TTL_SECONDS
    ]
  );

  return {
    redirectUri: request.redirectUri,
    state: request.state!,
    code: rawCode
  };
}

export async function exchangeAuthorizationCode(input: {
  grantType: string;
  clientId: string;
  code: string;
  redirectUri: string;
  codeVerifier: string;
}) {
  if (input.grantType !== "authorization_code") throw new OAuthError("unsupported_grant_type", 400);
  if (!input.clientId || !input.code || !input.redirectUri || !isValidPkceValue(input.codeVerifier)) {
    throw new OAuthError("invalid_request", 400);
  }

  const client = await loadClient(input.clientId);
  if (!isExactRedirectAllowed(client.redirect_uris, input.redirectUri)) throw new OAuthError("invalid_grant", 400);

  const pool = await getReadyPool();
  const database = await pool.connect();
  try {
    await database.query("begin");
    const result = await database.query<AuthorizationCodeRow>(
      `select id, client_id, user_id, redirect_uri, scope, code_challenge,
              code_challenge_method, expires_at, used_at
         from public.oauth_authorization_codes
        where code_hash = $1
        for update`,
      [sha256(input.code)]
    );
    const authorization = result.rows[0];
    if (
      !authorization ||
      authorization.used_at ||
      authorization.client_id !== client.client_id ||
      authorization.redirect_uri !== input.redirectUri ||
      authorization.code_challenge_method !== "S256" ||
      new Date(authorization.expires_at).getTime() <= Date.now() ||
      !safeEqual(derivePkceChallenge(input.codeVerifier), authorization.code_challenge)
    ) {
      throw new OAuthError("invalid_grant", 400);
    }

    const consumed = await database.query(
      `update public.oauth_authorization_codes
          set used_at = now()
        where id = $1 and used_at is null`,
      [authorization.id]
    );
    if (consumed.rowCount !== 1) throw new OAuthError("invalid_grant", 400);

    const accessToken = randomCredential();
    await database.query(
      `insert into public.oauth_access_tokens (
         token_hash, client_id, user_id, scope, expires_at
       ) values ($1, $2, $3, $4::text[], now() + ($5::int * interval '1 second'))`,
      [sha256(accessToken), client.client_id, authorization.user_id, authorization.scope, ACCESS_TOKEN_TTL_SECONDS]
    );
    await database.query("commit");

    return {
      access_token: accessToken,
      token_type: "Bearer" as const,
      expires_in: ACCESS_TOKEN_TTL_SECONDS,
      scope: authorization.scope.join(" ")
    };
  } catch (error) {
    await database.query("rollback").catch(() => undefined);
    throw error;
  } finally {
    database.release();
  }
}

export async function userInfoForAccessToken(rawToken: string) {
  if (!rawToken) throw new OAuthError("invalid_token", 401);
  const pool = await getReadyPool();
  const result = await pool.query<{
    user_id: string;
    client_id: string;
    scope: string[];
    username: string | null;
    display_name: string | null;
    name: string;
    email: string;
    email_verified: boolean;
    university_id: string | null;
    university_name: string | null;
    university_slug: string | null;
    student_status: string;
  }>(
    `select token.user_id,
            token.client_id,
            token.scope,
            app_user.username,
            app_user.display_name,
            app_user.name,
            app_user.email,
            app_user.email_verified,
            app_user.university_id,
            university.name as university_name,
            university.slug as university_slug,
            app_user.student_status
       from public.oauth_access_tokens token
       join public.users app_user on app_user.id = token.user_id
       left join public.universities university on university.id = app_user.university_id
      where token.token_hash = $1
        and token.revoked_at is null
        and token.expires_at > now()
        and app_user.status = 'active'
      limit 1`,
    [sha256(rawToken)]
  );
  const row = result.rows[0];
  if (!row) throw new OAuthError("invalid_token", 401);

  const claims: Record<string, unknown> = { sub: row.user_id };
  if (row.scope.includes("profile")) {
    claims.name = row.display_name || row.name;
    claims.preferred_username = row.username;
  }
  if (row.scope.includes("email")) {
    claims.email = row.email;
    claims.email_verified = row.email_verified;
  }
  if (row.scope.includes("university")) {
    claims.university_id = row.university_id;
    claims.university_name = row.university_name;
    claims.university_slug = row.university_slug;
    claims.university_verified = row.student_status === "verified";
  }
  return claims;
}
