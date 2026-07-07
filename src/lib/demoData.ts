import type { DemoRole, PaymentType } from "@/lib/types";
import { demoModeEnabled } from "@/lib/featureFlags";

export const PRIMARY_COMPANY_ID = "company_northstar";
export const PRIMARY_EMPLOYEE_ID = "emp_aysel";
export const PRIMARY_MERCHANT_ID = "merchant_port_baku";
export const PRIMARY_USER_ID = "user_demo_ada";
export const PRIMARY_MERCHANT_USER_ID = "merchant_user_ada_cafeteria";

export type EmployeeStatus = "active" | "limited";
export type CompanyStatus = "active" | "review" | "travel_pilot";
export type MerchantStatus = "available" | "limited" | "pending" | "approved";
export type TransactionType = "cmu" | "azn" | "split" | "topup" | "adjustment";
export type SourceRole = DemoRole;

export type MenuItem = {
  id: string;
  name: string;
  description: string;
  cmuPrice?: number;
  aznPrice?: number;
  kind: "meal" | "extra";
};

export type Employee = {
  id: string;
  name: string;
  email: string;
  code: string;
  department: string;
  companyId: string;
  cmuBalance: number;
  aznBalance: number;
  status: EmployeeStatus;
};

export type Company = {
  id: string;
  name: string;
  employeeIds: string[];
  monthlyBudget: number;
  status: CompanyStatus;
  reportedEmployeeCount?: number;
};

export type Merchant = {
  id: string;
  name: string;
  city: string;
  country: string;
  status: MerchantStatus;
  availability: string;
  companyId?: string;
  menuItems: MenuItem[];
  approval?: {
    market: string;
    requiredDocuments: Array<{ name: string; submitted: boolean }>;
    menuReviewStatus: string;
  };
};

export type Transaction = {
  id: string;
  employeeId: string;
  employeeName: string;
  companyId: string;
  merchantId?: string;
  merchantName?: string;
  type: TransactionType;
  cmuAmount: number;
  aznAmount: number;
  description: string;
  createdAt: string;
  sourceRole: SourceRole;
};

export type Redemption = {
  id: string;
  employeeId: string;
  employeeName: string;
  merchantId: string;
  merchantName: string;
  itemName: string;
  paymentBreakdown: string;
  status: "approved";
  createdAt: string;
};

export type SupportNote = {
  id: string;
  text: string;
  createdAt: string;
  source: SourceRole | "system" | "support";
};

export type TravelRate = {
  code: string;
  country: string;
  city: string;
  localValue: string;
  currency: string;
  partners: string[];
};

export type ApprovedEmailExtension = {
  id: string;
  extension: string;
  universityName: string;
  status: "active" | "inactive";
  createdAt: string;
};

export type MerchantUser = {
  id: string;
  name: string;
  email: string;
  passwordOrMockPassword?: string;
  role: "merchant";
  status: "active" | "suspended" | "deleted";
  restaurantId: string;
  acceptedTermsAt?: string;
  emailVerified?: boolean;
  createdAt: string;
  updatedAt: string;
  suspendedAt?: string;
  deletedAt?: string;
};

export type User = {
  id: string;
  name: string;
  email: string;
  role: "user";
  status: "active" | "suspended" | "deleted";
  universityName?: string;
  universityDomain?: string;
  passwordOrMockPassword?: string;
  passwordHashOrMockPassword?: string;
  accountType: "user" | "employee" | "merchant" | "employer" | "admin";
  studentStatus: "not_verified" | "pending" | "verified" | "rejected";
  studentMenuAccess: boolean;
  emailVerified: boolean;
  acceptedTermsAt?: string;
  qrToken: string;
  createdAt: string;
  updatedAt: string;
  suspendedAt?: string;
  deletedAt?: string;
};

export type StudentMenuItem = {
  id: string;
  name: string;
  label: string;
};

export type StudentMenuPartner = {
  id: string;
  name: string;
  location: string;
  status: "active" | "inactive";
  menuItems: StudentMenuItem[];
};

