import { NextResponse } from "next/server";

import { withSharedCookieDomain } from "@/lib/cookieDomain";
import { eventMutationForbiddenResponse, eventMutationOriginAllowed } from "@/lib/server/eventRoute";
import { RateLimitError, assertRateLimit, rateLimitResponseHeaders } from "@/lib/server/rateLimit";
import {
  readLimitedStudentClubFormData,
  StudentClubBodyTooLargeError
} from "@/lib/server/studentClubRequest";
import { StudentClubError, submitClubApplication, type ClubApplicationInput } from "@/lib/server/studentClubs";
import { signInSupabaseAuthOnResponse } from "@/lib/server/supabaseAuthBridge";
import {
  getRequestIp,
  getStudentClubTurnstileHostnames,
  turnstileStatus,
  verifyTurnstileToken
} from "@/lib/server/turnstile";
import { USER_SESSION_COOKIE, createUserSessionToken } from "@/lib/server/userSession";

export const runtime = "nodejs";

function text(formData: FormData, key: string) {
  const value = formData.get(key);
  return typeof value === "string" ? value.trim() : "";
}

function rawText(formData: FormData, key: string) {
  const value = formData.get(key);
  return typeof value === "string" ? value : "";
}

function file(formData: FormData, key: string) {
  const value = formData.get(key);
  if (!value || typeof value === "string") throw new StudentClubError("invalid_upload", 422);
  return value;
}

function applicationInput(formData: FormData): ClubApplicationInput & { otp: string } {
  return {
    universityId: text(formData, "universityId"),
    clubName: text(formData, "clubName"),
    preferredSlug: text(formData, "preferredSlug"),
    officialEmail: text(formData, "officialEmail"),
    representativeName: text(formData, "representativeName"),
    representativeEmail: text(formData, "representativeEmail"),
    representativeUsername: text(formData, "representativeUsername"),
    password: rawText(formData, "password"),
    confirmPassword: rawText(formData, "confirmPassword"),
    description: text(formData, "description"),
    logo: file(formData, "logo"),
    instagramUrl: text(formData, "instagramUrl"),
    websiteUrl: text(formData, "websiteUrl"),
    universityPageUrl: text(formData, "universityPageUrl") || null,
    recognitionDocument: file(formData, "recognitionDocument"),
    contactPhone: text(formData, "contactPhone") || null,
    additionalNote: text(formData, "additionalNote") || null,
    agreementAccepted: text(formData, "agreementAccepted") === "true",
    otp: text(formData, "otp")
  };
}

function genericError(status: number, code = "application_invalid", headers?: HeadersInit) {
  return NextResponse.json({ error: code }, { status, headers });
}

export async function POST(request: Request) {
  if (!eventMutationOriginAllowed(request)) return eventMutationForbiddenResponse();
  const ip = getRequestIp(request) || "unresolved";
  const turnstile = await verifyTurnstileToken(request.headers.get("x-cadesca-turnstile"), ip, {
    expectedAction: "club_application",
    allowedHostnames: getStudentClubTurnstileHostnames()
  });
  if (!turnstile.success) {
    return genericError(turnstileStatus(turnstile.errorCode));
  }

  let formData: FormData;
  try {
    formData = await readLimitedStudentClubFormData(request);
  } catch (error) {
    if (error instanceof StudentClubBodyTooLargeError) return genericError(413, "invalid_upload");
    return genericError(400);
  }

  const representativeEmail = text(formData, "representativeEmail").toLowerCase();

  try {
    const secret = process.env.AUTH_SECRET;
    if (!secret) return genericError(500, "internal_server_error");
    await assertRateLimit({
      namespace: "club_application_submit_email",
      identifier: representativeEmail || "missing",
      limit: 3,
      windowSeconds: 10 * 60
    });
    await assertRateLimit({
      namespace: "club_application_submit_ip",
      identifier: ip,
      limit: 10,
      windowSeconds: 10 * 60
    });

    const input = applicationInput(formData);
    if (!/^\d{6}$/.test(input.otp)) return genericError(400, "verification_code_invalid");
    const result = await submitClubApplication(input);

    const session = await createUserSessionToken(result.user.id, result.user.email, "user", secret);
    const response = NextResponse.json({ ok: true, clubId: result.clubId, status: "pending_review" });
    response.cookies.set(USER_SESSION_COOKIE, session.token, withSharedCookieDomain({
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: Math.floor((session.payload.expiresAt - Date.now()) / 1000),
      path: "/"
    }));

    await signInSupabaseAuthOnResponse({
      response,
      email: input.representativeEmail,
      password: input.password
    }).catch((error) => {
      console.error("[student_clubs] supabase_cookie_bridge_failed", {
        reason: error instanceof Error ? error.name : "unknown"
      });
    });
    return response;
  } catch (error) {
    if (error instanceof RateLimitError) {
      return genericError(429, "application_invalid", rateLimitResponseHeaders(error));
    }
    if (error instanceof StudentClubError) {
      const publicCode = error.code === "application_conflict" ? "application_conflict" : error.code;
      return genericError(error.status, publicCode);
    }
    console.error("[student_clubs] submit_failed", {
      reason: error instanceof Error ? error.name : "unknown"
    });
    return genericError(500, "internal_server_error");
  }
}
