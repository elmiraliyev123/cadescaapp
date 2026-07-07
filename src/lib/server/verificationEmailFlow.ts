import "server-only";

import { sendVerificationEmail } from "@/lib/server/email";
import {
  createVerificationCode,
  generateVerificationCode,
  getLastVerificationCodeSentAt,
  invalidateVerificationCodesForEmail,
  setLastVerificationCodeSentAt,
  type EmailVerificationPurpose
} from "@/lib/server/verificationCodes";
import type { VerificationEmailLocale } from "@/lib/server/email";

export const VERIFICATION_RESEND_RATE_LIMIT_MS = 60 * 1000;

export class VerificationCodeRateLimitError extends Error {
  constructor() {
    super("A verification code was sent recently. Please wait before requesting another code.");
    this.name = "VerificationCodeRateLimitError";
  }
}

export async function sendEmailVerificationCode({
  email,
  name,
  locale,
  purpose,
  now = Date.now()
}: {
  email: string;
  name?: string;
  locale?: VerificationEmailLocale;
  purpose: EmailVerificationPurpose;
  now?: number;
}) {
  const lastSentAt = getLastVerificationCodeSentAt(email, purpose);
  if (lastSentAt && now - lastSentAt < VERIFICATION_RESEND_RATE_LIMIT_MS) {
    throw new VerificationCodeRateLimitError();
  }

  await invalidateVerificationCodesForEmail(email, purpose, now);

  const code = generateVerificationCode();
  const record = await createVerificationCode({ email, code, purpose, now });

  try {
    await sendVerificationEmail({ to: email, code, name, locale });
    setLastVerificationCodeSentAt(email, purpose, now);
    return record;
  } catch (error) {
    await invalidateVerificationCodesForEmail(email, purpose, now);
    throw error;
  }
}