export type RestaurantMenuItem = {
  id: string;
  restaurantId: string;
  name: string;
  description: string;
  price: number;
  currency: "AZN" | "EUR" | "TRY";
  category: string;
  label: "Student Menu" | "Cadesca Menu" | "Regular";
  priceText: string;
  payDirectly: boolean;
  studentMenuEligible: boolean;
  status: "active" | "inactive" | "deleted";
  createdAt: string;
  updatedAt: string;
};

export type Restaurant = {
  id: string;
  ownerMerchantId: string | null;
  name: string;
  bio: string;
  type: "cafeteria" | "cafe" | "restaurant";
  address: string;
  city: string;
  country: string;
  lat: number | null;
  lng: number | null;
  phone: string;
  distanceKm: number;
  status: "open" | "closed" | "pending" | "suspended" | "deleted";
  studentMenuEligible: boolean;
  cadescaPartner: boolean;
  description: string;
  openingHours: string;
  profilePasswordOrMockPassword: string;
  menuItems: RestaurantMenuItem[];
  createdAt: string;
  updatedAt: string;
  deletedAt?: string;
};

export type StudentCheckIn = {
  id: string;
  restaurantId: string;
  merchantUserId: string;
  userId: string;
  studentName: string;
  userName: string;
  userEmail: string;
  universityName: string;
  merchantId: string;
  merchantName: string;
  restaurantName: string;
  type: "student_menu_checkin";
  status: "confirmed" | "cancelled";
  amount: number;
  currency: "AZN" | "EUR" | "TRY";
  paymentMethod: "direct_at_restaurant";
  menuItemId?: string;
  menuItemName?: string;
  createdAt: string;
  cancelledAt?: string;
  dateKey: string;
  canCancelUntil: string;
};

export type QrToken = {
  token: string;
  userId: string;
  purpose: "user_verification" | "student_menu_verification" | "qr_verification";
  issuedAt: string;
  expiresAt: string;
  status: "active" | "expired" | "revoked";
};

export type Session = {
  currentUserId?: string;
  currentRole?: "user" | "merchant" | "admin";
  authenticated: boolean;
};

export type FeatureFlags = {
  demoMode: boolean;
};

export type AdminAuditLog = {
  id: string;
  adminId: string;
  action: string;
  targetType: "user" | "merchant" | "restaurant" | "extension" | "checkin";
  targetId: string;
  createdAt: string;
  details?: string;
};

export type DemoState = {
  employees: Record<string, Employee>;
  companies: Record<string, Company>;
  merchants: Record<string, Merchant>;
  transactions: Transaction[];
  redemptions: Redemption[];
  supportNotes: SupportNote[];
  travelRates: Record<string, TravelRate>;
  approvedEmailExtensions: ApprovedEmailExtension[];
  merchantUsers: MerchantUser[];
  users: User[];
  studentMenus: StudentMenuPartner[];
  restaurants: Restaurant[];
  studentCheckIns: StudentCheckIn[];
  qrTokens: QrToken[];
  adminAuditLogs: AdminAuditLog[];
  session: Session;
  featureFlags: FeatureFlags;
  selectedCountry: string;
  presentationMode: boolean;
  toast: string;
};

const northstarEmployeeIds = ["emp_aysel", "emp_murad", "emp_leyla", "emp_kamran"];

export const employees: Record<string, Employee> = {
  emp_aysel: {
    id: "emp_aysel",
    name: "Aysel M.",
    email: "aysel@northstar.example",
    code: "CMU-AZN-8421",
    department: "Product",
    companyId: PRIMARY_COMPANY_ID,
    cmuBalance: 12,
    aznBalance: 84.5,
    status: "active"
  },
  emp_murad: {
    id: "emp_murad",
    name: "Murad A.",
    email: "murad@northstar.example",
    code: "CMU-AZN-1934",
    department: "Sales",
    companyId: PRIMARY_COMPANY_ID,
    cmuBalance: 8,
    aznBalance: 42,
    status: "active"
  },
  emp_leyla: {
    id: "emp_leyla",
    name: "Leyla R.",
    email: "leyla@northstar.example",
    code: "CMU-AZN-7391",
    department: "Finance",
    companyId: PRIMARY_COMPANY_ID,
    cmuBalance: 15,
    aznBalance: 96.2,
    status: "active"
  },
  emp_kamran: {
    id: "emp_kamran",
    name: "Kamran T.",
    email: "kamran@northstar.example",
    code: "CMU-AZN-4402",
    department: "Operations",
    companyId: PRIMARY_COMPANY_ID,
    cmuBalance: 4,
    aznBalance: 20,
    status: "limited"
  }
};

