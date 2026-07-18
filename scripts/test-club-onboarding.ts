import assert from "node:assert/strict";

import { eventMutationOriginAllowed } from "../src/lib/server/eventRoute";
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

  const profile = validateApprovedClubProfile({
    clubId: "5e89ba37-0b84-4db5-a23e-68d76e97a3f0",
    description: `  ${"Approved public club profile ".repeat(2)}  `,
    contactEmail: "  CLUB@University.EDU ",
    websiteUrl: "https://club.example.edu",
    instagramUrl: "https://www.instagram.com/cadesca_club",
    universityPageUrl: ""
  });
  assert.equal(profile.contactEmail, "club@university.edu");
  assert.equal(profile.description.startsWith("Approved"), true);
  assert.equal(profile.universityPageUrl, null);

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
