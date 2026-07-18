import { NextResponse } from "next/server";

import { type VerificationEmailLocale } from "@/lib/server/email";
import { eventMutationForbiddenResponse, eventMutationOriginAllowed } from "@/lib/server/eventRoute";
import { RateLimitError, assertRateLimit, rateLimitResponseHeaders } from "@/lib/server/rateLimit";
import {
  readLimitedStudentClubJson,
  StudentClubBodyTooLargeError
} from "@/lib/server/studentClubRequest";
import { StudentClubError, validateClubOtpRecipient } from "@/lib/server/studentClubs";
import {
  getRequestIp,
  getStudentClubTurnstileHostnames,
  turnstileStatus,
  verifyTurnstileToken
} from "@/lib/server/turnstile";
import { sendEmailVerificationCode } from "@/lib/server/verificationEmailFlow";

export const runtime = "nodejs";

type SendClubOtpBody = {
  universityId?: string;
  representativeEmail?: string;
  representativeName?: string;
  officialEmail?: string;
  locale?: VerificationEmailLocale;
};

function locale(value: unknown): VerificationEmailLocale {
  return value === "az" || value === "en" || value === "ru" || value === "tr" ? value : "en";
}

function bodyText(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function genericError(status = 400, headers?: HeadersInit) {
  return NextResponse.json({ error: "application_invalid" }, { status, headers });
}

export async function POST(request: Request) {
  if (!eventMutationOriginAllowed(request)) return eventMutationForbiddenResponse();
  const ip = getRequestIp(request) || "unresolved";

  const turnstile = await verifyTurnstileToken(request.headers.get("x-cadesca-turnstile"), ip, {
    expectedAction: "club_application",
    allowedHostnames: getStudentClubTurnstileHostnames()
  });
  if (!turnstile.success) {
    return NextResponse.json(
      { error: "application_invalid" },
      { status: turnstileStatus(turnstile.errorCode) }
    );
  }

  try {
    await assertRateLimit({
      namespace: "club_application_otp_ip_hour",
      identifier: ip,
      limit: 20,
      windowSeconds: 60 * 60
    });
    const parsed = await readLimitedStudentClubJson(request);
    const body = (parsed && typeof parsed === "object" ? parsed : {}) as SendClubOtpBody;
    const representativeName = bodyText(body.representativeName);
    const representativeEmail = bodyText(body.representativeEmail).toLowerCase();
    const officialEmail = bodyText(body.officialEmail).toLowerCase();
    const universityId = bodyText(body.universityId);
    if (representativeName.length < 2 || representativeName.length > 80) return genericError(422);

    const validated = await validateClubOtpRecipient({ universityId, representativeEmail, officialEmail });
    await assertRateLimit({
      namespace: "club_application_otp_email_cooldown",
      identifier: validated.representativeEmail,
      limit: 1,
      windowSeconds: 60
    });
    await assertRateLimit({
      namespace: "club_application_otp_email_hour",
      identifier: validated.representativeEmail,
      limit: 5,
      windowSeconds: 60 * 60
    });
    await sendEmailVerificationCode({
      email: validated.representativeEmail,
      name: representativeName,
      locale: locale(body.locale),
      purpose: "club_application"
    });

    return NextResponse.json({ ok: true });
  } catch (error) {
    if (error instanceof StudentClubBodyTooLargeError) return genericError(413);
    if (error instanceof SyntaxError) return genericError(400);
    if (error instanceof RateLimitError) {
      return genericError(429, rateLimitResponseHeaders(error));
    }
    if (error instanceof StudentClubError) return genericError(error.status);
    console.error("[student_clubs] otp_send_failed", {
      reason: error instanceof Error ? error.name : "unknown"
    });
    return genericError(502);
  }
}