export const companies: Record<string, Company> = {
  company_northstar: {
    id: PRIMARY_COMPANY_ID,
    name: "Northstar Labs",
    employeeIds: northstarEmployeeIds,
    monthlyBudget: 4850,
    status: "active"
  },
  company_crescent: {
    id: "company_crescent",
    name: "Crescent Capital",
    employeeIds: [],
    monthlyBudget: 18400,
    status: "active",
    reportedEmployeeCount: 112
  },
  company_azericloud: {
    id: "company_azericloud",
    name: "AzeriCloud",
    employeeIds: [],
    monthlyBudget: 9720,
    status: "review",
    reportedEmployeeCount: 67
  },
  company_global_ops: {
    id: "company_global_ops",
    name: "Global Field Ops",
    employeeIds: [],
    monthlyBudget: 6100,
    status: "travel_pilot",
    reportedEmployeeCount: 24
  }
};

export const merchants: Record<string, Merchant> = {
  merchant_port_baku: {
    id: PRIMARY_MERCHANT_ID,
    name: "Port Baku Cafe",
    city: "Baku",
    country: "Azerbaijan",
    status: "available",
    availability: "Cadesca Menu available",
    menuItems: [
      {
        id: "menu_port_chicken_bowl",
        name: "Chicken Bowl + Drink",
        description: "Grilled chicken, rice, seasonal salad and still water.",
        cmuPrice: 1,
        kind: "meal"
      },
      {
        id: "menu_port_salad_combo",
        name: "Salad Combo",
        description: "Market salad, soup cup and house drink.",
        cmuPrice: 1,
        kind: "meal"
      },
      { id: "extra_port_coffee", name: "Extra Coffee", description: "Barista coffee add-on.", aznPrice: 4, kind: "extra" },
      { id: "extra_port_dessert", name: "Extra Dessert", description: "Daily dessert add-on.", aznPrice: 6, kind: "extra" }
    ]
  },
  merchant_white_city: {
    id: "merchant_white_city",
    name: "White City Kitchen",
    city: "Baku",
    country: "Azerbaijan",
    status: "available",
    availability: "Cadesca Menu available",
    menuItems: [
      {
        id: "menu_white_pasta",
        name: "Pasta Set + Water",
        description: "Penne pomodoro, side greens and bottled water.",
        cmuPrice: 1,
        kind: "meal"
      },
      {
        id: "menu_white_chicken",
        name: "Chicken Bowl + Drink",
        description: "Protein bowl, bread roll and cold drink.",
        cmuPrice: 1,
        kind: "meal"
      },
      { id: "extra_white_coffee", name: "Extra Coffee", description: "Barista coffee add-on.", aznPrice: 4, kind: "extra" },
      { id: "extra_white_dessert", name: "Extra Dessert", description: "Daily dessert add-on.", aznPrice: 6, kind: "extra" }
    ]
  },
  merchant_crescent_lunch: {
    id: "merchant_crescent_lunch",
    name: "Crescent Lunch Bar",
    city: "Baku",
    country: "Azerbaijan",
    status: "limited",
    availability: "Limited CMU inventory today",
    menuItems: [
      {
        id: "menu_crescent_salad",
        name: "Salad Combo",
        description: "Greens, grains, soup and sparkling water.",
        cmuPrice: 1,
        kind: "meal"
      },
      { id: "extra_crescent_coffee", name: "Extra Coffee", description: "Barista coffee add-on.", aznPrice: 4, kind: "extra" },
      { id: "extra_crescent_dessert", name: "Extra Dessert", description: "Daily dessert add-on.", aznPrice: 6, kind: "extra" }
    ]
  },
  merchant_milan_partner: {
    id: "merchant_milan_partner",
    name: "Milan Partner Cafe",
    city: "Milan",
    country: "Italy",
    status: "available",
    availability: "Travel Mode partner",
    menuItems: [
      {
        id: "menu_milan_pasta",
        name: "Pasta Set + Water",
        description: "Local pasta set with mineral water.",
        cmuPrice: 1,
        kind: "meal"
      },
      { id: "extra_milan_coffee", name: "Extra Coffee", description: "Travel partner add-on.", aznPrice: 4, kind: "extra" }
    ]
  },
  merchant_barcelona_lunch: {
    id: "merchant_barcelona_lunch",
    name: "Barcelona Business Lunch",
    city: "Barcelona",
    country: "Spain",
    status: "available",
    availability: "Travel Mode partner",
    menuItems: [
      {
        id: "menu_barcelona_chicken",
        name: "Chicken Bowl + Drink",
        description: "Business lunch combo and still water.",
        cmuPrice: 1,
        kind: "meal"
      },
      { id: "extra_barcelona_dessert", name: "Extra Dessert", description: "Travel partner add-on.", aznPrice: 6, kind: "extra" }
    ]
  },
  merchant_white_city_branch_02: {
    id: "merchant_white_city_branch_02",
    name: "White City Kitchen Branch 02",
    city: "Baku",
    country: "Azerbaijan",
    status: "pending",
    availability: "Documents pending",
    menuItems: [],
    approval: {
      market: "Baku",
      requiredDocuments: [
        { name: "Business License", submitted: true },
        { name: "Health Certificate", submitted: true },
        { name: "Tax Registration", submitted: false }
      ],
      menuReviewStatus: "Pending review"
    }
  },
  merchant_levent_lunch: {
    id: "merchant_levent_lunch",
    name: "Levent Lunch Room",
    city: "Istanbul",
    country: "Turkey",
    status: "pending",
    availability: "Menu review",
    menuItems: [],
    approval: {
      market: "Istanbul",
      requiredDocuments: [
        { name: "Business License", submitted: true },
        { name: "Health Certificate", submitted: true },
        { name: "Tax Registration", submitted: true }
      ],
      menuReviewStatus: "Under review"
    }
  },
  merchant_central_station: {
    id: "merchant_central_station",
    name: "Central Station Lunch",
    city: "Milan",
    country: "Italy",
    status: "pending",
    availability: "Compliance review",
    menuItems: [],
    approval: {
      market: "Milan",
      requiredDocuments: [
        { name: "Business License", submitted: true },
        { name: "Health Certificate", submitted: false },
        { name: "Tax Registration", submitted: true }
      ],
      menuReviewStatus: "Approved"
    }
  }
};

