import type { SectionId } from "@/lib/types";

export const navItems: Array<{ id: SectionId; label: string; icon: string }> = [
  { id: "wallet", label: "Wallet", icon: "account_balance_wallet" },
  { id: "menu", label: "Cadesca Menu", icon: "room_service" },
  { id: "merchant", label: "Merchant Pay", icon: "point_of_sale" },
  { id: "employer", label: "Employer", icon: "monitoring" },
  { id: "travel", label: "Travel Mode", icon: "flight_takeoff" },
  { id: "admin", label: "Admin", icon: "admin_panel_settings" }
];

export function getSectionLabel(section: SectionId) {
  return navItems.find((item) => item.id === section)?.label ?? "Cadesca";
}
