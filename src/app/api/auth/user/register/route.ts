import { NextResponse } from "next/server";
import { cookies } from "next/headers";

import { withSharedCookieDomain } from "@/lib/cookieDomain";
import { getRequestIp, turnstileStatus, verifyTurnstileToken } from "@/lib/server/turnstile";
import { verifyEmailVerificationProof } from "@/lib/server/emailVerificationProof";
import {
  authenticateUserInDb,
  createUserInDb,
  type User
} from "@/lib/server/users";
import { USER_SESSION_COOKIE, createUserSessionToken } from "@/lib/server/userSession";
import { consumeVerificationCode, verifyVerificationCode } from "@/lib/server/verificationCodes";
import {
  createConfirmedSupabaseAuthUser,
  deleteSupabaseAuthUser,
  signInSupabaseAuthOnResponse,
  SupabaseAuthBridgeError
} from "@/lib/server/supabaseAuthBridge";
import { findActiveUniversityByEmail, getEmailDomain } from "@/lib/server/universities";

export const runtime = "nodejs";

type RegisterRequestBody = {
  name?: string;
  displayName?: string;
  username?: string;
  email?: string;
  password?: string;
  turnstileToken?: string;
  universityName?: string;
  universityDomain?: string;
  verifiedVia?: "email" | "ocr";
  acceptedTermsAt?: string;
  emailVerificationCode?: string;
  emailVerificationToken?: string;
  studentIdImage?: string;
  ocrManualReview?: boolean;
};

function normalizeEmail(email: string) {
  return email.trim().toLowerCase();
}

function errorLogDetails(error: unknown) {
  if (!(error instanceof Error)) {
    return { reason: "unknown" };
  }

  const pgError = error as Error & {
    code?: unknown;
    table?: unknown;
    column?: unknown;
    constraint?: unknown;
  };

  return {
    reason: error.name,
    message: error.message,
    code: typeof pgError.code === "string" ? pgError.code : undefined,
    table: typeof pgError.table === "string" ? pgError.table : undefined,
    column: typeof pgError.column === "string" ? pgError.column : undefined,
    constraint: typeof pgError.constraint === "string" ? pgError.constraint : undefined
  };
}

function sessionStatusFromUser(user: User): "verified" | "pending" | "not_verified" {
  if (user.student_status === "verified") return "verified";
  if (user.student_status === "pending") return "pending";
  return "not_verified";
}

async function createSessionResponse(user: User, status: "verified" | "pending" | "not_verified") {
  const secret = process.env.AUTH_SECRET;
  if (!secret) {
    return NextResponse.json({ error: "internal_server_error" }, { status: 500 });
  }

  const session = await createUserSessionToken(user.id, user.email, "user", secret);
  const response = NextResponse.json({
    ok: true,
    success: true,
    status,
    user: { id: user.id, name: user.name, email: user.email, role: user.role, studentStatus: user.student_status }
  });

  response.cookies.set(USER_SESSION_COOKIE, session.token, withSharedCookieDomain({
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: Math.floor((session.payload.expiresAt - Date.now()) / 1000)
  }));

  return response;
}

async function consumeVerifiedEmailCode(recordId: string | null, email: string) {
  if (!recordId) return;

  try {
    const consumed = await consumeVerificationCode(recordId);
    if (!consumed) {
      console.warn("[user_register] email_code_consume_missed", {
        email: normalizeEmail(email),
        verificationId: recordId
      });
    }
  } catch (error) {
    console.error("[user_register] email_code_consume_failed", {
      email: normalizeEmail(email),
      verificationId: recordId,
      reason: error instanceof Error ? error.name : "unknown"
    });
  }
}

async function attachSupabaseAuthCookiesBestEffort(response: NextResponse, email: string, password: string) {
  try {
    await signInSupabaseAuthOnResponse({
      response,
      email,
      password
    });
  } catch (error) {
    console.error("[user_register] supabase_cookie_bridge_failed", {
      email: normalizeEmail(email),
      reason: error instanceof SupabaseAuthBridgeError ? error.code : error instanceof Error ? error.name : "unknown"
    });
  }
}

async function createSupabaseAuthUserBestEffort(input: {
  email: string;
  password: string;
  name: string;
  verifiedVia: "email";
  universityId?: string;
  username?: string;
  displayName?: string;
  acceptedTermsAt?: string;
}) {
  try {
    return await createConfirmedSupabaseAuthUser(input);
  } catch (error) {
    if (error instanceof SupabaseAuthBridgeError && error.code === "email_in_use") {
      throw error;
    }

    console.error("[user_register] supabase_auth_create_skipped", {
      email: normalizeEmail(input.email),
      reason: error instanceof SupabaseAuthBridgeError ? error.code : error instanceof Error ? error.name : "unknown"
    });
    return null;
  }
}

async function recoverExistingVerifiedUser(input: {
  email: string;
  password: string;
  verificationRecordId: string | null;
}) {
  try {
    const user = await authenticateUserInDb(input.email, input.password);
    if (user.status !== "active") return null;

    const response = await createSessionResponse(user, sessionStatusFromUser(user));
    await consumeVerifiedEmailCode(input.verificationRecordId, input.email);
    await attachSupabaseAuthCookiesBestEffort(response, input.email, input.password);

    console.log("[user_register] recovered_existing_user", {
      email: normalizeEmail(input.email),
      userId: user.id
    });

    return response;
  } catch (error) {
    console.warn("[user_register] duplicate_recovery_failed", {
      email: normalizeEmail(input.email),
      reason: error instanceof Error ? error.message : "unknown"
    });
    return null;
  }
}