export const transactions: Transaction[] = [
  {
    id: "txn_seed_1",
    employeeId: "emp_aysel",
    employeeName: "Aysel M.",
    companyId: PRIMARY_COMPANY_ID,
    merchantId: PRIMARY_MERCHANT_ID,
    merchantName: "Port Baku Cafe",
    type: "cmu",
    cmuAmount: 1,
    aznAmount: 0,
    description: "Chicken Bowl + Drink",
    createdAt: "2026-05-27T09:05:00.000Z",
    sourceRole: "employee"
  },
  {
    id: "txn_seed_2",
    employeeId: "emp_aysel",
    employeeName: "Aysel M.",
    companyId: PRIMARY_COMPANY_ID,
    merchantId: "merchant_white_city",
    merchantName: "White City Kitchen",
    type: "azn",
    cmuAmount: 0,
    aznAmount: 4,
    description: "Flat white add-on",
    createdAt: "2026-05-27T09:06:00.000Z",
    sourceRole: "employee"
  },
  {
    id: "txn_seed_3",
    employeeId: "emp_leyla",
    employeeName: "Leyla R.",
    companyId: PRIMARY_COMPANY_ID,
    merchantId: "merchant_crescent_lunch",
    merchantName: "Crescent Lunch Bar",
    type: "cmu",
    cmuAmount: 1,
    aznAmount: 0,
    description: "Salad Combo",
    createdAt: "2026-05-27T07:42:00.000Z",
    sourceRole: "merchant"
  },
  {
    id: "txn_seed_4",
    employeeId: "emp_aysel",
    employeeName: "Aysel M.",
    companyId: PRIMARY_COMPANY_ID,
    merchantName: "Bravo Market",
    type: "azn",
    cmuAmount: 0,
    aznAmount: 12.8,
    description: "Regular wallet payment",
    createdAt: "2026-05-26T10:30:00.000Z",
    sourceRole: "employee"
  },
  {
    id: "txn_seed_5",
    employeeId: "emp_aysel",
    employeeName: "Aysel M.",
    companyId: PRIMARY_COMPANY_ID,
    merchantId: PRIMARY_MERCHANT_ID,
    merchantName: "Port Baku Cafe",
    type: "split",
    cmuAmount: 1,
    aznAmount: 6,
    description: "Pasta Set + Dessert extra",
    createdAt: "2026-05-26T08:55:00.000Z",
    sourceRole: "merchant"
  },
  {
    id: "txn_seed_6",
    employeeId: "emp_murad",
    employeeName: "Murad A.",
    companyId: PRIMARY_COMPANY_ID,
    merchantId: "merchant_white_city",
    merchantName: "White City Kitchen",
    type: "cmu",
    cmuAmount: 1,
    aznAmount: 0,
    description: "Protein bowl redemption",
    createdAt: "2026-05-25T09:20:00.000Z",
    sourceRole: "merchant"
  }
];

