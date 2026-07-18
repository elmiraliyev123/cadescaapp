import type { DemoRole, NavItem } from "@/lib/types";

export const roleHome: Record<DemoRole, string> = {
  user: "/app/user/home",
  employee: "/app/employee/wallet",
  merchant: "/app/merchant/qr",
  employer: "/app/employer/dashboard",
  admin: "/app/admin/overview"
};

export const roleLabels: Record<DemoRole, string> = {
  user: "Cadesca Account",
  employee: "Employee App",
  merchant: "Merchant Portal",
  employer: "Employer Dashboard",
  admin: "Admin Console"
};

export const roleNavItems: Record<DemoRole, NavItem[]> = {
  user: [
    { label: "Home", href: "/app/user/home", icon: "home", i18nKey: "common.home" },
    { label: "Explore", href: "/app/user/explore", icon: "search", i18nKey: "common.explore" },
    { label: "Create", href: "/app/user/create", icon: "add_box", i18nKey: "common.create" },
    { label: "Club", href: "/app/user/club", icon: "groups", i18nKey: "common.club" },
    { label: "Notifications", href: "/app/user/activity", icon: "notifications", i18nKey: "social.activityTitle" },
    { label: "Profile", href: "/app/user/profile", icon: "person", i18nKey: "common.profile" }
  ],
  employee: [
    { label: "Wallet", href: "/app/employee/wallet", icon: "account_balance_wallet", i18nKey: "common.wallet" },
    { label: "Cadesca Menu", href: "/app/employee/menu", icon: "room_service", i18nKey: "common.cadescaMenu" },
    { label: "Travel", href: "/app/employee/travel", icon: "flight_takeoff", i18nKey: "common.travel" },
    { label: "Activity", href: "/app/employee/activity", icon: "receipt_long", i18nKey: "common.activity" }
  ],
  merchant: [
    { label: "QR Scan", href: "/app/merchant/qr", icon: "qr_code_scanner", i18nKey: "merchant.qrScan" },
    { label: "Sales", href: "/app/merchant/sales", icon: "point_of_sale", i18nKey: "merchant.sales" },
    { label: "Menu", href: "/app/merchant/menu", icon: "restaurant_menu", i18nKey: "merchant.menu" },
    { label: "Restaurant Profile", href: "/app/merchant/profile", icon: "storefront", i18nKey: "merchant.restaurantProfile" },
    { label: "Reports", href: "/app/merchant/reports", icon: "bar_chart", i18nKey: "merchant.reports" }
  ],
  employer: [
    { label: "Dashboard", href: "/app/employer/dashboard", icon: "monitoring", i18nKey: "common.dashboard" },
    { label: "Employees", href: "/app/employer/employees", icon: "groups", i18nKey: "common.employees" },
    { label: "Budgets", href: "/app/employer/budgets", icon: "account_balance_wallet", i18nKey: "common.budgets" },
    { label: "Reports", href: "/app/employer/reports", icon: "download", i18nKey: "common.reports" },
    { label: "Travel Policy", href: "/app/employer/travel-policy", icon: "flight_takeoff", i18nKey: "common.travelPolicy" }
  ],
  admin: [
    { label: "Overview", href: "/app/admin/overview", icon: "admin_panel_settings", i18nKey: "admin.adminOverview" },
    { label: "Users", href: "/app/admin/users", icon: "people", i18nKey: "common.users" },
    { label: "Pending Verifications", href: "/app/admin/pending-verifications", icon: "id_card", i18nKey: "admin.pendingVerifications" },
    { label: "Wallet Passes", href: "/app/admin/wallet-passes", icon: "wallet", i18nKey: "admin.walletPasses" },
    { label: "Social", href: "/app/admin/social", icon: "forum", i18nKey: "admin.social" },
    { label: "Feed Moderation", href: "/app/admin/feed-moderation", icon: "shield_person", i18nKey: "admin.feedModeration" },
    { label: "Events", href: "/app/admin/events", icon: "event", i18nKey: "admin.events" },
    { label: "Merchant Accounts", href: "/app/admin/merchants", icon: "storefront", i18nKey: "admin.merchantAccounts" },
    { label: "Activity", href: "/app/admin/activity", icon: "receipt_long", i18nKey: "common.activity" },
    { label: "Approvals", href: "/app/admin/approvals", icon: "fact_check", i18nKey: "admin.approvals" },
    { label: "Support", href: "/app/admin/support", icon: "support_agent", i18nKey: "admin.support" },
    { label: "Extensions", href: "/app/admin/extensions", icon: "alternate_email", i18nKey: "admin.extensions" },
    { label: "Settings", href: "/app/admin/settings", icon: "settings", i18nKey: "common.settings" }
  ]
};
