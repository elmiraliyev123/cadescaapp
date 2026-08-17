import assert from "node:assert/strict";

import { eventMutationOriginAllowed } from "../src/lib/server/eventRoute";
import {
  ClubUploadValidationError,
  MAX_CLUB_DOCUMENT_BYTES,
  MAX_CLUB_IMAGE_BYTES,
  validateClubDocumentFile,
  validateClubImageFile
} from "../src/lib/clubs/uploadValidation";
import {
  MAX_STUDENT_CLUB_JSON_BYTES,
  readLimitedStudentClubJson,
  StudentClubBodyTooLargeError
} from "../src/lib/server/studentClubRequest";
import { isStrongCadescaPassword } from "../src/lib/passwords";
import {
  StudentClubError,
  validateApprovedClubProfile
} from "../src/lib/server/studentClubs";
import {
  cadescaUsernameValidationError,
  normalizeCadescaUsername,
  validateCadescaUsername
} from "../src/lib/usernames";

async function main() {
  assert.equal(normalizeCadescaUsername("  @Student.Club_1 "), "student.club_1");
  assert.equal(validateCadescaUsername("student.club_1"), "student.club_1");
  for (const invalid of ["ab", ".student", "student.", "student..club", "Student Club", "a".repeat(31)]) {
    assert.equal(cadescaUsernameValidationError(invalid), "invalid_username", invalid);
  }
  assert.equal(cadescaUsernameValidationError("admin"), "reserved_username");

  assert.equal(isStrongCadescaPassword("Club!2026"), true);
  assert.equal(isStrongCadescaPassword("weakpassword"), false);

  const jpg = new File([Uint8Array.from([0xff, 0xd8, 0xff, 0xdb])], "logo.JPG", { type: "image/jpeg" });
  const png = new File([Uint8Array.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])], "logo.png", { type: "image/png" });
  const webp = new File([new TextEncoder().encode("RIFF0000WEBP")], "logo.webp", { type: "image/webp" });
  const heicHeader = Uint8Array.from([
    0x00, 0x00, 0x00, 0x18, 0x66, 0x74, 0x79, 0x70,
    0x68, 0x65, 0x69, 0x63, 0x00, 0x00, 0x00, 0x00,
    0x6d, 0x69, 0x66, 0x31, 0x68, 0x65, 0x69, 0x63
  ]);
  const heifHeader = Uint8Array.from([
    0x00, 0x00, 0x00, 0x18, 0x66, 0x74, 0x79, 0x70,
    0x6d, 0x69, 0x66, 0x31, 0x00, 0x00, 0x00, 0x00,
    0x6d, 0x73, 0x66, 0x31, 0x68, 0x65, 0x69, 0x63
  ]);
  const heic = new File([heicHeader], "IMG_0001.HEIC", { type: "" });
  const heif = new File([heifHeader], "IMG_0002.heif", { type: "application/octet-stream" });
  const pdf = new File([new TextEncoder().encode("%PDF-1.7\n%%EOF")], "recognition.PDF", { type: "application/pdf" });

  assert.equal((await validateClubImageFile(jpg)).extension, "jpg");
  assert.equal((await validateClubImageFile(png)).extension, "png");
  assert.equal((await validateClubImageFile(webp)).extension, "webp");
  assert.equal((await validateClubImageFile(heic)).isHeif, true);
  assert.equal((await validateClubImageFile(heif)).isHeif, true);
  assert.equal((await validateClubDocumentFile(pdf)).extension, "pdf");
  assert.equal((await validateClubDocumentFile(heic)).isHeif, true);

  await assert.rejects(
    validateClubImageFile(new File([png], "logo.txt", { type: "image/png" })),
    (error) => error instanceof ClubUploadValidationError && error.code === "unsupported_image_type"
  );
  await assert.rejects(
    validateClubImageFile(new File([png], "logo.png", { type: "image/jpeg" })),
    (error) => error instanceof ClubUploadValidationError && error.code === "unsupported_image_type"
  );
  await assert.rejects(
    validateClubImageFile(new File([new Uint8Array(MAX_CLUB_IMAGE_BYTES + 1)], "large.jpg", { type: "image/jpeg" })),
    (error) => error instanceof ClubUploadValidationError && error.code === "image_file_too_large"
  );
  await assert.rejects(
    validateClubDocumentFile(new File([new Uint8Array(MAX_CLUB_DOCUMENT_BYTES + 1)], "large.pdf", { type: "application/pdf" })),
    (error) => error instanceof ClubUploadValidationError && error.code === "document_file_too_large"
  );

  const profile = validateApprovedClubProfile({
    clubId: "5e89ba37-0b84-4db5-a23e-68d76e97a3f0",
    description: `  ${"Approved public club profile ".repeat(2)}  `,
    contactEmail: "  CLUB@University.EDU ",
    websiteUrl: "https://club.example.edu",
    instagramUrl: "https://www.instagram.com/cadesca_club",
    linkedinUrl: "https://www.linkedin.com/company/cadesca-club",
    acronym: "CSC",
    category: "Technology",
    universityPageUrl: ""
  });
  assert.equal(profile.contactEmail, "club@university.edu");
  assert.equal(profile.description.startsWith("Approved"), true);
  assert.equal(profile.universityPageUrl, null);
  assert.equal(profile.linkedinUrl, "https://www.linkedin.com/company/cadesca-club");

  assert.throws(
    () => validateApprovedClubProfile({
      clubId: "5e89ba37-0b84-4db5-a23e-68d76e97a3f0",
      description: "A valid public profile description.",
      contactEmail: "club@university.edu",
      instagramUrl: "https://attacker.example/club"
    }),
    (error) => error instanceof StudentClubError && error.code === "club_profile_invalid"
  );
  assert.throws(
    () => validateApprovedClubProfile({
      clubId: "5e89ba37-0b84-4db5-a23e-68d76e97a3f0",
      description: "A valid public profile description.",
      contactEmail: "club@university.edu",
      linkedinUrl: "https://attacker.example/company/club"
    }),
    (error) => error instanceof StudentClubError && error.code === "club_profile_invalid"
  );
  assert.throws(
    () => validateApprovedClubProfile({
      clubId: "5e89ba37-0b84-4db5-a23e-68d76e97a3f0",
      description: "A valid public profile description.",
      contactEmail: "club@university.edu",
      websiteUrl: "javascript:alert(1)"
    }),
    (error) => error instanceof StudentClubError && error.code === "club_profile_invalid"
  );

  const body = await readLimitedStudentClubJson(new Request("https://studentclub.cadesca.com/api/test", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ representativeEmail: "rep@university.edu" })
  }));
  assert.deepEqual(body, { representativeEmail: "rep@university.edu" });

  await assert.rejects(
    readLimitedStudentClubJson(new Request("https://studentclub.cadesca.com/api/test", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ value: "x".repeat(MAX_STUDENT_CLUB_JSON_BYTES) })
    })),
    StudentClubBodyTooLargeError
  );

  assert.equal(eventMutationOriginAllowed(new Request("https://studentclub.cadesca.com/api/test", {
    headers: { origin: "https://studentclub.cadesca.com" }
  })), true);
  assert.equal(eventMutationOriginAllowed(new Request("https://studentclub.cadesca.com/api/test", {
    headers: { origin: "https://studentclub.cadesca.com.attacker.example" }
  })), false);

  process.env.NEXT_PUBLIC_STUDENT_CLUB_ORIGIN = "https://club-preview.example.dev";
  assert.equal(eventMutationOriginAllowed(new Request("https://studentclub.cadesca.com/api/test", {
    headers: { origin: "https://club-preview.example.dev" }
  })), true);

  console.log("Club onboarding domain checks passed");
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