export const redemptions: Redemption[] = [
  {
    id: "red_seed_1",
    employeeId: "emp_aysel",
    employeeName: "Aysel M.",
    merchantId: PRIMARY_MERCHANT_ID,
    merchantName: "Port Baku Cafe",
    itemName: "Chicken Bowl + Coffee",
    paymentBreakdown: "1 CMU meal + 4.00 AZN extra",
    status: "approved",
    createdAt: "2026-05-27T09:05:00.000Z"
  },
  {
    id: "red_seed_2",
    employeeId: "emp_murad",
    employeeName: "Murad A.",
    merchantId: PRIMARY_MERCHANT_ID,
    merchantName: "Port Baku Cafe",
    itemName: "Pasta Set + Water",
    paymentBreakdown: "1 CMU meal",
    status: "approved",
    createdAt: "2026-05-27T08:18:00.000Z"
  },
  {
    id: "red_seed_3",
    employeeId: "emp_leyla",
    employeeName: "Leyla R.",
    merchantId: "merchant_crescent_lunch",
    merchantName: "Crescent Lunch Bar",
    itemName: "Salad Combo",
    paymentBreakdown: "1 CMU meal",
    status: "approved",
    createdAt: "2026-05-27T07:42:00.000Z"
  }
];

export const supportNotes: SupportNote[] = [
  {
    id: "note_seed_1",
    text: "Merchant approval requested for White City Kitchen branch 02.",
    source: "support",
    createdAt: "2026-05-22T10:20:00.000Z"
  },
  {
    id: "note_seed_2",
    text: "Employer travel policy review due for Italy pilot.",
    source: "admin",
    createdAt: "2026-05-21T13:40:00.000Z"
  },
  {
    id: "note_seed_3",
    text: "Manual balance adjustment workflow ready for finance review.",
    source: "system",
    createdAt: "2026-05-20T08:15:00.000Z"
  }
];

export const travelRates: Record<string, TravelRate> = {
  AZ: {
    code: "AZ",
    country: "Azerbaijan",
    city: "Baku",
    localValue: "12 AZN",
    currency: "AZN",
    partners: ["Port Baku Cafe", "White City Kitchen", "Crescent Lunch Bar"]
  },
  IT: {
    code: "IT",
    country: "Italy",
    city: "Milan",
    localValue: "6.50 EUR",
    currency: "EUR",
    partners: ["Milan Partner Cafe", "Central Station Lunch", "Brera Office Kitchen"]
  },
  ES: {
    code: "ES",
    country: "Spain",
    city: "Barcelona",
    localValue: "6.00 EUR",
    currency: "EUR",
    partners: ["Barcelona Business Lunch", "Diagonal Cafe", "Eixample Market Table"]
  },
  TR: {
    code: "TR",
    country: "Turkey",
    city: "Istanbul",
    localValue: "220 TRY",
    currency: "TRY",
    partners: ["Levent Lunch Room", "Maslak Partner Cafe", "Galata Work Kitchen"]
  }
};

