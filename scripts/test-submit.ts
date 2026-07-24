import { config } from "dotenv";
config({ path: ".env.local" });
import { getReadyPool } from "../src/lib/server/db";
import { randomUUID } from "node:crypto";
import { normalizeEmail } from "../src/lib/server/emails";
import { normalizeClubSlug } from "../src/lib/server/studentClubs";

async function run() {
  const pool = await getReadyPool();
  const client = await pool.connect();
  try {
    const university = { id: "a1a89c97-6a1f-4ec9-bf45-d81b99a63cbf" }; // dummy
    const representative = { id: "test_user_1", email: "test@example.com" };
    const clubId = randomUUID();
    const clubName = "Test Club API";
    const clubSlug = normalizeClubSlug(clubName);
    const description = "Test club description that is long enough";
    const logoPath = "test/path.png";
    const officialEmail = "testclub@example.com";
    const contactPhone = "+905554443322";
    const additionalNote = "Test note";

    await client.query("BEGIN");

    await client.query(
      `INSERT INTO public.student_clubs (
         id, university_id, name, slug, description, logo_url,
         official_email, contact_email, website_url, instagram_url,
         university_page_url, verification_document_url, contact_phone,
         additional_note, status, created_at, updated_at
       )
       VALUES (
         $1::uuid, $2::uuid, $3, $4, $5, $6,
         $7, $8, NULL, NULL, NULL, NULL, $9, $10,
         'pending_review', now(), now()
       )`,
      [
        clubId,
        university.id,
        clubName,
        clubSlug,
        description,
        logoPath,
        officialEmail,
        normalizeEmail(representative.email),
        contactPhone,
        additionalNote
      ]
    );

    console.log("student_clubs insert successful");

    await client.query(
      `INSERT INTO public.club_memberships (
         id, club_id, user_id, role, status, invited_at, created_at, updated_at
       ) VALUES ($1::uuid, $2::uuid, $3, 'club_owner', 'invited', now(), now(), now())`,
      [randomUUID(), clubId, representative.id]
    );

    console.log("club_memberships insert successful");

    await client.query(
      `INSERT INTO public.event_audit_logs (
         university_id, club_id, actor_user_id, action, metadata, created_at
       ) VALUES ($1::uuid, $2::uuid, $3, 'club_application_submitted', $4::jsonb, now())`,
      [university.id, clubId, representative.id, JSON.stringify({ rulesAccepted: true, authentication: "cadesca" })]
    );

    console.log("event_audit_logs insert successful");

    await client.query("ROLLBACK");
    console.log("All passed");
  } catch(e) {
    console.error("SQL ERROR:", e);
  } finally {
    client.release();
    process.exit(0);
  }
}
run();
