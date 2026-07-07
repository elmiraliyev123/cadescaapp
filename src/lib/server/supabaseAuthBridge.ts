import "server-only";

import type { NextResponse } from "next/server";

import { getSupabaseAdminClient } from "@/lib/supabase/admin";
import { createSupabaseRouteHandlerClient } from "@/lib/supabase/route";
import { getReadyPool } from "@/lib/server/users";

export type SupabaseAuthBridgeErrorCode =
  | "email_in_use"
  | "supabase_auth_not_configured"
  | "supabase_auth_create_failed"
  | "supabase_auth_delete_failed"
  | "supabase_auth_sign_in_failed";

export class SupabaseAuthBridgeError extends Error {
  code: SupabaseAuthBridgeErrorCode;
  status: number;

  constructor(code: SupabaseAuthBridgeErrorCode, status = 500, message = code) {
    super(message);
    this.name = "SupabaseAuthBridgeError";
    this.code = code;
    this.status = status;
  }
}

function normalizeEmail(email: string) {
  return email.trim().toLowerCase();
}

function authErrorLooksDuplicate(message: string) {
  return /already|duplicate|registered|exists/i.test(message);
}

export async function createConfirmedSupabaseAuthUser(input: {
  email: string;
  password: string;
  name: string;
  verifiedVia: "email" | "ocr";
  universityId?: string;
  username?: string;
  displayName?: string;
  acceptedTermsAt?: string;
}) {
  try {
    await getReadyPool();
  } catch (error) {
    console.error("[supabase_auth_bridge] schema_prepare_failed", {
      email: normalizeEmail(input.email),
      reason: error instanceof Error ? error.message : "unknown"
    });
  }

  let admin;
  try {
    admin = getSupabaseAdminClient();
  } catch {
    throw new SupabaseAuthBridgeError("supabase_auth_not_configured", 503);
  }

  const { data, error } = await admin.auth.admin.createUser({
    email: normalizeEmail(input.email),
    password: input.password,
    email_confirm: true,
    user_metadata: {
      name: input.displayName || input.name,
      username: input.username || null
    },
    app_metadata: {
      name: input.name,
      display_name: input.displayName || input.name,
      username: input.username || null,
      university_id: input.universityId || null,
      verified_via: input.verifiedVia,
      accepted_terms_at: input.acceptedTermsAt || null
    }
  });

  if (error) {
    if (authErrorLooksDuplicate(error.message)) {
      console.warn("[supabase_auth_bridge] create_duplicate", {
        email: normalizeEmail(input.email)
      });
      throw new SupabaseAuthBridgeError("email_in_use", 409);
    }
    console.error("[supabase_auth_bridge] create_failed", {
      email: normalizeEmail(input.email),
      status: error.status,
      code: error.code,
      message: error.message
    });
    throw new SupabaseAuthBridgeError("supabase_auth_create_failed", 502);
  }

  if (!data.user?.id) {
    throw new SupabaseAuthBridgeError("supabase_auth_create_failed", 502);
  }

  return data.user;
}

export async function deleteSupabaseAuthUser(userId: string) {
  try {
    const { error } = await getSupabaseAdminClient().auth.admin.deleteUser(userId);
    if (error) throw error;
  } catch {
    throw new SupabaseAuthBridgeError("supabase_auth_delete_failed", 502);
  }
}

export async function signInSupabaseAuthOnResponse(input: {
  response: NextResponse;
  email: string;
  password: string;
}) {
  let errorMessage = "";

  try {
    const supabase = await createSupabaseRouteHandlerClient(input.response);
    const { error } = await supabase.auth.signInWithPassword({
      email: normalizeEmail(input.email),
      password: input.password
    });

    if (!error) return;
    errorMessage = error.message;
  } catch (error) {
    errorMessage = error instanceof Error ? error.message : "unknown";
  }

  console.error("[supabase_auth_bridge] sign_in_failed", {
    email: normalizeEmail(input.email),
    message: errorMessage
  });

  throw new SupabaseAuthBridgeError("supabase_auth_sign_in_failed", 502);
}
