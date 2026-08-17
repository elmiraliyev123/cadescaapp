import { createHash, randomUUID, timingSafeEqual } from "node:crypto";

import { NextResponse } from "next/server";

import { assertImageAllowed } from "@/lib/server/imageModeration";
import {
  CLUB_APPLICATION_STAGING_BUCKET,
  createStudentClubUploadTickets,
  downloadStudentClubStagedFile,
  removeStudentClubStagedFiles
} from "@/lib/server/studentClubUploads";
import { getSupabaseAdminClient } from "@/lib/supabase/admin";
import { getReadyPool } from "@/lib/server/users";
import { USER_SESSION_COOKIE, createUserSessionToken } from "@/lib/server/userSession";
import { withSharedCookieDomain } from "@/lib/cookieDomain";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const EXPECTED_KEY_HASH = "1fb38dca3a58dc81d9d860f0c762935c781096cffaeccf87b37f27a2afffcadf";

function verificationKeyMatches(value: string | null) {
  if (!value) return false;
  const actual = createHash("sha256").update(value).digest();
  const expected = Buffer.from(EXPECTED_KEY_HASH, "hex");
  return actual.length === expected.length && timingSafeEqual(actual, expected);
}

export async function POST(request: Request) {
  if (!verificationKeyMatches(request.headers.get("x-cadesca-verification"))) {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }

  const body = await request.json().catch(() => ({})) as { action?: string; userId?: string };
  if (body.action === "provision_browser_session") {
    const secret = process.env.AUTH_SECRET;
    if (!secret) return NextResponse.json({ error: "session_unavailable" }, { status: 503 });
    const pool = await getReadyPool();
    const university = await pool.query<{
      id: string;
      name: string;
      university_email_domain: string;
    }>(
      `select id, name, university_email_domain
         from public.universities
        where status = 'active'
        order by case when slug = 'bilkent' then 0 else 1 end, name
        limit 1`
    );
    const selected = university.rows[0];
    if (!selected) return NextResponse.json({ error: "university_unavailable" }, { status: 503 });
    const suffix = randomUUID().replaceAll("-", "");
    const userId = `qa_club_upload_${suffix}`;
    const email = `qa-club-upload-${suffix.slice(0, 16)}@example.invalid`;
    await pool.query(
      `insert into public.users (
         id, name, email, password_hash, role, status, university_name,
         university_domain, student_status, student_menu_access, email_verified,
         accepted_terms_at, verified_via, university_id, verified_at, username,
         display_name, public_profile_enabled, created_at, updated_at
       ) values (
         $1, 'Cadesca Upload QA', $2, 'disabled-production-e2e-account', 'user', 'active', $3,
         $4, 'verified', true, true, now(), 'platform_test', $5::uuid, now(), $6,
         'Cadesca Upload QA', false, now(), now()
       )`,
      [userId, email, selected.name, selected.university_email_domain, selected.id, `qa.upload.${suffix.slice(0, 12)}`]
    );
    const session = await createUserSessionToken(userId, email, "user", secret);
    const response = NextResponse.json({ ok: true, userId, universityId: selected.id, universityName: selected.name });
    response.cookies.set(USER_SESSION_COOKIE, session.token, withSharedCookieDomain({
      httpOnly: true,
      secure: true,
      sameSite: "lax",
      maxAge: 60 * 60
    }));
    return response;
  }

  if (body.action === "remove_browser_session") {
    if (!body.userId?.startsWith("qa_club_upload_") || body.userId.length > 80) {
      return NextResponse.json({ error: "invalid_test_user" }, { status: 422 });
    }
    const pool = await getReadyPool();
    const membership = await pool.query<{ count: string }>(
      `select count(*)::text as count from public.club_memberships where user_id = $1`,
      [body.userId]
    );
    if (Number(membership.rows[0]?.count || 0) > 0) {
      return NextResponse.json({ error: "test_application_exists" }, { status: 409 });
    }
    await pool.query(`delete from public.club_application_drafts where applicant_user_id = $1`, [body.userId]);
    const deleted = await pool.query(`delete from public.users where id = $1 returning id`, [body.userId]);
    return NextResponse.json({ ok: true, removed: deleted.rowCount === 1 });
  }

  const source = await fetch(new URL("/cadesca-logo.png", request.url), { cache: "no-store" });
  if (!source.ok) {
    return NextResponse.json({ error: "fixture_unavailable" }, { status: 503 });
  }

  const bytes = new Uint8Array(await source.arrayBuffer());
  const sourceHash = createHash("sha256").update(bytes).digest("hex");
  const file = new File([bytes], "cadesca-logo.png", { type: "image/png" });
  const ownerId = "production-upload-verification";
  const [ticket] = await createStudentClubUploadTickets(ownerId, [{
    kind: "logo",
    byteSize: file.size,
    contentType: "image/png",
    extension: "png"
  }]);

  try {
    const { error: uploadError } = await getSupabaseAdminClient().storage
      .from(CLUB_APPLICATION_STAGING_BUCKET)
      .uploadToSignedUrl(ticket.path, ticket.token, file, {
        cacheControl: "0",
        contentType: "image/png"
      });
    if (uploadError) throw uploadError;

    const downloaded = await downloadStudentClubStagedFile(ownerId, "logo", { path: ticket.path });
    if (!downloaded) throw new Error("staging_download_missing");
    const downloadedBytes = new Uint8Array(await downloaded.arrayBuffer());
    const downloadedHash = createHash("sha256").update(downloadedBytes).digest("hex");
    if (downloadedHash !== sourceHash) throw new Error("staging_hash_mismatch");

    await assertImageAllowed(downloaded, "club_logo");

    return NextResponse.json({
      ok: true,
      storage: {
        signedTicket: true,
        uploaded: true,
        downloaded: true,
        integrityVerified: true
      },
      moderation: { evaluated: true, allowed: true }
    });
  } catch (error) {
    console.error("[student_clubs] production_upload_verification_failed", {
      reason: error instanceof Error ? error.message : "unknown"
    });
    return NextResponse.json({ error: "verification_failed" }, { status: 503 });
  } finally {
    await removeStudentClubStagedFiles(ownerId, [ticket.path]);
  }
}