export const approvedEmailExtensions: ApprovedEmailExtension[] = [
  {
    id: "ext_edu_az",
    extension: "edu.az",
    universityName: "Azerbaijan Universities",
    status: "active",
    createdAt: "2026-05-27"
  },
  {
    id: "ext_ada",
    extension: "ada.edu.az",
    universityName: "ADA University",
    status: "active",
    createdAt: "2026-05-27"
  },
  {
    id: "ext_unec",
    extension: "unec.edu.az",
    universityName: "UNEC",
    status: "active",
    createdAt: "2026-05-27"
  },
  {
    id: "ext_bhos",
    extension: "bhos.edu.az",
    universityName: "Baku Higher Oil School",
    status: "active",
    createdAt: "2026-05-27"
  }
];

export const users: User[] = [];

export const merchantUsers: MerchantUser[] = [
  {
    id: PRIMARY_MERCHANT_USER_ID,
    name: "ADA Cafeteria Manager",
    email: "merchant@cadesca.example",
    role: "merchant",
    restaurantId: "rest_ada_cafeteria",
    status: "active",
    createdAt: "2026-05-27T08:00:00.000Z",
    updatedAt: "2026-05-27T08:00:00.000Z"
  },
  {
    id: "merchant_user_study_cafe",
    name: "Study Cafe Manager",
    email: "study@cadesca.example",
    role: "merchant",
    restaurantId: "rest_study_cafe",
    status: "active",
    createdAt: "2026-05-27T08:00:00.000Z",
    updatedAt: "2026-05-27T08:00:00.000Z"
  }
];

export const studentMenus: StudentMenuPartner[] = [
  {
    id: "student_menu_university_cafeteria",
    name: "University Cafeteria",
    location: "Main campus",
    status: "active",
    menuItems: [{ id: "student_item_doner_ayran", name: "Doner + Ayran", label: "Student Menu" }]
  },
  {
    id: "student_menu_campus_lunch_bar",
    name: "Campus Lunch Bar",
    location: "Academic block",
    status: "active",
    menuItems: [{ id: "student_item_pasta_tea", name: "Pasta + Tea", label: "Student Menu" }]
  },
  {
    id: "student_menu_study_cafe",
    name: "Study Cafe",
    location: "Library floor",
    status: "active",
    menuItems: [{ id: "student_item_chicken_water", name: "Chicken Bowl + Water", label: "Student Menu" }]
  },
  {
    id: "student_menu_nearby_kitchen",
    name: "Nearby Student Kitchen",
    location: "Near campus",
    status: "active",
    menuItems: [{ id: "student_item_sandwich_tea", name: "Sandwich + Tea", label: "Student Menu" }]
  }
];

