import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

import {
  CLUB_APPLICATION_STAGING_BUCKET,
  createStudentClubUploadTickets,
  downloadStudentClubStagedFile,
  removeStudentClubStagedFiles
} from "../src/lib/server/studentClubUploads";
import { getSupabaseAdminClient } from "../src/lib/supabase/admin";

async function main() {
  const userId = "upload-integration-check";
  const bytes = await readFile("public/cadesca-logo.png");
  const tickets = await createStudentClubUploadTickets(userId, [{
    kind: "logo",
    byteSize: bytes.length,
    contentType: "image/png",
    extension: "png"
  }]);
  const ticket = tickets[0];
  assert.ok(ticket);

  try {
    const file = new File([bytes], "logo.png", { type: "image/png" });
    const { error } = await getSupabaseAdminClient().storage
      .from(CLUB_APPLICATION_STAGING_BUCKET)
      .uploadToSignedUrl(ticket.path, ticket.token, file, { contentType: "image/png", cacheControl: "0" });
    assert.equal(error, null);

    const downloaded = await downloadStudentClubStagedFile(userId, "logo", { path: ticket.path });
    assert.ok(downloaded);
    assert.equal(downloaded.size, bytes.length);
    assert.equal(downloaded.type, "image/png");
  } finally {
    await removeStudentClubStagedFiles(userId, [ticket.path]);
  }

  const afterCleanup = await getSupabaseAdminClient().storage
    .from(CLUB_APPLICATION_STAGING_BUCKET)
    .download(ticket.path);
  assert.ok(afterCleanup.error);
  console.log("Student Club signed upload, download, and cleanup checks passed");
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
