export type SectionId = "wallet" | "menu" | "merchant" | "employer" | "travel" | "admin" | "user";

export type DemoRole = "user" | "employee" | "merchant" | "employer" | "admin";

export type NavItem = {
  label: string;
  href: string;
  icon: string;
  i18nKey: any;
};

export type PaymentType = "cmu" | "azn" | "split";

export type TransactionKind = "cmu" | "azn" | "split" | "topup";

export type Transaction = {
  id: string;
  merchant: string;
  detail: string;
  amount: string;
  kind: TransactionKind;
  icon: string;
  time: string;
};

export type Redemption = {
  id: string;
  employee: string;
  order: string;
  payment: string;
  status: "Approved" | "Pending" | "Settled";
};

export type MealCombo = {
  name: string;
  price: string;
  description: string;
};

export type ExtraItem = {
  name: string;
  price: string;
};

export type Merchant = {
  id: string;
  name: string;
  location: string;
  availability: string;
  status: "Available" | "Limited" | "Pending";
  meals: MealCombo[];
  extras: ExtraItem[];
};

export type Employee = {
  id: string;
  name: string;
  department: string;
  cmu: number;
  azn: string;
  status: "Active" | "Limited";
};

export type CountryRate = {
  code: string;
  country: string;
  city: string;
  rate: string;
  localValue: string;
  walletPreview: string;
  partners: string[];
};

export type Company = {
  id: string;
  name: string;
  employees: number;
  budget: string;
  status: string;
};

export type AdminMetric = {
  label: string;
  value: string;
  detail: string;
  icon: string;
};
