import type { ClubRole } from "@/lib/events/types";

export function canManageClubEvents(roles: readonly ClubRole[]) {
  return roles.includes("club_owner") || roles.includes("event_organizer");
}

export function canManageClubFinance(roles: readonly ClubRole[]) {
  return roles.includes("club_owner") || roles.includes("finance_manager");
}

export function canScanClubEvents(roles: readonly ClubRole[]) {
  return roles.includes("door_scanner");
}
