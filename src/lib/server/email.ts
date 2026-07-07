import "server-only";

import { Resend } from "resend";

export type VerificationEmailLocale = "az" | "en" | "ru";

type SendVerificationEmailInput = {
  to: string;
  code: string;
  name?: string;
  locale?: VerificationEmailLocale;
};

type VerificationEmailCopy = {
  subject: string;
  text: string;
  html: string;
};

export class EmailServiceConfigurationError extends Error {
  constructor() {
    super("RESEND_API_KEY and EMAIL_FROM must be configured before sending verification emails.");
    this.name = "EmailServiceConfigurationError";
  }
}

export class EmailDeliveryError extends Error {
  constructor(message = "Verification email could not be sent.") {
    super(message);
    this.name = "EmailDeliveryError";
  }
}

const EMAIL_SEND_TIMEOUT_MS = 8_000;

async function withTimeout<T>(promise: Promise<T>, timeoutMs: number): Promise<T> {
  let timeout: ReturnType<typeof setTimeout> | undefined;
  const timeoutPromise = new Promise<never>((_, reject) => {
    timeout = setTimeout(() => reject(new Error("email_send_timeout")), timeoutMs);
  });

  try {
    return await Promise.race([promise, timeoutPromise]);
  } finally {
    if (timeout) clearTimeout(timeout);
  }
}

function escapeHtml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function getEmailConfig() {
  const apiKey = process.env.RESEND_API_KEY;
  const from = process.env.EMAIL_FROM;

  if (!apiKey || !from) {
    throw new EmailServiceConfigurationError();
  }

  return { resend: new Resend(apiKey), from };
}

function verificationEmailCopy(locale: VerificationEmailLocale = "az", code: string, name?: string): VerificationEmailCopy {
  const displayName = name?.trim() || "Cadesca user";

  if (locale === "en") {
    const text = [
      `Hi ${displayName},`,
      `Your verification code for Cadesca is: ${code}`,
      "This code is valid for 10 minutes.",
      "Do not share this code with anyone."
    ].join("\n");

    return {
      subject: "Your Cadesca verification code",
      text,
      html: `<p>Hi ${escapeHtml(displayName)},</p><p>Your verification code for Cadesca is: <strong style="font-size:24px;letter-spacing:4px">${code}</strong></p><p>This code is valid for 10 minutes.</p><p>Do not share this code with anyone.</p>`
    };
  }

  if (locale === "ru") {
    const text = [
      `Здравствуйте, ${displayName},`,
      `Ваш код подтверждения Cadesca: ${code}`,
      "Код действителен в течение 10 минут.",
      "Не передавайте этот код другим людям."
    ].join("\n");

    return {
      subject: "Ваш код подтверждения Cadesca",
      text,
      html: `<p>Здравствуйте, ${escapeHtml(displayName)},</p><p>Ваш код подтверждения Cadesca: <strong style="font-size:24px;letter-spacing:4px">${code}</strong></p><p>Код действителен в течение 10 минут.</p><p>Не передавайте этот код другим людям.</p>`
    };
  }

  const text = [
    `Salam ${displayName},`,
    `Cadesca hesabınızı təsdiqləmək üçün doğrulama kodunuz: ${code}`,
    "Bu kod 10 dəqiqə ərzində etibarlıdır.",
    "Kodu heç kimlə paylaşmayın."
  ].join("\n");

  return {
    subject: "Cadesca doğrulama kodunuz",
    text,
    html: `<p>Salam ${escapeHtml(displayName)},</p><p>Cadesca hesabınızı təsdiqləmək üçün doğrulama kodunuz: <strong style="font-size:24px;letter-spacing:4px">${code}</strong></p><p>Bu kod 10 dəqiqə ərzində etibarlıdır.</p><p>Kodu heç kimlə paylaşmayın.</p>`
  };
}

export async function sendVerificationEmail({ to, code, name, locale }: SendVerificationEmailInput) {
  const { resend, from } = getEmailConfig();
  const message = verificationEmailCopy(locale, code, name);
  const result = await withTimeout(
    resend.emails.send({
      from,
      to,
      subject: message.subject,
      text: message.text,
      html: message.html
    }),
    EMAIL_SEND_TIMEOUT_MS
  ).catch((error) => {
    throw new EmailDeliveryError(error instanceof Error ? error.message : undefined);
  });

  if (result.error) {
    throw new EmailDeliveryError(result.error.message);
  }

  return result.data;
}