export const restaurants: Restaurant[] = [
  {
    id: "rest_ada_cafeteria",
    ownerMerchantId: PRIMARY_MERCHANT_USER_ID,
    name: "ADA University Cafeteria",
    bio: "Student Menu available for verified students.",
    type: "cafeteria",
    address: "Ahmadbey Aghaoglu street, Baku",
    city: "Baku",
    country: "Azerbaijan",
    lat: 40.383,
    lng: 49.822,
    phone: "+994 12 555 0101",
    distanceKm: 0.2,
    status: "open",
    studentMenuEligible: true,
    cadescaPartner: true,
    description: "Student Menu available for verified students.",
    openingHours: "09:00-18:00",
    profilePasswordOrMockPassword: "cadesca-demo",
    createdAt: "2026-05-27T08:00:00.000Z",
    updatedAt: "2026-05-27T08:00:00.000Z",
    menuItems: [
      {
        id: "rest_item_ada_doner",
        restaurantId: "rest_ada_cafeteria",
        name: "Doner + Ayran",
        description: "Student lunch combo served at the cafeteria counter.",
        price: 0,
        currency: "AZN",
        category: "Lunch",
        label: "Student Menu",
        priceText: "Pay directly",
        payDirectly: true,
        studentMenuEligible: true,
        status: "active",
        createdAt: "2026-05-27T08:00:00.000Z",
        updatedAt: "2026-05-27T08:00:00.000Z"
      },
      {
        id: "rest_item_ada_soup",
        restaurantId: "rest_ada_cafeteria",
        name: "Soup + Salad",
        description: "Daily soup with a small salad.",
        price: 0,
        currency: "AZN",
        category: "Lunch",
        label: "Student Menu",
        priceText: "Pay directly",
        payDirectly: true,
        studentMenuEligible: true,
        status: "active",
        createdAt: "2026-05-27T08:00:00.000Z",
        updatedAt: "2026-05-27T08:00:00.000Z"
      }
    ]
  },
  {
    id: "rest_study_cafe",
    ownerMerchantId: "merchant_user_study_cafe",
    name: "Study Cafe",
    bio: "Cafe with verified Student Menu access.",
    type: "cafe",
    address: "Near campus",
    city: "Baku",
    country: "Azerbaijan",
    lat: 40.381,
    lng: 49.821,
    phone: "+994 12 555 0102",
    distanceKm: 0.4,
    status: "open",
    studentMenuEligible: true,
    cadescaPartner: true,
    description: "Cafe with verified Student Menu access.",
    openingHours: "08:00-21:00",
    profilePasswordOrMockPassword: "cadesca-demo",
    createdAt: "2026-05-27T08:00:00.000Z",
    updatedAt: "2026-05-27T08:00:00.000Z",
    menuItems: [
      {
        id: "rest_item_study_chicken",
        restaurantId: "rest_study_cafe",
        name: "Chicken Bowl + Water",
        description: "Warm chicken bowl with still water.",
        price: 0,
        currency: "AZN",
        category: "Lunch",
        label: "Student Menu",
        priceText: "Pay directly",
        payDirectly: true,
        studentMenuEligible: true,
        status: "active",
        createdAt: "2026-05-27T08:00:00.000Z",
        updatedAt: "2026-05-27T08:00:00.000Z"
      },
      {
        id: "rest_item_study_tea",
        restaurantId: "rest_study_cafe",
        name: "Tea",
        description: "Fresh black tea.",
        price: 1,
        currency: "AZN",
        category: "Cafe",
        label: "Regular",
        priceText: "1 AZN",
        payDirectly: true,
        studentMenuEligible: false,
        status: "active",
        createdAt: "2026-05-27T08:00:00.000Z",
        updatedAt: "2026-05-27T08:00:00.000Z"
      }
    ]
  },
  {
    id: "rest_campus_lunch_bar",
    ownerMerchantId: "merchant_user_campus_lunch",
    name: "Campus Lunch Bar",
    bio: "Campus cafeteria with Student Menu verification.",
    type: "cafeteria",
    address: "Academic block, Baku",
    city: "Baku",
    country: "Azerbaijan",
    lat: 40.382,
    lng: 49.825,
    phone: "+994 12 555 0103",
    distanceKm: 0.6,
    status: "closed",
    studentMenuEligible: true,
    cadescaPartner: true,
    description: "Campus cafeteria with Student Menu verification.",
    openingHours: "10:00-16:00",
    profilePasswordOrMockPassword: "cadesca-demo",
    createdAt: "2026-05-27T08:00:00.000Z",
    updatedAt: "2026-05-27T08:00:00.000Z",
    menuItems: [
      {
        id: "rest_item_campus_pasta",
        restaurantId: "rest_campus_lunch_bar",
        name: "Pasta + Tea",
        description: "Pasta set with tea.",
        price: 0,
        currency: "AZN",
        category: "Lunch",
        label: "Student Menu",
        priceText: "Pay directly",
        payDirectly: true,
        studentMenuEligible: true,
        status: "active",
        createdAt: "2026-05-27T08:00:00.000Z",
        updatedAt: "2026-05-27T08:00:00.000Z"
      }
    ]
  },
  {
    id: "rest_port_baku",
    ownerMerchantId: "merchant_user_port_baku",
    name: "Port Baku Cafe",
    bio: "Cadesca partner restaurant.",
    type: "restaurant",
    address: "Port Baku, Baku",
    city: "Baku",
    country: "Azerbaijan",
    lat: 40.377,
    lng: 49.852,
    phone: "+994 12 555 0104",
    distanceKm: 2.1,
    status: "open",
    studentMenuEligible: false,
    cadescaPartner: true,
    description: "Cadesca partner restaurant.",
    openingHours: "10:00-22:00",
    profilePasswordOrMockPassword: "cadesca-demo",
    createdAt: "2026-05-27T08:00:00.000Z",
    updatedAt: "2026-05-27T08:00:00.000Z",
    menuItems: [
      {
        id: "rest_item_port_chicken",
        restaurantId: "rest_port_baku",
        name: "Chicken Bowl + Drink",
        description: "Chicken bowl and drink.",
        price: 12,
        currency: "AZN",
        category: "Lunch",
        label: "Cadesca Menu",
        priceText: "12 AZN",
        payDirectly: false,
        studentMenuEligible: false,
        status: "active",
        createdAt: "2026-05-27T08:00:00.000Z",
        updatedAt: "2026-05-27T08:00:00.000Z"
      },
      {
        id: "rest_item_port_coffee",
        restaurantId: "rest_port_baku",
        name: "Extra Coffee",
        description: "Barista coffee add-on.",
        price: 4,
        currency: "AZN",
        category: "Cafe",
        label: "Regular",
        priceText: "4 AZN",
        payDirectly: false,
        studentMenuEligible: false,
        status: "active",
        createdAt: "2026-05-27T08:00:00.000Z",
        updatedAt: "2026-05-27T08:00:00.000Z"
      }
    ]
  },
  {
    id: "rest_white_city",
    ownerMerchantId: "merchant_user_white_city",
    name: "White City Kitchen",
    bio: "Cadesca partner restaurant near the business district.",
    type: "restaurant",
    address: "White City Boulevard, Baku",
    city: "Baku",
    country: "Azerbaijan",
    lat: 40.373,
    lng: 49.861,
    phone: "+994 12 555 0105",
    distanceKm: 2.8,
    status: "open",
    studentMenuEligible: false,
    cadescaPartner: true,
    description: "Cadesca partner restaurant near the business district.",
    openingHours: "09:30-21:30",
    profilePasswordOrMockPassword: "cadesca-demo",
    createdAt: "2026-05-27T08:00:00.000Z",
    updatedAt: "2026-05-27T08:00:00.000Z",
    menuItems: [
      {
        id: "rest_item_white_pasta",
        restaurantId: "rest_white_city",
        name: "Pasta Set + Water",
        description: "Pasta set with water.",
        price: 12,
        currency: "AZN",
        category: "Lunch",
        label: "Cadesca Menu",
        priceText: "12 AZN",
        payDirectly: false,
        studentMenuEligible: false,
        status: "active",
        createdAt: "2026-05-27T08:00:00.000Z",
        updatedAt: "2026-05-27T08:00:00.000Z"
      }
    ]
  }
];