export async function POST(request: Request) {
  const body = (await request.json().catch(() => ({}))) as RegisterRequestBody;
  const displayName = (body.displayName || body.name || "").trim();
  if (!body.email || !body.password || !displayName) {
    return NextResponse.json({ error: "missing_fields" }, { status: 400 });
  }

  if (body.verifiedVia === "ocr" || body.studentIdImage || body.ocrManualReview) {
    return NextResponse.json({ error: "student_id_ocr_disabled" }, { status: 400 });
  }

  if (process.env.NODE_ENV === "development") {
    const secret = process.env.AUTH_SECRET || "D5UcOA1nG+qxyqr5PEr3RF6uIxMYsTNIHMT4CR0YJnE=";
    const session = await createUserSessionToken("user_mock", body.email, "user", secret);
    const cookieStore = await cookies();
    cookieStore.set(USER_SESSION_COOKIE, session.token, withSharedCookieDomain({
      httpOnly: true,
      secure: false,
      sameSite: "lax",
      maxAge: 3600
    }));
    return NextResponse.json({ ok: true, user: { id: "user_mock", name: displayName || "Demo User", email: body.email, role: "user" } });
  }

  let verificationRecordId: string | null = null;

  try {
    const emailVerificationCode = body.emailVerificationCode?.trim() || "";
    const emailVerificationToken = body.emailVerificationToken?.trim() || "";

    if (emailVerificationToken) {
      const proof = await verifyEmailVerificationProof(emailVerificationToken, {
        email: body.email,
        purpose: "signup"
      });

      if (proof.status === "expired") {
        return NextResponse.json({ error: "email_verification_expired" }, { status: 410 });
      }
      if (proof.status !== "verified") {
        return NextResponse.json({ error: "email_verification_invalid" }, { status: 400 });
      }

      verificationRecordId = proof.payload.verificationId;
    } else {
      const turnstile = await verifyTurnstileToken(body.turnstileToken, getRequestIp(request));
      if (!turnstile.success) {
        return NextResponse.json({ error: turnstile.errorCode }, { status: turnstileStatus(turnstile.errorCode) });
      }

      if (!/^\d{6}$/.test(emailVerificationCode)) {
        return NextResponse.json({ error: "email_verification_required" }, { status: 400 });
      }

      const verification = await verifyVerificationCode({
        email: body.email,
        code: emailVerificationCode,
        purpose: "signup",
        consume: false
      });

      if (verification.status !== "verified") {
        if (verification.status === "expired") {
          return NextResponse.json({ error: "verification_code_expired" }, { status: 410 });
        }
        if (verification.status === "too_many_attempts") {
          return NextResponse.json({ error: "verification_too_many_attempts" }, { status: 429 });
        }
        return NextResponse.json({ error: "verification_code_invalid" }, { status: 400 });
      }

      verificationRecordId = verification.record.id;
    }

    const matchedUniversity = await findActiveUniversityByEmail(body.email);
    if (!matchedUniversity) {
      return NextResponse.json(
        {
          error: "university_not_supported",
          emailDomain: getEmailDomain(body.email)
        },
        { status: 422 }
      );
    }

    const authUser = await createSupabaseAuthUserBestEffort({
      email: body.email,
      password: body.password,
      name: displayName,
      verifiedVia: "email",
      universityId: matchedUniversity.id,
      username: body.username,
      displayName,
      acceptedTermsAt: body.acceptedTermsAt
    });

    let user: User;
    const finalStatus: "verified" = "verified";

    try {
      user = await createUserInDb({
        name: displayName,
        displayName,
        username: body.username,
        email: body.email,
        password: body.password,
        universityId: matchedUniversity.id,
        universityName: matchedUniversity.name,
        universityDomain: matchedUniversity.primaryEmailDomain,
        studentStatus: "verified",
        studentMenuAccess: true,
        emailVerified: true,
        verifiedVia: "email",
        verifiedAt: new Date().toISOString(),
        acceptedTermsAt: body.acceptedTermsAt,
        authUserId: authUser?.id
      });
    } catch (error) {
      console.error("[user_register] registration_stage_failed", {
        email: normalizeEmail(body.email),
        hasAuthUser: Boolean(authUser),
        ...errorLogDetails(error)
      });
      if (authUser) {
        await deleteSupabaseAuthUser(authUser.id).catch((cleanupError) => {
          console.error("[user_register] auth_cleanup_failed", {
            ...errorLogDetails(cleanupError)
          });
        });
      }
      throw error;
    }

    const response = await createSessionResponse(user, finalStatus);
    if (response.status < 400) {
      await consumeVerifiedEmailCode(verificationRecordId, body.email);
    }
    if (authUser) {
      await attachSupabaseAuthCookiesBestEffort(response, body.email, body.password);
    } else {
      console.warn("[user_register] supabase_auth_cookie_skipped", {
        email: normalizeEmail(body.email)
      });
    }

    return response;
  } catch (error) {
    if (
      (error instanceof Error && error.message === "duplicate_email") ||
      (error instanceof SupabaseAuthBridgeError && error.code === "email_in_use")
    ) {
      const recovered = await recoverExistingVerifiedUser({
        email: body.email,
        password: body.password,
        verificationRecordId
      });

      if (recovered) return recovered;
      return NextResponse.json({ error: "email_in_use" }, { status: 409 });
    }
    if (error instanceof Error && (error.message === "duplicate_username" || error.message === "invalid_username")) {
      return NextResponse.json({ error: error.message }, { status: 409 });
    }
    if (error instanceof SupabaseAuthBridgeError) {
      return NextResponse.json({ error: error.code }, { status: error.status });
    }
    console.error("[user_register] internal_server_error", errorLogDetails(error));
    return NextResponse.json({ error: "internal_server_error" }, { status: 500 });
  }
}
