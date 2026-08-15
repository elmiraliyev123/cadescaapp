import type { ClubRole } from "@/lib/events/types";
import { hasClubCapability } from "@/lib/clubs/permissions";

export function canManageClubEvents(roles: readonly ClubRole[]) {
  return hasClubCapability(roles, "club.events.update");
}

export function canManageClubFinance(roles: readonly ClubRole[]) {
  return hasClubCapability(roles, "club.events.manage_finance");
}

export function canScanClubEvents(roles: readonly ClubRole[]) {
  return hasClubCapability(roles, "club.events.check_in");
}