export const studentCheckIns: StudentCheckIn[] = [];
export const qrTokens: QrToken[] = [];

export const initialDemoState: DemoState = {
  employees: demoModeEnabled ? employees : {},
  companies: demoModeEnabled ? companies : {},
  merchants: demoModeEnabled ? merchants : {},
  transactions: demoModeEnabled ? transactions : [],
  redemptions: demoModeEnabled ? redemptions : [],
  supportNotes: demoModeEnabled ? supportNotes : [],
  travelRates: demoModeEnabled ? travelRates : {},
  approvedEmailExtensions,
  merchantUsers: demoModeEnabled ? merchantUsers : [],
  users,
  studentMenus: demoModeEnabled ? studentMenus : [],
  restaurants: demoModeEnabled ? restaurants : [],
  studentCheckIns: [],
  qrTokens: [],
  adminAuditLogs: [],
  session: {
    authenticated: false
  },
  featureFlags: {
    demoMode: demoModeEnabled
  },
  selectedCountry: "AZ",
  presentationMode: false,
  toast: ""
};

export type MerchantConfirmPaymentPayload = {
  employeeId: string;
  merchantId: string;
  paymentType: PaymentType;
  aznAmount: number;
  itemName: string;
};

export type RegisterUserPayload = {
  name: string;
  email: string;
  password?: string;
  accountType?: "user" | "merchant";
  acceptedTermsAt?: string;
  emailVerified?: boolean;
};

export type AddEmailExtensionPayload = {
  extension: string;
  universityName: string;
};
