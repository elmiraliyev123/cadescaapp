export const CLUB_ROLES = [
  "club_owner",
  "club_admin",
  "event_manager",
  "content_manager",
  "viewer",
  "club_member",
  // Backward-compatible operational roles.
  "event_organizer",
  "finance_manager",
  "door_scanner"
] as const;

export type ClubRole = (typeof CLUB_ROLES)[number];

export const CLUB_CAPABILITIES = [
  "club.workspace.view",
  "club.posts.view",
  "club.posts.create",
  "club.posts.update",
  "club.posts.delete",
  "club.events.create",
  "club.events.view",
  "club.events.update",
  "club.events.publish",
  "club.events.cancel",
  "club.events.manage_attendees",
  "club.events.manage_finance",
  "club.events.check_in",
  "club.members.manage",
  "club.members.view",
  "club.profile.view",
  "club.profile.update",
  "club.analytics.view",
  "club.roles.manage",
  "club.settings.manage",
  "club.audit.view"
] as const;

export type ClubCapability = (typeof CLUB_CAPABILITIES)[number];

const ALL_CAPABILITIES = new Set<ClubCapability>(CLUB_CAPABILITIES);

const ROLE_CAPABILITIES: Record<ClubRole, ReadonlySet<ClubCapability>> = {
  club_owner: ALL_CAPABILITIES,
  club_admin: new Set([
    "club.workspace.view",
    "club.posts.view",
    "club.posts.create",
    "club.posts.update",
    "club.posts.delete",
    "club.events.create",
    "club.events.view",
    "club.events.update",
    "club.events.publish",
    "club.events.cancel",
    "club.events.manage_attendees",
    "club.events.manage_finance",
    "club.events.check_in",
    "club.members.manage",
    "club.members.view",
    "club.profile.view",
    "club.profile.update",
    "club.analytics.view",
    "club.roles.manage",
    "club.settings.manage",
    "club.audit.view"
  ]),
  event_manager: new Set([
    "club.workspace.view",
    "club.events.view",
    "club.events.create",
    "club.events.update",
    "club.events.publish",
    "club.events.cancel",
    "club.events.manage_attendees",
    "club.events.check_in",
    "club.analytics.view"
  ]),
  content_manager: new Set([
    "club.workspace.view",
    "club.posts.view",
    "club.posts.create",
    "club.posts.update",
    "club.posts.delete",
    "club.profile.view",
    "club.analytics.view"
  ]),
  viewer: new Set([
    "club.workspace.view",
    "club.posts.view",
    "club.events.view",
    "club.members.view",
    "club.profile.view",
    "club.analytics.view"
  ]),
  club_member: new Set([
    "club.workspace.view",
    "club.posts.view",
    "club.events.view",
    "club.profile.view"
  ]),
  event_organizer: new Set([
    "club.workspace.view",
    "club.events.view",
    "club.events.create",
    "club.events.update",
    "club.events.publish",
    "club.events.cancel",
    "club.events.manage_attendees",
    "club.events.check_in"
  ]),
  finance_manager: new Set([
    "club.workspace.view",
    "club.events.view",
    "club.events.manage_finance",
    "club.analytics.view"
  ]),
  door_scanner: new Set([
    "club.workspace.view",
    "club.events.view",
    "club.events.check_in"
  ])
};

export function isClubRole(value: string): value is ClubRole {
  return (CLUB_ROLES as readonly string[]).includes(value);
}

export function roleHasClubCapability(role: ClubRole, capability: ClubCapability) {
  return ROLE_CAPABILITIES[role].has(capability);
}

export function hasClubCapability(roles: readonly ClubRole[], capability: ClubCapability) {
  return roles.some((role) => roleHasClubCapability(role, capability));
}

export function capabilitiesForClubRoles(roles: readonly ClubRole[]) {
  return CLUB_CAPABILITIES.filter((capability) => hasClubCapability(roles, capability));
}

export function rolesWithClubCapability(capability: ClubCapability) {
  return CLUB_ROLES.filter((role) => roleHasClubCapability(role, capability));
}
