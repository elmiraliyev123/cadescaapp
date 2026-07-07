import "server-only";

import { NextResponse } from "next/server";

import { EmailDeliveryError, EmailServiceConfigurationError, type VerificationEmailLocale } from "@/lib/server/email";
import { createEmailVerificationProof } from "@/lib/server/emailVerificationProof";
import { sendEmailVerificationCode, VerificationCodeRateLimitError } from "@/lib/server/verificationEmailFlow";
import {
  isValidVerificationEmail,
  verifyVerificationCode,
  VerificationCodeConfigurationError,
  type EmailVerificationPurpose
} from "@/lib/server/verificationCodes";
import { getRequestIp, turnstileStatus, verifyTurnstileToken } from "@/lib/server/turnstile";

type SendVerificationCodeRequest = {
  email?: string;
  name?: string;
  locale?: VerificationEmailLocale;
  language?: VerificationEmailLocale;
  purpose?: EmailVerificationPurpose;
  turnstileToken?: string;
};

type VerifyEmailRequest = {
  email?: string;
  code?: string;
  purpose?: EmailVerificationPurpose;
  turnstileToken?: string;
};

function parsePurpose(value: unknown): EmailVerificationPurpose {
  return value === "login" || value === "password_reset" || value === "signup" ? value : "signup";
}

function parseLocale(value: unknown): VerificationEmailLocale {
  return value === "en" || value === "ru" || value === "az" ? value : "az";
}

function jsonError(message: string, status: number) {
  return NextResponse.json({ message }, { status });
}

function getDiagnosticInfo() {
  return {
    hasResendApiKey: Boolean(process.env.RESEND_API_KEY),
    resendKeyLooksValid: Boolean(process.env.RESEND_API_KEY?.startsWith("re_")),
    hasEmailFrom: Boolean(process.env.EMAIL_FROM),
    emailFromLooksValid: Boolean(process.env.EMAIL_FROM?.includes("@")),
    hasDatabaseUrl: Boolean(process.env.DATABASE_URL),
    databaseUrlLooksValid: Boolean(process.env.DATABASE_URL?.startsWith("postgresql://") && !process.env.DATABASE_URL?.includes("[YOUR-PASSWORD]")),
    hasAuthSecret: Boolean(process.env.AUTH_SECRET),
    authSecretLooksValid: Boolean(process.env.AUTH_SECRET && process.env.AUTH_SECRET.length >= 32),
    nodeEnv: process.env.NODE_ENV,
    vercelEnv: process.env.VERCEL_ENV
  };
}

function getDiagnosticError(info: ReturnType<typeof getDiagnosticInfo>) {
  if (!info.hasResendApiKey) return "resend_api_key_missing";
  if (!info.resendKeyLooksValid) return "resend_api_key_invalid";
  if (!info.hasEmailFrom) return "email_from_missing";
  if (!info.emailFromLooksValid) return "email_from_invalid";
  if (!info.hasDatabaseUrl) return "database_url_missing";
  if (!info.databaseUrlLooksValid) return "database_url_invalid";
  if (!info.hasAuthSecret) return "auth_service_not_configured";
  if (!info.authSecretLooksValid) return "auth_service_not_configured";
  return null;
}

function mapSendError(error: unknown) {
  if (error instanceof VerificationCodeRateLimitError) return jsonError("email_send_rate_limited", 429);
  if (error instanceof VerificationCodeConfigurationError) return jsonError("auth_service_not_configured", 503);
  if (error instanceof EmailServiceConfigurationError) return jsonError("email_service_not_configured", 503);
  if (error instanceof EmailDeliveryError) return jsonError("resend_send_failed", 502);

  const errMessage = error instanceof Error ? error.message : "";
  const errCode =
    typeof error === "object" && error !== null && "code" in error
      ? String((error as { code?: unknown }).code || "")
      : "";
  if (errCode === 'ENOTFOUND' || errCode === 'ECONNREFUSED' || errCode === '28P01' || errCode === '3D000' || errCode === 'EAI_AGAIN' || errMessage.includes('password authentication failed') || errMessage.includes('connect ECONNREFUSED') || errMessage.includes('database')) {
     return jsonError("database_connection_failed", 503);
  }

  return jsonError("email_send_failed", 502);
}

export async function handleSendVerificationCodeRequest(request: Request) {
  const body = (await request.json().catch(() => ({}))) as SendVerificationCodeRequest;
  const email = body.email?.trim().toLowerCase() || "";
  const purpose = parsePurpose(body.purpose);

  if (!isValidVerificationEmail(email)) {
    return jsonError("invalid_request", 400);
  }

  if (purpose === "signup") {
    const turnstile = await verifyTurnstileToken(body.turnstileToken, getRequestIp(request));
    if (!turnstile.success) {
      return jsonError(turnstile.errorCode, turnstileStatus(turnstile.errorCode));
    }
  }

  const diagError = getDiagnosticError(getDiagnosticInfo());
  if (diagError) {
    return jsonError(diagError, 503);
  }

  try {
    const record = await sendEmailVerificationCode({
      email,
      name: body.name,
      locale: parseLocale(body.locale || body.language),
      purpose
    });

    return NextResponse.json({ ok: true, expiresAt: record.expiresAt });
  } catch (error) {
    return mapSendError(error);
  }
}

export async function handleVerifyEmailRequest(request: Request) {
  const body = (await request.json().catch(() => ({}))) as VerifyEmailRequest;
  const email = body.email?.trim().toLowerCase() || "";
  const code = body.code?.trim() || "";
  const purpose = parsePurpose(body.purpose);

  console.log("[email_verification] request_received", {
    email,
    purpose,
    hasSixDigitCode: /^\d{6}$/.test(code),
    hasTurnstileToken: Boolean(body.turnstileToken)
  });

  if (!isValidVerificationEmail(email) || !/^\d{6}$/.test(code)) {
    console.log("[email_verification] invalid_request", {
      email,
      purpose,
      hasEmail: Boolean(email),
      hasSixDigitCode: /^\d{6}$/.test(code)
    });
    return jsonError("invalid_request", 400);
  }

  if (purpose === "signup") {
    const turnstile = await verifyTurnstileToken(body.turnstileToken, getRequestIp(request));
    if (!turnstile.success) {
      return jsonError(turnstile.errorCode, turnstileStatus(turnstile.errorCode));
    }
  }

  try {
    const result = await verifyVerificationCode({
      email,
      code,
      purpose,
      consume: purpose !== "signup"
    });

    console.log("[email_verification] verification_result", {
      email,
      purpose,
      status: result.status,
      recordId: "record" in result ? result.record?.id : undefined,
      expiresAt: "record" in result ? result.record?.expiresAt : undefined,
      attempts: "record" in result ? result.record?.attempts : undefined
    });

    if (result.status === "verified") {
      if (purpose === "signup") {
        return NextResponse.json({
          ok: true,
          emailVerificationToken: await createEmailVerificationProof({
            email,
            purpose,
            verificationId: result.record.id,
            expiresAt: result.record.expiresAt
          })
        });
      }

      return NextResponse.json({ ok: true });
    }

    if (result.status === "expired") return jsonError("verification_code_expired", 410);
    if (result.status === "too_many_attempts") return jsonError("verification_too_many_attempts", 429);
    return jsonError("verification_code_invalid", 400);
  } catch (error) {
    if (error instanceof VerificationCodeConfigurationError) return jsonError("auth_service_not_configured", 503);
    return jsonError("verification_failed", 500);
  }
}
