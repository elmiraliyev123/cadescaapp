import assert from "node:assert/strict";

import { evaluateClientAccess } from "../src/lib/auth/clientAccessPolicy";
import {
  derivePkceChallenge,
  isExactRedirectAllowed,
  isValidOAuthState,
  isValidPkceValue
} from "../src/lib/auth/oauthSecurity";
import { hasClubCapability } from "../src/lib/clubs/permissions";
import type { CurrentStudentContext } from "../src/lib/server/social";

const eligibleUser = {
  id: "immutable-cadesca-sub",
  status: "active",
  email: "student@ug.bilkent.edu.tr",
  emailVerified: true,
  studentStatus: "verified",
  universityId: "bilkent-id",
  universitySlug: "bilkent"
} as CurrentStudentContext;

assert.equal(evaluateClientAccess(eligibleUser, "bilkent_undergraduate").allowed, true);
assert.equal(evaluateClientAccess({ ...eligibleUser, emailVerified: false }, "bilkent_undergraduate").allowed, false);
assert.equal(evaluateClientAccess({ ...eligibleUser, studentStatus: "unverified" }, "bilkent_undergraduate").allowed, false);
assert.equal(evaluateClientAccess({ ...eligibleUser, universitySlug: "other" }, "bilkent_undergraduate").allowed, false);
assert.equal(evaluateClientAccess({ ...eligibleUser, email: "student@bilkent.edu.tr" }, "bilkent_undergraduate").allowed, false);

assert.equal(hasClubCapability(["content_manager"], "club.posts.create"), true);
assert.equal(hasClubCapability(["content_manager"], "club.events.publish"), false);
assert.equal(hasClubCapability(["event_manager"], "club.events.publish"), true);
assert.equal(hasClubCapability(["club_member"], "club.settings.manage"), false);

const callback = "https://bilmatch.com.tr/auth/cadesca/callback";
assert.equal(isExactRedirectAllowed([callback], callback), true);
assert.equal(isExactRedirectAllowed([callback], `${callback}/evil`), false);
assert.equal(isExactRedirectAllowed([callback], "https://evil.example/callback"), false);
assert.equal(isValidOAuthState("a".repeat(16)), true);
assert.equal(isValidOAuthState("short"), false);

const verifier = "c".repeat(64);
assert.equal(isValidPkceValue(verifier), true);
assert.equal(derivePkceChallenge(verifier), "UrZBnSe9f1R87juS-MF6kIuKSWAey-wWHlAw3h3-ngo");

console.log("student ecosystem authorization and capability tests passed");
