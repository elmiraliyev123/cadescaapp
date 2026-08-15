import type { CurrentStudentContext } from "@/lib/server/social";

export const CLIENT_ACCESS_POLICIES = [
  "active_user",
  "verified_student",
  "bilkent_undergraduate"
] as const;

export type ClientAccessPolicy = (typeof CLIENT_ACCESS_POLICIES)[number];
export type KnownOAuthClientId = "studentclub" | "bilmatch";

export type ClientAccessDecision = {
  allowed: boolean;
  reason: "allowed" | "authentication_required" | "account_inactive" | "verification_required" | "client_ineligible";
};

const VERIFIED_BILKENT_UNDERGRADUATE_DOMAIN = "ug.bilkent.edu.tr";

function verifiedStudent(user: CurrentStudentContext | null) {
  return Boolean(
    user &&
    user.status === "active" &&
    user.emailVerified &&
    user.studentStatus === "verified" &&
    user.universityId
  );
}

function verifiedEmailDomain(user: CurrentStudentContext) {
  const separator = user.email.lastIndexOf("@");
  return separator >= 0 ? user.email.slice(separator + 1).trim().toLowerCase() : "";
}

export function evaluateClientAccess(
  user: CurrentStudentContext | null,
  policy: ClientAccessPolicy
): ClientAccessDecision {
  if (!user) return { allowed: false, reason: "authentication_required" };
  if (user.status !== "active") return { allowed: false, reason: "account_inactive" };
  if (policy === "active_user") return { allowed: true, reason: "allowed" };
  if (!verifiedStudent(user)) return { allowed: false, reason: "verification_required" };
  if (policy === "verified_student") return { allowed: true, reason: "allowed" };

  const eligible =
    user.universitySlug === "bilkent" &&
    verifiedEmailDomain(user) === VERIFIED_BILKENT_UNDERGRADUATE_DOMAIN;

  return eligible
    ? { allowed: true, reason: "allowed" }
    : { allowed: false, reason: "client_ineligible" };
}

export function policyForKnownClient(clientId: KnownOAuthClientId): ClientAccessPolicy {
  return clientId === "bilmatch" ? "bilkent_undergraduate" : "verified_student";
}

export function canAccessClient(user: CurrentStudentContext | null, clientId: KnownOAuthClientId) {
  return evaluateClientAccess(user, policyForKnownClient(clientId));
}

