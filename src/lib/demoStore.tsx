"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useReducer, useState } from "react";
import type { Dispatch, ReactNode } from "react";

import type {
  AdminMetric,
  Company as LegacyCompany,
  CountryRate as LegacyCountryRate,
  Employee as LegacyEmployee,
  Merchant as LegacyMerchant,
  Redemption as LegacyRedemption,
  Transaction as LegacyTransaction
} from "@/lib/types";
import type { DemoRole, PaymentType } from "@/lib/types";
import { appUrl, demoModeEnabled, studentFeaturesEnabled } from "@/lib/appConfig";
import {
  initialDemoState,
  PRIMARY_COMPANY_ID,
  PRIMARY_EMPLOYEE_ID,
  PRIMARY_MERCHANT_ID,
  PRIMARY_MERCHANT_USER_ID
} from "@/lib/demoData";
import type {
  AddEmailExtensionPayload,
  AdminAuditLog,
  ApprovedEmailExtension,
  Company,
  DemoState,
  Employee,
  Merchant,
  MerchantConfirmPaymentPayload,
  MerchantUser,
  QrToken,
  RegisterUserPayload,
  Redemption,
  Restaurant,
  StudentCheckIn,
  StudentMenuPartner,
  SupportNote,
  Transaction,
  User,
  TravelRate
} from "@/lib/demoData";
import { formatAzn } from "@/lib/utils";

const STORAGE_KEY = "cadesca-demo-state-v3";
const STALE_ACCOUNT_STORAGE_KEYS = [
  "selectedRestaurantId",
  "selectedStudentId",
  "activeRestaurantId",
  "activeStudentId",
  "demoRole",
  "activeDemoAccount",
  "currentRestaurantId",
  "currentStudentId",
  "selectedUserId",
  "selectedMerchantUserId",
  "selectedRole",
  "currentUser",
  "currentRole"
];

export type AddEmployeePayload = {
  name: string;
  email?: string;
  department: string;
  companyId: string;
  cmuBalance: number;
  aznBalance: number;
};

export type AdminCreateUserPayload = {
  name: string;
  email: string;
  password: string;
  emailVerified: boolean;
  studentVerified: boolean;
  universityName?: string;
  universityDomain?: string;
  status: User["status"];
};

export type AdminUpdateUserPayload = Omit<AdminCreateUserPayload, "password"> & {
  userId: string;
  password?: string;
};

export type ServerAuthenticatedUserPayload = {
  id: string;
  name: string;
  email: string;
  studentStatus: User["studentStatus"];
  studentMenuAccess: boolean;
  universityName?: string | null;
  universityDomain?: string | null;
};

export type AdminMerchantAccountPayload = {
  merchantId?: string;
  restaurantId?: string;
  restaurantName: string;
  merchantOwnerName: string;
  merchantOwnerEmail: string;
  initialPassword?: string;
  bio: string;
  address: string;
  city: string;
  country: string;
  lat: number | null;
  lng: number | null;
  phone: string;
  openingHours: string;
  studentMenuEligible: boolean;
  restaurantStatus: Restaurant["status"];
};

type PostgresRestaurantPayload = {
  id: string;
  ownerMerchantId: string | null;
  name: string;
  bio?: string | null;
  address?: string | null;
  city?: string | null;
  country?: string | null;
  lat?: number | null;
  lng?: number | null;
  phone?: string | null;
  openingHours?: string | null;
  status?: Restaurant["status"] | string;
  studentMenuEligible?: boolean;
  cadescaPartner?: boolean;
  createdAt?: string;
  updatedAt?: string;
};

export type DemoAction =
  | { type: "HYDRATE"; payload: DemoState }
  | { type: "SET_SELECTED_ROLE"; payload: { role: DemoState["session"]["currentRole"] | null; userId?: string } }
  | { type: "SYNC_AUTHENTICATED_USER"; payload: ServerAuthenticatedUserPayload }
  | { type: "USER_LOGIN"; payload: { userId: string } }
  | { type: "MERCHANT_LOGIN"; payload: { email: string; password?: string } }
  | { type: "POSTGRES_MERCHANT_LOGIN"; payload: { merchantId: string; restaurantId: string; email: string; restaurant: PostgresRestaurantPayload } }
  | { type: "ADMIN_LOGIN"; payload: { email: string; password?: string; verified?: boolean } }
  | { type: "LOGOUT" }
  | { type: "SET_SELECTED_COUNTRY"; payload: { country: string } }
  | { type: "SET_PRESENTATION_MODE"; payload: { enabled: boolean } }
  | { type: "SHOW_TOAST"; payload: { message: string } }
  | { type: "CLEAR_TOAST" }
  | { type: "ADD_EMPLOYEE"; payload: AddEmployeePayload }
  | { type: "TOP_UP_EMPLOYEE_BALANCE"; payload: { employeeId: string; cmuAmount: number; aznAmount: number } }
  | { type: "REDEEM_CMU"; payload: { employeeId: string; merchantId: string; itemName: string } }
  | { type: "PAY_AZN"; payload: { employeeId: string; merchantId: string; amount: number; description: string } }
  | { type: "PAY_SPLIT"; payload: { employeeId: string; merchantId: string; cmuAmount: 1; aznAmount: number; itemName: string } }
  | { type: "MERCHANT_CONFIRM_PAYMENT"; payload: MerchantConfirmPaymentPayload }
  | { type: "ADMIN_ADJUST_BALANCE"; payload: { employeeId: string; cmuDelta: number; aznDelta: number; reason: string } }
  | { type: "ADD_COMPANY"; payload: { name: string; employeeCount: number; monthlyBudget: number } }
  | { type: "APPROVE_MERCHANT"; payload: { merchantId: string } }
  | { type: "ADD_SUPPORT_NOTE"; payload: { text: string } }
  | { type: "ADD_EMAIL_EXTENSION"; payload: AddEmailExtensionPayload }
  | { type: "TOGGLE_EMAIL_EXTENSION_STATUS"; payload: { extensionId: string } }
  | { type: "DELETE_EMAIL_EXTENSION"; payload: { extensionId: string } }
  | { type: "REGISTER_USER_ACCOUNT"; payload: RegisterUserPayload }
  | { type: "VERIFY_USER_EMAIL"; payload: { email: string } }
  | { type: "VERIFY_USER_STUDENT_EMAIL"; payload: { userId: string } }
  | { type: "REGISTER_QR_TOKEN"; payload: { userId: string; now?: number } }
  | { type: "ADD_STUDENT_MENU_PARTNER"; payload: { name: string; location: string } }
  | { type: "CONFIRM_STUDENT_MENU_CHECK_IN"; payload: { userId: string; restaurantId: string; merchantUserId: string; token?: string; menuItemId?: string } }
  | { type: "CANCEL_STUDENT_CHECK_IN"; payload: { checkInId: string; restaurantId: string } }
  | { type: "ADD_RESTAURANT_MENU_ITEM"; payload: { restaurantId: string; name: string; description: string; price: number; currency: "AZN" | "EUR" | "TRY"; category: string; studentMenuEligible: boolean } }
  | { type: "UPDATE_RESTAURANT_MENU_ITEM"; payload: { restaurantId: string; itemId: string; name: string; description: string; price: number; currency: "AZN" | "EUR" | "TRY"; category: string; studentMenuEligible: boolean; status: "active" | "inactive" } }
  | { type: "DELETE_RESTAURANT_MENU_ITEM"; payload: { restaurantId: string; itemId: string } }
  | { type: "TOGGLE_RESTAURANT_MENU_ITEM"; payload: { restaurantId: string; itemId: string } }
  | { type: "UPDATE_RESTAURANT_PROFILE"; payload: { restaurantId: string; name: string; bio: string; address: string; city: string; country: string; lat: number | null; lng: number | null; phone: string; openingHours: string; status: "open" | "closed"; studentMenuEligible: boolean; profilePasswordOrMockPassword?: string } }
  | { type: "ADMIN_CREATE_RESTAURANT"; payload: { name: string; merchantEmail: string; initialPassword: string; address: string; city: string; country: string; lat: number | null; lng: number | null; bio: string; openingHours: string; status: "open" | "closed"; studentMenuEligible: boolean } }
  | { type: "ADMIN_CREATE_USER"; payload: AdminCreateUserPayload }
  | { type: "ADMIN_UPDATE_USER"; payload: AdminUpdateUserPayload }
  | { type: "ADMIN_CREATE_MERCHANT_ACCOUNT"; payload: AdminMerchantAccountPayload & { initialPassword: string } }
  | { type: "ADMIN_UPDATE_MERCHANT_ACCOUNT"; payload: AdminMerchantAccountPayload & { merchantId: string; restaurantId: string } }
  | { type: "RESET_MERCHANT_PASSWORD"; payload: { merchantId: string; password: string } }
  | { type: "MANUAL_VERIFY_STUDENT"; payload: { userId: string; universityName: string; universityDomain: string } }
  | { type: "REMOVE_STUDENT_VERIFICATION"; payload: { userId: string } }
  | { type: "SUSPEND_USER"; payload: { userId: string } }
  | { type: "REACTIVATE_USER"; payload: { userId: string } }
  | { type: "DELETE_USER"; payload: { userId: string } }
  | { type: "SUSPEND_MERCHANT"; payload: { merchantId: string } }
  | { type: "REACTIVATE_MERCHANT"; payload: { merchantId: string } }
  | { type: "DELETE_MERCHANT"; payload: { merchantId: string } }
  | { type: "DELETE_RESTAURANT"; payload: { restaurantId: string } }
  | { type: "RESET_DEMO_DATA" };

type DemoStoreValue = {
  state: DemoState;
  dispatch: Dispatch<DemoAction>;
  hydrated: boolean;
};

const DemoStateContext = createContext<DemoStoreValue | null>(null);

export function cloneDemoState(state: DemoState = initialDemoState): DemoState {
  return JSON.parse(JSON.stringify(state)) as DemoState;
}

function makeId(prefix: string) {
  return `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}

function nowIso() {
  return new Date().toISOString();
}

function isoFromMs(value: number) {
  return new Date(value).toISOString();
}

function slugify(value: string) {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
}

function withToast(state: DemoState, toast: string): DemoState {
  return { ...state, toast };
}

function accountReadyToast(studentMenuAccess: boolean) {
  return studentMenuAccess && studentFeaturesEnabled ? "Student status verified - Student Menu access enabled." : "Cadesca account ready";
}

function isProductRole(value: string | null | undefined): value is NonNullable<DemoState["session"]["currentRole"]> {
  return value === "user" || value === "merchant" || value === "admin";
}

function clearStaleAccountStorage() {
  if (typeof window === "undefined") return;
  STALE_ACCOUNT_STORAGE_KEYS.forEach((key) => window.localStorage.removeItem(key));
}

function emptySession(): DemoState["session"] {
  return { authenticated: false };
}

function userSession(userId: string): DemoState["session"] {
  clearStaleAccountStorage();
  return { authenticated: true, currentRole: "user", currentUserId: userId };
}

function merchantSession(merchantId: string): DemoState["session"] {
  clearStaleAccountStorage();
  return { authenticated: true, currentRole: "merchant", currentUserId: merchantId };
}

function adminSession(email: string): DemoState["session"] {
  clearStaleAccountStorage();
  return { authenticated: true, currentRole: "admin", currentUserId: `admin_${hashTokenInput(email.trim().toLowerCase())}` };
}

function updateEmployee(state: DemoState, employee: Employee): DemoState {
  return {
    ...state,
    employees: {
      ...state.employees,
      [employee.id]: employee
    }
  };
}

function prependTransaction(state: DemoState, transaction: Transaction): DemoState {
  return {
    ...state,
    transactions: [transaction, ...state.transactions]
  };
}

function prependRedemption(state: DemoState, redemption: Redemption): DemoState {
  return {
    ...state,
    redemptions: [redemption, ...state.redemptions]
  };
}

function addAdminAuditLog(state: DemoState, action: string, targetType: AdminAuditLog["targetType"], targetId: string, details?: string): DemoState {
  const adminId = state.session.currentUserId || "admin_system";
  const log: AdminAuditLog = {
    id: makeId("audit"),
    adminId,
    action,
    targetType,
    targetId,
    createdAt: nowIso(),
    details
  };
  return {
    ...state,
    adminAuditLogs: [log, ...(state.adminAuditLogs || [])]
  };
}

function paymentBreakdown(paymentType: PaymentType, aznAmount: number) {
  if (paymentType === "cmu") return "1 CMU meal";
  if (paymentType === "azn") return `${aznAmount.toFixed(2)} AZN wallet`;
  return `1 CMU meal + ${aznAmount.toFixed(2)} AZN extra`;
}

function applyPayment(
  state: DemoState,
  input: {
    employeeId: string;
    merchantId: string;
    paymentType: PaymentType;
    aznAmount: number;
    itemName: string;
    sourceRole: DemoRole;
    description?: string;
    createRedemption: boolean;
  }
): DemoState {
  const employee = state.employees[input.employeeId];
  const merchant = state.merchants[input.merchantId];

  if (!employee) return withToast(state, "Employee not found");
  if (!merchant) return withToast(state, "Merchant not found");

  const cmuRequired = input.paymentType === "cmu" || input.paymentType === "split" ? 1 : 0;
  const aznRequired = input.paymentType === "azn" || input.paymentType === "split" ? input.aznAmount : 0;

  if (employee.cmuBalance < cmuRequired) return withToast(state, "Insufficient CMU balance");
  if (employee.aznBalance < aznRequired) return withToast(state, "Insufficient AZN balance");

  let nextState = updateEmployee(state, {
    ...employee,
    cmuBalance: employee.cmuBalance - cmuRequired,
    aznBalance: Number((employee.aznBalance - aznRequired).toFixed(2))
  });

  const createdAt = nowIso();
  nextState = prependTransaction(nextState, {
    id: makeId("txn"),
    employeeId: employee.id,
    employeeName: employee.name,
    companyId: employee.companyId,
    merchantId: merchant.id,
    merchantName: merchant.name,
    type: input.paymentType,
    cmuAmount: cmuRequired,
    aznAmount: aznRequired,
    description: input.description || input.itemName,
    createdAt,
    sourceRole: input.sourceRole
  });

  if (input.createRedemption) {
    nextState = prependRedemption(nextState, {
      id: makeId("red"),
      employeeId: employee.id,
      employeeName: employee.name,
      merchantId: merchant.id,
      merchantName: merchant.name,
      itemName: input.itemName,
      paymentBreakdown: paymentBreakdown(input.paymentType, aznRequired),
      status: "approved",
      createdAt
    });
  }

  const toast =
    input.paymentType === "cmu"
      ? "1 CMU redeemed"
      : input.paymentType === "azn"
        ? "AZN wallet payment approved"
        : "Split payment approved";

  return withToast(nextState, toast);
}

function createSupportNote(text: string, source: SupportNote["source"]): SupportNote {
  return {
    id: makeId("note"),
    text,
    source,
    createdAt: nowIso()
  };
}

export function normalizeEmailExtension(input: string) {
  return input
    .trim()
    .toLowerCase()
    .replace(/^@+/, "")
    .replace(/^\.+/, "");
}

function isValidEmailExtension(extension: string) {
  return /^[a-z0-9-]+(\.[a-z0-9-]+)+$/.test(extension);
}

function isValidEmail(value: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim());
}

export function isStrongPassword(value: string) {
  return value.length >= 8 && /[A-Za-z]/.test(value) && /\d/.test(value) && /[^A-Za-z0-9]/.test(value);
}

export function getEmailDomain(email: string): string | null {
  const value = email.trim().toLowerCase();
  const atIndex = value.lastIndexOf("@");
  if (atIndex < 0 || atIndex === value.length - 1) return null;
  return normalizeEmailExtension(value.slice(atIndex + 1));
}

export function matchesExtension(emailDomain: string, extension: string) {
  const normalizedDomain = normalizeEmailExtension(emailDomain);
  const normalizedExtension = normalizeEmailExtension(extension);
  return normalizedDomain === normalizedExtension || normalizedDomain.endsWith(`.${normalizedExtension}`);
}

export function getMatchedEmailExtension(state: DemoState, email: string) {
  const domain = email.includes("@") ? getEmailDomain(email) : normalizeEmailExtension(email);
  if (!domain) return null;

  const matchedExtension = [...(state.approvedEmailExtensions || [])]
    .filter((extension) => extension.status === "active")
    .sort((a, b) => b.extension.length - a.extension.length)
    .find((extension) => matchesExtension(domain, extension.extension)) || null;

  return matchedExtension;
}

export function isEmailDomainApproved(state: DemoState, email: string) {
  return Boolean(getMatchedEmailExtension(state, email));
}

export function getTodayDateKey(now: Date = new Date()) {
  return now.toISOString().slice(0, 10);
}

export function hasStudentUsedAccessToday(state: DemoState, userId: string) {
  const today = getTodayDateKey();
  return (state.studentCheckIns || []).some(
    (checkIn) => checkIn.userId === userId && checkIn.dateKey === today && checkIn.status === "confirmed"
  );
}

export const hasStudentCheckedInToday = hasStudentUsedAccessToday;

export function getLatestStudentCheckIn(state: DemoState, userId: string, onlyConfirmed = false) {
  return sortByCreatedAtDesc(
    (state.studentCheckIns || []).filter((checkIn) => checkIn.userId === userId && (!onlyConfirmed || checkIn.status === "confirmed"))
  )[0] || null;
}

export function canCancelCheckIn(checkIn: StudentCheckIn, now = Date.now()) {
  return checkIn.status === "confirmed" && now < new Date(checkIn.canCancelUntil).getTime();
}

export function canCancelRestaurantCheckIn(checkIn: StudentCheckIn, restaurantId: string, now = Date.now()) {
  return checkIn.restaurantId === restaurantId && canCancelCheckIn(checkIn, now);
}



export function getRestaurantCheckIns(state: DemoState, restaurantId: string) {
  return sortByCreatedAtDesc((state.studentCheckIns || []).filter((checkIn) => checkIn.restaurantId === restaurantId));
}

export function getRestaurantSalesSummary(state: DemoState, restaurantId: string, now = new Date()) {
  const rows = getRestaurantCheckIns(state, restaurantId);
  const today = getTodayDateKey(now);
  const startOfWeek = new Date(now);
  startOfWeek.setDate(now.getDate() - 6);
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
  const startOfYear = new Date(now.getFullYear(), 0, 1);

  const from = (date: Date) => rows.filter((row) => new Date(row.createdAt) >= date);
  const todayRows = rows.filter((row) => row.dateKey === today);
  return {
    totalToday: todayRows.length,
    confirmedToday: todayRows.filter((row) => row.status === "confirmed").length,
    cancelledToday: todayRows.filter((row) => row.status === "cancelled").length,
    weeklyTotal: from(startOfWeek).length,
    monthlyTotal: from(startOfMonth).length,
    yearlyTotal: from(startOfYear).length,
    rows
  };
}

const QR_TOKEN_TTL_MS = process.env.NODE_ENV === "development" ? 5 * 60 * 1000 : 60 * 1000;
const QR_PURPOSE: QrToken["purpose"] = "student_menu_verification";

export function getQrSlot(now = Date.now()) {
  return Math.floor(now / QR_TOKEN_TTL_MS);
}

function hashTokenInput(value: string) {
  let hash = 2166136261;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0).toString(36).padStart(7, "0");
}

export function getOpaqueQrToken(userId: string, now = Date.now()) {
  const slot = getQrSlot(now);
  return `cqt_${hashTokenInput(`${userId}:${slot}:${QR_PURPOSE}:cadesca_demo_registry`)}`;
}

function createOpaqueRandomQrToken() {
  if (typeof window !== "undefined" && window.crypto?.getRandomValues) {
    const bytes = new Uint8Array(18);
    window.crypto.getRandomValues(bytes);
    return `cqt_${Array.from(bytes, (byte) => byte.toString(36).padStart(2, "0")).join("")}`;
  }

  return `cqt_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 14)}`;
}

export function getPublicVerifyUrl(token: string) {
  return `${appUrl}/verify?t=${encodeURIComponent(token)}`;
}

export function getCadescaQrToken(userId: string, now = Date.now()) {
  return getPublicVerifyUrl(getOpaqueQrToken(userId, now));
}

export function normalizeQrToken(token: string): string {
  let normalized = String(token || "").trim();
  try {
    normalized = decodeURIComponent(normalized);
  } catch {}
  normalized = normalized.replace(/\/+$/, "");
  normalized = normalized.replace(/\s+/g, "");
  return normalized;
}

export function extractQrToken(input: string) {
  const value = String(input || "").trim();
  if (!value) return null;

  try {
    const url = new URL(value);
    const queryToken = url.searchParams.get("t");
    if (queryToken) return normalizeQrToken(queryToken);

    if (url.protocol === "cadesca:" && value.includes("verify/")) {
      return normalizeQrToken(value.split("verify/").pop() || "");
    }
  } catch {}

  if (value.includes("t=")) {
    const match = value.match(/[?&]t=([^&]+)/);
    if (match?.[1]) return normalizeQrToken(match[1]);
  }

  if (value.startsWith("cadesca://verify/")) {
    return normalizeQrToken(value.replace("cadesca://verify/", ""));
  }

  if (value.length > 5) return normalizeQrToken(value);

  return null;
}

export function createQrTokenRecord(userId: string, now = Date.now()): QrToken {
  const slot = getQrSlot(now);
  const issuedAtMs = slot * QR_TOKEN_TTL_MS;
  return {
    token: normalizeQrToken(createOpaqueRandomQrToken()),
    userId,
    purpose: QR_PURPOSE,
    issuedAt: isoFromMs(issuedAtMs),
    expiresAt: isoFromMs(issuedAtMs + QR_TOKEN_TTL_MS),
    status: "active"
  };
}

function refreshQrTokenStatuses(tokens: QrToken[] = [], now = Date.now()) {
  return tokens.map((token) => {
    const status = (token.status as string) === "used" ? "expired" : token.status;
    return status === "active" && new Date(token.expiresAt).getTime() <= now
      ? { ...token, status: "expired" as const }
      : { ...token, status: status as QrToken["status"] };
  });
}

export function getLatestActiveQrTokenForUser(state: DemoState, userId: string, now = Date.now()) {
  return sortByCreatedAtDesc(
    refreshQrTokenStatuses(state.qrTokens || [], now)
      .filter((token) => token.userId === userId && token.status === "active")
      .map((token) => ({ ...token, createdAt: token.issuedAt }))
  )[0] || null;
}

export type CadescaQrVerificationReason =
  | "invalid_format"
  | "token_not_found"
  | "token_expired"
  | "user_not_found"
  | "user_suspended"
  | "not_student_eligible"
  | "already_used_today"
  | "valid_available";

export function resolveCadescaQrToken(
  state: DemoState,
  input: string,
  now = Date.now(),
  options: { requireStudentMenuAccess?: boolean } = { requireStudentMenuAccess: true }
) {
  // TODO: In production, token verification must be server-side, signed, short-lived, and scoped to authenticated merchants.
  const extracted = extractQrToken(input);
  if (!extracted) {
    return { user: null, qrToken: null, expired: false, invalid: true, reason: "invalid_format" as const };
  }
  
  const token = normalizeQrToken(extracted);

  const qrToken = refreshQrTokenStatuses(state.qrTokens || [], now).find((item) => normalizeQrToken(item.token) === token) || null;
  
  const allowedPurposes = ["student_menu_verification", "user_verification", "qr_verification"];
  const isPurposeValid = process.env.NODE_ENV === "development" 
    ? (!qrToken?.purpose || allowedPurposes.includes(qrToken.purpose))
    : allowedPurposes.includes(qrToken?.purpose || "");

  if (!qrToken || !isPurposeValid || qrToken.status === "revoked") {
    return { user: null, qrToken, expired: false, invalid: true, reason: "token_not_found" as const };
  }

  const user = (state.users || []).find((item) => item.id === qrToken.userId) || null;

  if (qrToken.status === "expired" || new Date(qrToken.expiresAt).getTime() <= now) {
    return { user, qrToken, expired: true, invalid: true, reason: "token_expired" as const };
  }

  if (!user) {
    return { user, qrToken, expired: false, invalid: true, reason: "user_not_found" as const };
  }

  if (user.status !== "active") {
    return { user, qrToken, expired: false, invalid: true, reason: "user_suspended" as const };
  }

  if (options.requireStudentMenuAccess !== false && (user.studentStatus !== "verified" || !user.studentMenuAccess)) {
    return { user, qrToken, expired: false, invalid: true, reason: "not_student_eligible" as const };
  }

  if (options.requireStudentMenuAccess !== false && hasStudentUsedAccessToday(state, user.id)) {
    return { user, qrToken, expired: false, invalid: true, reason: "already_used_today" as const };
  }

  return {
    user,
    qrToken,
    expired: false,
    invalid: false,
    reason: "valid_available" as const
  };
}

function formatMenuPrice(price: number, currency: "AZN" | "EUR" | "TRY") {
  return price === 0 ? "Pay directly" : `${price.toFixed(price % 1 === 0 ? 0 : 2)} ${currency}`;
}

function createStudentCheckIn(user: User, restaurant: Restaurant, merchantUser: MerchantUser, menuItemId?: string): StudentCheckIn {
  const createdAtDate = new Date();
  const createdAt = createdAtDate.toISOString();
  const canCancelUntil = new Date(createdAtDate.getTime() + 60 * 60 * 1000).toISOString();
  const menuItem = menuItemId ? restaurant.menuItems.find((item) => item.id === menuItemId) : restaurant.menuItems.find((item) => item.studentMenuEligible && item.status === "active");

  return {
    id: makeId("student_checkin"),
    restaurantId: restaurant.id,
    merchantUserId: merchantUser.id,
    userId: user.id,
    studentName: user.name,
    userName: user.name,
    userEmail: user.email,
    universityName: user.universityName || "",
    merchantId: merchantUser.id,
    merchantName: restaurant.name,
    restaurantName: restaurant.name,
    type: "student_menu_checkin",
    status: "confirmed",
    amount: 0,
    currency: "AZN",
    paymentMethod: "direct_at_restaurant",
    menuItemId: menuItem?.id,
    menuItemName: menuItem?.name,
    createdAt,
    dateKey: getTodayDateKey(createdAtDate),
    canCancelUntil
  };
}

export function demoReducer(state: DemoState, action: DemoAction): DemoState {
  switch (action.type) {
    case "HYDRATE":
      return { ...action.payload, toast: "" };

    case "SET_SELECTED_ROLE":
      if (!action.payload.role) {
        clearStaleAccountStorage();
        return {
          ...state,
          session: emptySession()
        };
      }
      return {
        ...state,
        session: {
          authenticated: true,
          currentRole: action.payload.role,
          currentUserId: action.payload.userId || state.session.currentUserId
        }
      };

    case "SYNC_AUTHENTICATED_USER": {
      const existingUser = (state.users || []).find((user) => user.id === action.payload.id);
      const now = nowIso();
      const user: User = {
        ...(existingUser || {}),
        id: action.payload.id,
        name: action.payload.name,
        email: action.payload.email.trim().toLowerCase(),
        role: "user",
        status: "active",
        accountType: "user",
        studentStatus: action.payload.studentStatus,
        studentMenuAccess: action.payload.studentMenuAccess,
        emailVerified: true,
        universityName: action.payload.universityName || undefined,
        universityDomain: action.payload.universityDomain || undefined,
        qrToken: existingUser?.qrToken || getCadescaQrToken(action.payload.id),
        createdAt: existingUser?.createdAt || now,
        updatedAt: now
      };

      return {
        ...state,
        users: existingUser
          ? (state.users || []).map((item) => (item.id === user.id ? user : item))
          : [user, ...(state.users || [])],
        session: userSession(user.id),
        toast: ""
      };
    }

    case "USER_LOGIN": {
      const user = (state.users || []).find((item) => item.id === action.payload.userId);
      if (!user) return withToast(state, "login.accountNotFound");
      if (user.status === "suspended") return withToast(state, "common.accountSuspended");
      if (user.status === "deleted") return withToast(state, "common.accountUnavailable");
      if (!user.emailVerified) return withToast(state, "login.emailNotVerified");
      return {
        ...state,
        session: userSession(user.id),
        toast: ""
      };
    }

    case "MERCHANT_LOGIN": {
      const email = action.payload.email.trim().toLowerCase();
      const merchantUser = (state.merchantUsers || []).find((item) => item.email.toLowerCase() === email) || null;
      if (!merchantUser) return withToast(state, "login.invalidCredentials");
      if (merchantUser.status === "suspended") return withToast(state, "common.merchantSuspended");
      if (merchantUser.status === "deleted") return withToast(state, "common.merchantDeleted");
      
      const restaurant = (state.restaurants || []).find(r => r.id === merchantUser.restaurantId);
      if (!restaurant || restaurant.ownerMerchantId !== merchantUser.id) return withToast(state, "common.restaurantNotAssigned");
      if (restaurant && (restaurant.status === "suspended" || restaurant.status === "deleted")) {
        return withToast(state, "common.restaurantUnavailable");
      }
      const expectedPassword = merchantUser.passwordOrMockPassword || restaurant.profilePasswordOrMockPassword;
      if (expectedPassword && action.payload.password !== expectedPassword) {
        return withToast(state, "login.invalidCredentials");
      }
      return {
        ...state,
        session: merchantSession(merchantUser.id),
        toast: ""
      };
    }

    case "POSTGRES_MERCHANT_LOGIN": {
      const { merchantId, restaurantId, email, restaurant } = action.payload;
      
      let nextState = { ...state };
      
      const existingMerchant = (nextState.merchantUsers || []).find(m => m.id === merchantId);
      if (!existingMerchant) {
        nextState.merchantUsers = [
          ...(nextState.merchantUsers || []),
          {
            id: merchantId,
            email,
            name: email.split("@")[0],
            restaurantId,
            status: "active",
            role: "merchant",
            createdAt: nowIso(),
            updatedAt: nowIso()
          }
        ];
      } else {
        nextState.merchantUsers = (nextState.merchantUsers || []).map((merchantUser) =>
          merchantUser.id === merchantId
            ? {
                ...merchantUser,
                email,
                restaurantId,
                status: "active",
                updatedAt: nowIso()
              }
            : merchantUser
        );
      }

      const existingRestaurant = (nextState.restaurants || []).find(r => r.id === restaurantId);
      const syncedRestaurant: Restaurant = {
        ...(existingRestaurant || {}),
        id: restaurantId,
        ownerMerchantId: restaurant.ownerMerchantId || merchantId,
        name: restaurant.name,
        bio: restaurant.bio || "",
        type: existingRestaurant?.type || "restaurant",
        address: restaurant.address || "",
        city: restaurant.city || "",
        country: restaurant.country || "Azerbaijan",
        lat: typeof restaurant.lat === "number" && Number.isFinite(restaurant.lat) ? restaurant.lat : null,
        lng: typeof restaurant.lng === "number" && Number.isFinite(restaurant.lng) ? restaurant.lng : null,
        phone: restaurant.phone || "",
        distanceKm: existingRestaurant?.distanceKm || 0,
        status: (restaurant.status === "closed" || restaurant.status === "pending" || restaurant.status === "suspended" || restaurant.status === "deleted" || restaurant.status === "open" ? restaurant.status : "open"),
        studentMenuEligible: Boolean(restaurant.studentMenuEligible),
        cadescaPartner: restaurant.cadescaPartner !== false,
        description: restaurant.bio || "",
        openingHours: restaurant.openingHours || "",
        profilePasswordOrMockPassword: existingRestaurant?.profilePasswordOrMockPassword || "",
        menuItems: existingRestaurant?.menuItems || [],
        createdAt: restaurant.createdAt || existingRestaurant?.createdAt || nowIso(),
        updatedAt: restaurant.updatedAt || nowIso()
      };

      nextState.restaurants = existingRestaurant
        ? (nextState.restaurants || []).map((item) => (item.id === restaurantId ? syncedRestaurant : item))
        : [syncedRestaurant, ...(nextState.restaurants || [])];

      return {
        ...nextState,
        session: merchantSession(merchantId),
        toast: ""
      };
    }

    case "ADMIN_LOGIN": {
      const email = action.payload.email.trim().toLowerCase();
      if (!isValidEmail(email) || !action.payload.password?.trim()) return withToast(state, "login.invalidCredentials");
      if (!action.payload.verified && !demoModeEnabled) return withToast(state, "login.invalidCredentials");
      return {
        ...state,
        session: adminSession(email),
        toast: ""
      };
    }

    case "LOGOUT":
      clearStaleAccountStorage();
      return {
        ...state,
        session: emptySession(),
        toast: ""
      };

    case "SET_SELECTED_COUNTRY":
      return { ...state, selectedCountry: action.payload.country };

    case "SET_PRESENTATION_MODE":
      return { ...state, presentationMode: action.payload.enabled };

    case "SHOW_TOAST":
      return withToast(state, action.payload.message);

    case "CLEAR_TOAST":
      return { ...state, toast: "" };

    case "ADD_EMPLOYEE": {
      const company = state.companies[action.payload.companyId];
      if (!company) return withToast(state, "Company not found");

      const id = `emp_${slugify(action.payload.name)}_${Math.random().toString(36).slice(2, 6)}`;
      const employee: Employee = {
        id,
        name: action.payload.name,
        email: action.payload.email || `${slugify(action.payload.name)}@northstar.example`,
        code: `CMU-AZN-${Math.floor(1000 + Math.random() * 9000)}`,
        department: action.payload.department,
        companyId: company.id,
        cmuBalance: Math.max(0, action.payload.cmuBalance),
        aznBalance: Math.max(0, Number(action.payload.aznBalance.toFixed(2))),
        status: "active"
      };

      return withToast(
        {
          ...state,
          employees: {
            ...state.employees,
            [employee.id]: employee
          },
          companies: {
            ...state.companies,
            [company.id]: {
              ...company,
              employeeIds: [...company.employeeIds, employee.id],
              reportedEmployeeCount: undefined
            }
          }
        },
        `${employee.name} added`
      );
    }

    case "TOP_UP_EMPLOYEE_BALANCE": {
      const employee = state.employees[action.payload.employeeId];
      if (!employee) return withToast(state, "Employee not found");

      const cmuAmount = Math.max(0, action.payload.cmuAmount);
      const aznAmount = Math.max(0, action.payload.aznAmount);
      if (cmuAmount === 0 && aznAmount === 0) return withToast(state, "Enter a top-up amount");

      let nextState = updateEmployee(state, {
        ...employee,
        cmuBalance: employee.cmuBalance + cmuAmount,
        aznBalance: Number((employee.aznBalance + aznAmount).toFixed(2))
      });

      nextState = prependTransaction(nextState, {
        id: makeId("txn"),
        employeeId: employee.id,
        employeeName: employee.name,
        companyId: employee.companyId,
        type: "topup",
        cmuAmount,
        aznAmount,
        description: "Employer balance top-up",
        createdAt: nowIso(),
        sourceRole: "employer"
      });

      return withToast(nextState, "Balance topped up");
    }

    case "REDEEM_CMU":
      return applyPayment(state, {
        employeeId: action.payload.employeeId,
        merchantId: action.payload.merchantId,
        paymentType: "cmu",
        aznAmount: 0,
        itemName: action.payload.itemName,
        sourceRole: "employee",
        createRedemption: true
      });

    case "PAY_AZN":
      return applyPayment(state, {
        employeeId: action.payload.employeeId,
        merchantId: action.payload.merchantId,
        paymentType: "azn",
        aznAmount: action.payload.amount,
        itemName: action.payload.description,
        description: action.payload.description,
        sourceRole: "employee",
        createRedemption: false
      });

    case "PAY_SPLIT":
      return applyPayment(state, {
        employeeId: action.payload.employeeId,
        merchantId: action.payload.merchantId,
        paymentType: "split",
        aznAmount: action.payload.aznAmount,
        itemName: action.payload.itemName,
        sourceRole: "employee",
        createRedemption: true
      });

    case "MERCHANT_CONFIRM_PAYMENT":
      return applyPayment(state, {
        employeeId: action.payload.employeeId,
        merchantId: action.payload.merchantId,
        paymentType: action.payload.paymentType,
        aznAmount: action.payload.aznAmount,
        itemName: action.payload.itemName,
        sourceRole: "merchant",
        description: `Merchant approved - ${action.payload.itemName}`,
        createRedemption: true
      });

    case "ADMIN_ADJUST_BALANCE": {
      const employee = state.employees[action.payload.employeeId];
      if (!employee) return withToast(state, "Employee not found");
      if (action.payload.cmuDelta === 0 && action.payload.aznDelta === 0) return withToast(state, "Enter an adjustment amount");

      const nextEmployee: Employee = {
        ...employee,
        cmuBalance: Math.max(0, employee.cmuBalance + action.payload.cmuDelta),
        aznBalance: Math.max(0, Number((employee.aznBalance + action.payload.aznDelta).toFixed(2)))
      };

      const noteText = `Manual adjustment for ${employee.name}: ${formatAdjustment(action.payload.cmuDelta, action.payload.aznDelta)}. Reason: ${action.payload.reason}`;
      let nextState = updateEmployee(state, nextEmployee);
      nextState = prependTransaction(nextState, {
        id: makeId("txn"),
        employeeId: employee.id,
        employeeName: employee.name,
        companyId: employee.companyId,
        type: "adjustment",
        cmuAmount: action.payload.cmuDelta,
        aznAmount: action.payload.aznDelta,
        description: action.payload.reason || "Manual balance adjustment",
        createdAt: nowIso(),
        sourceRole: "admin"
      });

      return withToast(
        {
          ...nextState,
          supportNotes: [createSupportNote(noteText, "admin"), ...nextState.supportNotes]
        },
        "Balance adjusted"
      );
    }

    case "ADD_COMPANY": {
      const id = `company_${slugify(action.payload.name)}_${Math.random().toString(36).slice(2, 6)}`;
      const company: Company = {
        id,
        name: action.payload.name,
        employeeIds: [],
        monthlyBudget: Math.max(0, action.payload.monthlyBudget),
        reportedEmployeeCount: Math.max(0, action.payload.employeeCount),
        status: "active"
      };

      return withToast(
        {
          ...state,
          companies: {
            ...state.companies,
            [id]: company
          }
        },
        "Company added"
      );
    }

    case "APPROVE_MERCHANT": {
      const merchant = state.merchants[action.payload.merchantId];
      if (!merchant) return withToast(state, "Merchant not found");

      return withToast(
        {
          ...state,
          merchants: {
            ...state.merchants,
            [merchant.id]: {
              ...merchant,
              status: "available",
              availability: "Cadesca Menu available"
            }
          }
        },
        `${merchant.name} approved`
      );
    }

    case "ADD_SUPPORT_NOTE":
      if (!action.payload.text.trim()) return state;
      return withToast(
        {
          ...state,
          supportNotes: [createSupportNote(action.payload.text.trim(), "admin"), ...state.supportNotes]
        },
        "Support note added"
      );

    case "ADD_EMAIL_EXTENSION": {
      const extension = normalizeEmailExtension(action.payload.extension);
      const universityName = action.payload.universityName.trim();

      if (!isValidEmailExtension(extension)) {
        return withToast(state, "Invalid extension format");
      }

      if ((state.approvedEmailExtensions || []).some((item) => item.extension === extension)) {
        return withToast(state, "This extension already exists");
      }

      const emailExtension: ApprovedEmailExtension = {
        id: `ext_${slugify(extension)}_${Math.random().toString(36).slice(2, 6)}`,
        extension,
        universityName: universityName || extension,
        status: "active",
        createdAt: getTodayDateKey()
      };
      const nextState = {
        ...state,
        approvedEmailExtensions: [emailExtension, ...(state.approvedEmailExtensions || [])]
      };

      return withToast(
        addAdminAuditLog(nextState, "ADD_EXTENSION", "extension", emailExtension.id, emailExtension.extension),
        "Extension added"
      );
    }

    case "TOGGLE_EMAIL_EXTENSION_STATUS": {
      const target = (state.approvedEmailExtensions || []).find((extension) => extension.id === action.payload.extensionId);
      if (!target) return withToast(state, "Extension not found");
      const nextStatus: ApprovedEmailExtension["status"] = target.status === "active" ? "inactive" : "active";
      const nextState = {
        ...state,
        approvedEmailExtensions: (state.approvedEmailExtensions || []).map((extension) =>
          extension.id === action.payload.extensionId
            ? ({ ...extension, status: nextStatus } as ApprovedEmailExtension)
            : extension
        )
      };
      return withToast(addAdminAuditLog(nextState, "TOGGLE_EXTENSION", "extension", target.id, `${target.extension}:${nextStatus}`), "Extension status updated");
    }

    case "DELETE_EMAIL_EXTENSION": {
      const target = (state.approvedEmailExtensions || []).find((extension) => extension.id === action.payload.extensionId);
      if (!target) return withToast(state, "Extension not found");
      const nextState = {
        ...state,
        approvedEmailExtensions: (state.approvedEmailExtensions || []).filter((extension) => extension.id !== action.payload.extensionId)
      };
      return withToast(addAdminAuditLog(nextState, "DELETE_EXTENSION", "extension", target.id, target.extension), "Extension deleted");
    }

    case "REGISTER_USER_ACCOUNT": {
      const email = action.payload.email.trim().toLowerCase();
      const name = action.payload.name.trim();
      const password = action.payload.password || "";
      const accountType = "user";
      const matchedExtension = getMatchedEmailExtension(state, email);
      const universityDomain = matchedExtension?.extension;
      const universityName = matchedExtension?.universityName;
      const emailVerified = Boolean(action.payload.emailVerified);
      const studentStatus = matchedExtension ? emailVerified ? "verified" : "pending" : "not_verified";
      const studentMenuAccess = Boolean(matchedExtension && emailVerified);

      if (!name) {
        return withToast(state, "management.nameRequired");
      }

      if (!isValidEmail(email)) {
        return withToast(state, "management.emailRequired");
      }

      if (!isStrongPassword(password)) {
        return withToast(state, "login.passwordRequirements");
      }

      if (!action.payload.acceptedTermsAt) {
        return withToast(state, "login.termsRequired");
      }

      const existingUser = (state.users || []).find((user) => user.email.toLowerCase() === email);

      if (existingUser) {
        return withToast(state, "management.duplicateEmail");
      }

      const userId = `user_${slugify(name)}_${Math.random().toString(36).slice(2, 6)}`;
      const user: User = {
        id: userId,
        name,
        email,
        role: "user",
        universityName,
        universityDomain: matchedExtension ? universityDomain : undefined,
        passwordOrMockPassword: password,
        passwordHashOrMockPassword: password,
        accountType,
        studentStatus,
        studentMenuAccess,
        emailVerified,
        acceptedTermsAt: action.payload.acceptedTermsAt,
        qrToken: getCadescaQrToken(userId),
        status: "active",
        createdAt: nowIso(),
        updatedAt: nowIso()
      };

      if (!emailVerified) {
        return {
          ...state,
          users: [user, ...(state.users || [])],
          toast: ""
        };
      }

      return withToast(
        {
          ...state,
          users: [user, ...(state.users || [])],
          session: userSession(user.id)
        },
        studentMenuAccess ? accountReadyToast(true) : "login.studentDomainNotApproved"
      );
    }

    case "VERIFY_USER_EMAIL": {
      const email = action.payload.email.trim().toLowerCase();
      const user = (state.users || []).find((item) => item.email.toLowerCase() === email);
      if (!user) return withToast(state, "management.userNotFound");
      if (user.status === "suspended") return withToast(state, "common.accountSuspended");
      if (user.status === "deleted") return withToast(state, "common.accountUnavailable");

      const matchedExtension = getMatchedEmailExtension(state, email);
      const studentMenuAccess = Boolean(matchedExtension);
      const updatedUser: User = {
        ...user,
        emailVerified: true,
        studentStatus: matchedExtension ? "verified" : "not_verified",
        studentMenuAccess,
        universityName: matchedExtension?.universityName,
        universityDomain: matchedExtension?.extension,
        updatedAt: nowIso()
      };

      return {
        ...state,
        users: (state.users || []).map((item) => (item.id === user.id ? updatedUser : item)),
        session: userSession(user.id),
        toast: ""
      };
    }

    case "VERIFY_USER_STUDENT_EMAIL": {
      const user = (state.users || []).find((item) => item.id === action.payload.userId);
      if (!user) return withToast(state, "management.userNotFound");
      return withToast(state, "login.emailVerificationRequiresCode");
    }

    case "REGISTER_QR_TOKEN": {
      const user = (state.users || []).find((item) => item.id === action.payload.userId);
      if (!user) return state;
      if (user.status !== "active") return state;

      const now = action.payload.now || Date.now();
      const nextToken = createQrTokenRecord(user.id, now);
      const tokens = refreshQrTokenStatuses(state.qrTokens || [], now);
      const existingSlotToken = tokens.find(
        (token) => token.userId === user.id && token.issuedAt === nextToken.issuedAt && token.status === "active"
      );

      if (existingSlotToken) {
        return {
          ...state,
          qrTokens: tokens
        };
      }

      return {
        ...state,
        qrTokens: [nextToken, ...tokens].slice(0, 100)
      };
    }

    case "ADD_STUDENT_MENU_PARTNER": {
      const name = action.payload.name.trim();
      const location = action.payload.location.trim();
      if (!name) return withToast(state, "Partner name is required");

      const partner: StudentMenuPartner = {
        id: `student_menu_${slugify(name)}_${Math.random().toString(36).slice(2, 6)}`,
        name,
        location: location || "Campus",
        status: "active",
        menuItems: [{ id: makeId("student_item"), name: "Student Menu", label: "Pay directly at the cafeteria" }]
      };

      return withToast(
        {
          ...state,
          studentMenus: [partner, ...(state.studentMenus || [])]
        },
        "Student Menu partner added"
      );
    }

    case "CONFIRM_STUDENT_MENU_CHECK_IN": {
      const now = Date.now();
      const qrTokens = refreshQrTokenStatuses(state.qrTokens || [], now);
      const user = (state.users || []).find((item) => item.id === action.payload.userId);
      const merchantUser = (state.merchantUsers || []).find((item) => item.id === action.payload.merchantUserId);
      const restaurant = (state.restaurants || []).find((item) => item.id === action.payload.restaurantId);

      if (!user) return withToast(state, "User not found");
      if (!merchantUser || !restaurant) return withToast(state, "Restaurant profile not assigned yet. Contact Cadesca admin.");
      if (merchantUser.restaurantId !== restaurant.id || restaurant.ownerMerchantId !== merchantUser.id) return withToast(state, "You do not have access to this restaurant.");
      if (merchantUser.status !== "active") return withToast(state, "common.merchantSuspended");
      if (restaurant.status === "suspended" || restaurant.status === "deleted") return withToast(state, "common.restaurantUnavailable");
      if (user.status !== "active") return withToast(state, "common.accountUnavailable");
      if (user.studentStatus !== "verified" || !user.studentMenuAccess) return withToast(state, "Student Menu access is not enabled for this account.");
      if (hasStudentUsedAccessToday(state, user.id)) return withToast(state, "This student has already used Student Menu access today.");

      let nextQrTokens = qrTokens;
      if (action.payload.token) {
        const resolved = resolveCadescaQrToken({ ...state, qrTokens }, action.payload.token, now);
        if (resolved.reason === "token_expired") return withToast({ ...state, qrTokens }, "Expired QR cannot be used");
        if (!resolved.qrToken || resolved.invalid) return withToast({ ...state, qrTokens }, "Cadesca QR was not recognized");
        if (resolved.qrToken.userId !== user.id) return withToast({ ...state, qrTokens }, "Cadesca QR does not match this account.");
      }

      return withToast(
        {
          ...state,
          qrTokens: nextQrTokens,
          studentCheckIns: [createStudentCheckIn(user, restaurant, merchantUser, action.payload.menuItemId), ...(state.studentCheckIns || [])]
        },
        "Student Menu check-in confirmed"
      );
    }

    case "CANCEL_STUDENT_CHECK_IN": {
      const checkIn = (state.studentCheckIns || []).find((item) => item.id === action.payload.checkInId);
      if (!checkIn) return withToast(state, "Check-in not found");
      if (checkIn.restaurantId !== action.payload.restaurantId) return withToast(state, "You do not have access to this restaurant.");
      if (!canCancelCheckIn(checkIn)) return withToast(state, "Cancellation window expired");

      return withToast(
        {
          ...state,
          studentCheckIns: state.studentCheckIns.map((item) =>
            item.id === checkIn.id ? { ...item, status: "cancelled", cancelledAt: nowIso() } : item
          )
        },
        "Check-in cancelled. Student access restored."
      );
    }

    case "ADD_RESTAURANT_MENU_ITEM": {
      const restaurant = state.restaurants.find((item) => item.id === action.payload.restaurantId);
      if (!restaurant) return withToast(state, "Restaurant profile not assigned yet. Contact Cadesca admin.");
      if (!action.payload.name.trim()) return withToast(state, "Name is required");
      if (Number.isNaN(action.payload.price) || action.payload.price < 0) return withToast(state, "Price must be numeric and at least 0");
      const now = nowIso();
      const menuItem = {
        id: makeId("rest_item"),
        restaurantId: restaurant.id,
        name: action.payload.name.trim(),
        description: action.payload.description.trim(),
        price: action.payload.price,
        currency: action.payload.currency,
        category: action.payload.category.trim() || "Menu",
        label: action.payload.studentMenuEligible ? "Student Menu" as const : "Regular" as const,
        priceText: formatMenuPrice(action.payload.price, action.payload.currency),
        payDirectly: true,
        studentMenuEligible: action.payload.studentMenuEligible,
        status: "active" as const,
        createdAt: now,
        updatedAt: now
      };
      return withToast(
        {
          ...state,
          restaurants: state.restaurants.map((item) =>
            item.id === restaurant.id
              ? { ...item, menuItems: [menuItem, ...item.menuItems], updatedAt: now }
              : item
          )
        },
        "Menu item added"
      );
    }

    case "UPDATE_RESTAURANT_MENU_ITEM": {
      const restaurant = state.restaurants.find((item) => item.id === action.payload.restaurantId);
      if (!restaurant) return withToast(state, "Restaurant profile not assigned yet. Contact Cadesca admin.");
      if (!action.payload.name.trim()) return withToast(state, "Name is required");
      if (Number.isNaN(action.payload.price) || action.payload.price < 0) return withToast(state, "Price must be numeric and at least 0");
      const now = nowIso();
      return withToast(
        {
          ...state,
          restaurants: state.restaurants.map((item) =>
            item.id === restaurant.id
              ? {
                  ...item,
                  updatedAt: now,
                  menuItems: item.menuItems.map((menuItem) =>
                    menuItem.id === action.payload.itemId
                      ? {
                          ...menuItem,
                          name: action.payload.name.trim(),
                          description: action.payload.description.trim(),
                          price: action.payload.price,
                          currency: action.payload.currency,
                          category: action.payload.category.trim() || "Menu",
                          label: action.payload.studentMenuEligible ? "Student Menu" as const : "Regular" as const,
                          priceText: formatMenuPrice(action.payload.price, action.payload.currency),
                          studentMenuEligible: action.payload.studentMenuEligible,
                          status: action.payload.status,
                          updatedAt: now
                        }
                      : menuItem
                  )
                }
              : item
          )
        },
        "Menu item updated"
      );
    }

    case "DELETE_RESTAURANT_MENU_ITEM":
      return withToast(
        {
          ...state,
          restaurants: state.restaurants.map((restaurant) =>
            restaurant.id === action.payload.restaurantId
              ? {
                  ...restaurant,
                  menuItems: restaurant.menuItems.map((item) =>
                    item.id === action.payload.itemId ? { ...item, status: "deleted" as const, updatedAt: nowIso() } : item
                  ),
                  updatedAt: nowIso()
                }
              : restaurant
          )
        },
        "Menu item deleted"
      );

    case "TOGGLE_RESTAURANT_MENU_ITEM":
      return withToast(
        {
          ...state,
          restaurants: state.restaurants.map((restaurant) =>
            restaurant.id === action.payload.restaurantId
              ? {
                  ...restaurant,
                  updatedAt: nowIso(),
                  menuItems: restaurant.menuItems.map((item) =>
                    item.id === action.payload.itemId
                      ? {
                          ...item,
                          status: item.status === "deleted" ? "deleted" as const : item.status === "active" ? "inactive" as const : "active" as const,
                          updatedAt: nowIso()
                        }
                      : item
                  )
                }
              : restaurant
          )
        },
        "Menu item status updated"
      );

    case "UPDATE_RESTAURANT_PROFILE": {
      const restaurant = state.restaurants.find((item) => item.id === action.payload.restaurantId);
      if (!restaurant) return withToast(state, "Restaurant profile not assigned yet. Contact Cadesca admin.");
      const now = nowIso();
      return withToast(
        {
          ...state,
          restaurants: state.restaurants.map((item) =>
            item.id === restaurant.id
              ? {
                  ...item,
                  name: action.payload.name.trim() || item.name,
                  bio: action.payload.bio,
                  description: action.payload.bio,
                  address: action.payload.address,
                  city: action.payload.city,
                  country: action.payload.country,
                  lat: action.payload.lat,
                  lng: action.payload.lng,
                  phone: action.payload.phone,
                  openingHours: action.payload.openingHours,
                  status: action.payload.status,
                  studentMenuEligible: action.payload.studentMenuEligible,
                  profilePasswordOrMockPassword: action.payload.profilePasswordOrMockPassword || item.profilePasswordOrMockPassword,
                  updatedAt: now
                }
              : item
          )
        },
        "Restaurant profile updated"
      );
    }

    case "ADMIN_CREATE_RESTAURANT": {
      const restaurantId = `rest_${slugify(action.payload.name)}_${Math.random().toString(36).slice(2, 6)}`;
      const merchantEmail = action.payload.merchantEmail.trim().toLowerCase();
      if (!isStrongPassword(action.payload.initialPassword)) return withToast(state, "login.passwordRequirements");
      const existingMerchantUser = (state.merchantUsers || []).find((item) => item.email.toLowerCase() === merchantEmail);
      const merchantUserId = existingMerchantUser?.id || `merchant_user_${slugify(action.payload.merchantEmail)}_${Math.random().toString(36).slice(2, 6)}`;
      const now = nowIso();
      const merchantUser: MerchantUser = {
        ...(existingMerchantUser || {}),
        id: merchantUserId,
        name: existingMerchantUser?.name || `${action.payload.name} Manager`,
        email: existingMerchantUser?.email || action.payload.merchantEmail.toLowerCase(),
        passwordOrMockPassword: existingMerchantUser?.passwordOrMockPassword || action.payload.initialPassword,
        role: "merchant",
        restaurantId: restaurantId,
        status: existingMerchantUser?.status || "active",
        createdAt: existingMerchantUser?.createdAt || now,
        updatedAt: now
      };
      const restaurant: Restaurant = {
        id: restaurantId,
        ownerMerchantId: merchantUserId,
        name: action.payload.name,
        bio: action.payload.bio,
        type: "restaurant",
        address: action.payload.address,
        city: action.payload.city,
        country: action.payload.country,
        lat: action.payload.lat,
        lng: action.payload.lng,
        phone: "",
        distanceKm: 1.2,
        status: action.payload.status,
        studentMenuEligible: action.payload.studentMenuEligible,
        cadescaPartner: true,
        description: action.payload.bio,
        openingHours: action.payload.openingHours,
        profilePasswordOrMockPassword: action.payload.initialPassword,
        menuItems: [],
        createdAt: now,
        updatedAt: now
      };
      return withToast(
        {
          ...state,
          merchantUsers: existingMerchantUser
            ? (state.merchantUsers || []).map((item) => (item.id === existingMerchantUser.id ? merchantUser : item))
            : [merchantUser, ...(state.merchantUsers || [])],
          restaurants: [restaurant, ...(state.restaurants || [])]
        },
        "Restaurant created"
      );
    }

    case "ADMIN_CREATE_USER": {
      const email = action.payload.email.trim().toLowerCase();
      const name = action.payload.name.trim();
      const universityName = action.payload.universityName?.trim() || "";
      const universityDomain = normalizeEmailExtension(action.payload.universityDomain || "");

      if (!name) return withToast(state, "management.nameRequired");
      if (!isValidEmail(email)) return withToast(state, "management.emailRequired");
      if (!action.payload.password.trim()) return withToast(state, "management.passwordRequired");
      if (!isStrongPassword(action.payload.password)) return withToast(state, "login.passwordRequirements");
      if ((state.users || []).some((user) => user.email.toLowerCase() === email)) return withToast(state, "management.duplicateEmail");
      if (action.payload.studentVerified && !universityName) return withToast(state, "management.universityNameRequired");

      const now = nowIso();
      const userId = `user_${slugify(name)}_${Math.random().toString(36).slice(2, 6)}`;
      const user: User = {
        id: userId,
        name,
        email,
        role: "user",
        status: action.payload.status,
        universityName: action.payload.studentVerified ? universityName : undefined,
        universityDomain: action.payload.studentVerified && universityDomain ? universityDomain : undefined,
        passwordOrMockPassword: action.payload.password,
        passwordHashOrMockPassword: action.payload.password,
        accountType: "user",
        studentStatus: action.payload.studentVerified ? "verified" : "not_verified",
        studentMenuAccess: action.payload.studentVerified,
        emailVerified: action.payload.emailVerified,
        acceptedTermsAt: now,
        qrToken: getCadescaQrToken(userId),
        createdAt: now,
        updatedAt: now,
        suspendedAt: action.payload.status === "suspended" ? now : undefined,
        deletedAt: action.payload.status === "deleted" ? now : undefined
      };

      const nextState = { ...state, users: [user, ...(state.users || [])] };
      return withToast(addAdminAuditLog(nextState, "ADMIN_CREATE_USER", "user", user.id), "management.userCreated");
    }

    case "ADMIN_UPDATE_USER": {
      const email = action.payload.email.trim().toLowerCase();
      const name = action.payload.name.trim();
      const universityName = action.payload.universityName?.trim() || "";
      const universityDomain = normalizeEmailExtension(action.payload.universityDomain || "");
      const user = (state.users || []).find((item) => item.id === action.payload.userId);

      if (!user) return withToast(state, "management.userNotFound");
      if (!name) return withToast(state, "management.nameRequired");
      if (!isValidEmail(email)) return withToast(state, "management.emailRequired");
      if ((state.users || []).some((item) => item.id !== user.id && item.email.toLowerCase() === email)) return withToast(state, "management.duplicateEmail");
      if (action.payload.password?.trim() && !isStrongPassword(action.payload.password)) return withToast(state, "login.passwordRequirements");
      if (action.payload.studentVerified && !universityName) return withToast(state, "management.universityNameRequired");

      const now = nowIso();
      const updatedUser: User = {
        ...user,
        role: "user",
        name,
        email,
        passwordOrMockPassword: action.payload.password?.trim() || user.passwordOrMockPassword,
        passwordHashOrMockPassword: action.payload.password?.trim() || user.passwordHashOrMockPassword,
        status: action.payload.status,
        emailVerified: action.payload.emailVerified,
        studentStatus: action.payload.studentVerified ? "verified" : "not_verified",
        studentMenuAccess: action.payload.studentVerified,
        universityName: action.payload.studentVerified ? universityName : undefined,
        universityDomain: action.payload.studentVerified && universityDomain ? universityDomain : undefined,
        suspendedAt: action.payload.status === "suspended" ? user.suspendedAt || now : undefined,
        deletedAt: action.payload.status === "deleted" ? user.deletedAt || now : undefined,
        updatedAt: now
      };

      const nextState = {
        ...state,
        users: (state.users || []).map((item) => (item.id === user.id ? updatedUser : item))
      };
      return withToast(addAdminAuditLog(nextState, "ADMIN_UPDATE_USER", "user", user.id), "management.userUpdated");
    }

    case "ADMIN_CREATE_MERCHANT_ACCOUNT": {
      const restaurantName = action.payload.restaurantName.trim();
      const ownerName = action.payload.merchantOwnerName.trim();
      const ownerEmail = action.payload.merchantOwnerEmail.trim().toLowerCase();
      const city = action.payload.city.trim();

      if (!restaurantName) return withToast(state, "management.restaurantNameRequired");
      if (!ownerName) return withToast(state, "management.ownerNameRequired");
      if (!isValidEmail(ownerEmail)) return withToast(state, "management.emailRequired");
      if (!action.payload.initialPassword.trim()) return withToast(state, "management.passwordRequired");
      if (!isStrongPassword(action.payload.initialPassword)) return withToast(state, "login.passwordRequirements");
      if (!city) return withToast(state, "management.cityRequired");
      if ((state.merchantUsers || []).some((merchant) => merchant.email.toLowerCase() === ownerEmail)) return withToast(state, "management.duplicateMerchantEmail");

      const now = nowIso();
      const restaurantId = action.payload.restaurantId || `rest_${slugify(restaurantName)}_${Math.random().toString(36).slice(2, 6)}`;
      const merchantUserId = action.payload.merchantId || `merchant_user_${slugify(ownerEmail)}_${Math.random().toString(36).slice(2, 6)}`;
      const merchantUser: MerchantUser = {
        id: merchantUserId,
        name: ownerName,
        email: ownerEmail,
        passwordOrMockPassword: action.payload.initialPassword,
        role: "merchant",
        status: "active",
        restaurantId,
        emailVerified: true,
        acceptedTermsAt: now,
        createdAt: now,
        updatedAt: now
      };
      const restaurant: Restaurant = {
        id: restaurantId,
        ownerMerchantId: merchantUserId,
        name: restaurantName,
        bio: action.payload.bio.trim(),
        type: "restaurant",
        address: action.payload.address.trim(),
        city,
        country: action.payload.country.trim() || "Azerbaijan",
        lat: typeof action.payload.lat === "number" && Number.isFinite(action.payload.lat) ? action.payload.lat : null,
        lng: typeof action.payload.lng === "number" && Number.isFinite(action.payload.lng) ? action.payload.lng : null,
        phone: action.payload.phone.trim(),
        distanceKm: 1.2,
        status: action.payload.restaurantStatus,
        studentMenuEligible: action.payload.studentMenuEligible,
        cadescaPartner: true,
        description: action.payload.bio.trim(),
        openingHours: action.payload.openingHours.trim(),
        profilePasswordOrMockPassword: action.payload.initialPassword,
        menuItems: [],
        createdAt: now,
        updatedAt: now,
        deletedAt: action.payload.restaurantStatus === "deleted" ? now : undefined
      };

      const nextState = {
        ...state,
        merchantUsers: [merchantUser, ...(state.merchantUsers || [])],
        restaurants: [restaurant, ...(state.restaurants || [])]
      };
      return withToast(addAdminAuditLog(nextState, "ADMIN_CREATE_MERCHANT_ACCOUNT", "merchant", merchantUser.id), "management.merchantCreated");
    }

    case "ADMIN_UPDATE_MERCHANT_ACCOUNT": {
      const ownerName = action.payload.merchantOwnerName.trim();
      const ownerEmail = action.payload.merchantOwnerEmail.trim().toLowerCase();
      const restaurantName = action.payload.restaurantName.trim();
      const city = action.payload.city.trim();
      const merchantUser = (state.merchantUsers || []).find((item) => item.id === action.payload.merchantId);
      const restaurant = (state.restaurants || []).find((item) => item.id === action.payload.restaurantId);

      if (!merchantUser || !restaurant) return withToast(state, "management.merchantNotFound");
      if (!restaurantName) return withToast(state, "management.restaurantNameRequired");
      if (!ownerName) return withToast(state, "management.ownerNameRequired");
      if (!isValidEmail(ownerEmail)) return withToast(state, "management.emailRequired");
      if (!city) return withToast(state, "management.cityRequired");
      if ((state.merchantUsers || []).some((item) => item.id !== merchantUser.id && item.email.toLowerCase() === ownerEmail)) return withToast(state, "management.duplicateMerchantEmail");
      if (action.payload.initialPassword?.trim() && !isStrongPassword(action.payload.initialPassword)) return withToast(state, "login.passwordRequirements");

      const now = nowIso();
      const updatedMerchant: MerchantUser = {
        ...merchantUser,
        name: ownerName,
        email: ownerEmail,
        passwordOrMockPassword: action.payload.initialPassword?.trim() || merchantUser.passwordOrMockPassword,
        restaurantId: restaurant.id,
        updatedAt: now
      };
      const updatedRestaurant: Restaurant = {
        ...restaurant,
        ownerMerchantId: updatedMerchant.id,
        name: restaurantName,
        bio: action.payload.bio.trim(),
        description: action.payload.bio.trim(),
        address: action.payload.address.trim(),
        city,
        country: action.payload.country.trim() || restaurant.country,
        lat: typeof action.payload.lat === "number" && Number.isFinite(action.payload.lat) ? action.payload.lat : null,
        lng: typeof action.payload.lng === "number" && Number.isFinite(action.payload.lng) ? action.payload.lng : null,
        phone: action.payload.phone.trim(),
        openingHours: action.payload.openingHours.trim(),
        status: action.payload.restaurantStatus,
        studentMenuEligible: action.payload.studentMenuEligible,
        updatedAt: now,
        deletedAt: action.payload.restaurantStatus === "deleted" ? restaurant.deletedAt || now : undefined
      };

      const nextState = {
        ...state,
        merchantUsers: (state.merchantUsers || []).map((item) => (item.id === updatedMerchant.id ? updatedMerchant : item)),
        restaurants: (state.restaurants || []).map((item) => (item.id === updatedRestaurant.id ? updatedRestaurant : item))
      };
      return withToast(addAdminAuditLog(nextState, "ADMIN_UPDATE_MERCHANT_ACCOUNT", "merchant", merchantUser.id), "management.merchantUpdated");
    }

    case "RESET_MERCHANT_PASSWORD": {
      const merchantUser = (state.merchantUsers || []).find((item) => item.id === action.payload.merchantId);
      if (!merchantUser) return withToast(state, "management.merchantNotFound");
      if (!action.payload.password.trim()) return withToast(state, "management.passwordRequired");
      if (!isStrongPassword(action.payload.password)) return withToast(state, "login.passwordRequirements");

      return withToast(
        {
          ...state,
          merchantUsers: (state.merchantUsers || []).map((merchant) =>
            merchant.id === merchantUser.id ? { ...merchant, passwordOrMockPassword: action.payload.password, updatedAt: nowIso() } : merchant
          ),
          restaurants: (state.restaurants || []).map((restaurant) =>
            restaurant.id === merchantUser.restaurantId
              ? { ...restaurant, profilePasswordOrMockPassword: action.payload.password, updatedAt: nowIso() }
              : restaurant
          )
        },
        "management.passwordReset"
      );
    }

    case "MANUAL_VERIFY_STUDENT": {
      const userIndex = (state.users || []).findIndex(u => u.id === action.payload.userId);
      if (userIndex === -1) return withToast(state, "User not found");
      if (!action.payload.universityName) return withToast(state, "University name is required");
      
      const updatedUsers = [...(state.users || [])];
      updatedUsers[userIndex] = {
        ...updatedUsers[userIndex],
        studentStatus: "verified",
        studentMenuAccess: true,
        universityName: action.payload.universityName,
        universityDomain: action.payload.universityDomain,
        updatedAt: nowIso()
      };
      
      const nextState = { ...state, users: updatedUsers };
      return withToast(addAdminAuditLog(nextState, "MANUAL_VERIFY_STUDENT", "user", action.payload.userId, action.payload.universityName), "management.userVerifiedAsStudent");
    }

    case "REMOVE_STUDENT_VERIFICATION": {
      const userIndex = (state.users || []).findIndex(u => u.id === action.payload.userId);
      if (userIndex === -1) return withToast(state, "User not found");
      
      const updatedUsers = [...(state.users || [])];
      updatedUsers[userIndex] = {
        ...updatedUsers[userIndex],
        studentStatus: "not_verified",
        studentMenuAccess: false,
        updatedAt: nowIso()
      };
      
      const nextState = { ...state, users: updatedUsers };
      return withToast(addAdminAuditLog(nextState, "REMOVE_STUDENT_VERIFICATION", "user", action.payload.userId), "management.studentVerificationRemoved");
    }

    case "SUSPEND_USER": {
      const userIndex = (state.users || []).findIndex(u => u.id === action.payload.userId);
      if (userIndex === -1) return withToast(state, "User not found");
      
      const updatedUsers = [...(state.users || [])];
      updatedUsers[userIndex] = {
        ...updatedUsers[userIndex],
        status: "suspended",
        suspendedAt: nowIso(),
        updatedAt: nowIso()
      };
      
      let nextSession = state.session;
      if (state.session.currentUserId === action.payload.userId) {
        nextSession = emptySession();
      }
      
      const nextState = { ...state, users: updatedUsers, session: nextSession };
      return withToast(addAdminAuditLog(nextState, "SUSPEND_USER", "user", action.payload.userId), "management.userSuspended");
    }

    case "REACTIVATE_USER": {
      const userIndex = (state.users || []).findIndex(u => u.id === action.payload.userId);
      if (userIndex === -1) return withToast(state, "User not found");
      
      const updatedUsers = [...(state.users || [])];
      updatedUsers[userIndex] = {
        ...updatedUsers[userIndex],
        status: "active",
        suspendedAt: undefined,
        updatedAt: nowIso()
      };
      
      const nextState = { ...state, users: updatedUsers };
      return withToast(addAdminAuditLog(nextState, "REACTIVATE_USER", "user", action.payload.userId), "management.userReactivated");
    }

    case "DELETE_USER": {
      const userIndex = (state.users || []).findIndex(u => u.id === action.payload.userId);
      if (userIndex === -1) return withToast(state, "User not found");
      
      const updatedUsers = [...(state.users || [])];
      updatedUsers[userIndex] = {
        ...updatedUsers[userIndex],
        status: "deleted",
        deletedAt: nowIso(),
        updatedAt: nowIso()
      };
      
      let nextSession = state.session;
      if (state.session.currentUserId === action.payload.userId) {
        nextSession = emptySession();
      }
      
      const nextState = { ...state, users: updatedUsers, session: nextSession };
      return withToast(addAdminAuditLog(nextState, "DELETE_USER", "user", action.payload.userId), "management.userDeleted");
    }

    case "SUSPEND_MERCHANT": {
      const userIndex = (state.merchantUsers || []).findIndex(u => u.id === action.payload.merchantId);
      if (userIndex === -1) return withToast(state, "Merchant not found");
      
      const updatedUsers = [...(state.merchantUsers || [])];
      updatedUsers[userIndex] = {
        ...updatedUsers[userIndex],
        status: "suspended",
        suspendedAt: nowIso(),
        updatedAt: nowIso()
      };
      
      let nextSession = state.session;
      if (state.session.currentUserId === action.payload.merchantId) {
        nextSession = emptySession();
      }
      
      const nextState = { ...state, merchantUsers: updatedUsers, session: nextSession };
      return withToast(addAdminAuditLog(nextState, "SUSPEND_MERCHANT", "merchant", action.payload.merchantId), "management.merchantSuspended");
    }

    case "REACTIVATE_MERCHANT": {
      const userIndex = (state.merchantUsers || []).findIndex(u => u.id === action.payload.merchantId);
      if (userIndex === -1) return withToast(state, "Merchant not found");
      
      const updatedUsers = [...(state.merchantUsers || [])];
      updatedUsers[userIndex] = {
        ...updatedUsers[userIndex],
        status: "active",
        suspendedAt: undefined,
        updatedAt: nowIso()
      };
      
      const nextState = { ...state, merchantUsers: updatedUsers };
      return withToast(addAdminAuditLog(nextState, "REACTIVATE_MERCHANT", "merchant", action.payload.merchantId), "management.merchantReactivated");
    }

    case "DELETE_MERCHANT": {
      const userIndex = (state.merchantUsers || []).findIndex(u => u.id === action.payload.merchantId);
      if (userIndex === -1) return withToast(state, "Merchant not found");
      
      const updatedUsers = [...(state.merchantUsers || [])];
      updatedUsers[userIndex] = {
        ...updatedUsers[userIndex],
        status: "deleted",
        deletedAt: nowIso(),
        updatedAt: nowIso()
      };
      
      let nextSession = state.session;
      if (state.session.currentUserId === action.payload.merchantId) {
        nextSession = emptySession();
      }
      
      // Detach merchant from restaurant and suspend the restaurant until another owner is assigned.
      const restaurantId = updatedUsers[userIndex].restaurantId;
      const updatedRestaurants = [...(state.restaurants || [])].map(r => 
        r.id === restaurantId ? { ...r, ownerMerchantId: null, status: "suspended" as const, updatedAt: nowIso() } : r
      );
      
      const nextState = { ...state, merchantUsers: updatedUsers, restaurants: updatedRestaurants, session: nextSession };
      return withToast(addAdminAuditLog(nextState, "DELETE_MERCHANT", "merchant", action.payload.merchantId), "management.merchantDeleted");
    }

    case "DELETE_RESTAURANT": {
      const restIndex = (state.restaurants || []).findIndex(r => r.id === action.payload.restaurantId);
      if (restIndex === -1) return withToast(state, "Restaurant not found");
      
      const updatedRestaurants = [...(state.restaurants || [])];
      updatedRestaurants[restIndex] = {
        ...updatedRestaurants[restIndex],
        status: "deleted",
        deletedAt: nowIso(),
        updatedAt: nowIso()
      };
      
      const nextState = { ...state, restaurants: updatedRestaurants };
      return withToast(addAdminAuditLog(nextState, "DELETE_RESTAURANT", "restaurant", action.payload.restaurantId), "management.restaurantDeleted");
    }

    case "RESET_DEMO_DATA": {
      const resetState = cloneDemoState(initialDemoState);
      return {
        ...resetState,
        session: emptySession(),
        presentationMode: state.presentationMode,
        toast: "Demo data reset"
      };
    }

    default:
      return state;
  }
}

function formatAdjustment(cmuDelta: number, aznDelta: number) {
  const parts: string[] = [];
  if (cmuDelta !== 0) parts.push(`${cmuDelta > 0 ? "+" : ""}${cmuDelta} CMU`);
  if (aznDelta !== 0) parts.push(`${aznDelta > 0 ? "+" : ""}${aznDelta.toFixed(2)} AZN`);
  return parts.join(", ");
}

const productionSeedRestaurantIds = new Set([
  "rest_ada_cafeteria",
  "rest_study_cafe",
  "rest_campus_lunch_bar",
  "rest_port_baku",
  "rest_white_city"
]);

const productionSeedMerchantUserIds = new Set([
  PRIMARY_MERCHANT_USER_ID,
  "merchant_user_study_cafe",
  "merchant_user_campus_lunch",
  "merchant_user_port_baku",
  "merchant_user_white_city"
]);

const productionSeedUserIds = new Set([
  "user_demo_ada",
  "user_ali_mammadov",
  "student_ali",
  "student_aysel"
]);

const productionSeedUserEmails = new Set([
  "ali@ada.edu.az",
  "aysel@ada.edu.az",
  "student@ada.edu.az"
]);

const productionSeedUserNames = new Set([
  "Ali Mammadov",
  "Aysel"
]);

const productionSeedNames = new Set([
  "White City Kitchen",
  "Crescent Lunch Bar",
  "Bravo Market",
  "Levent Lunch Room",
  "Central Station Lunch",
  "ADA University Cafeteria",
  "Study Cafe",
  "Campus Lunch Bar",
  "Port Baku Cafe"
]);

function sanitizeProductionState(state: DemoState): DemoState {
  if (demoModeEnabled) return state;

  const users = (state.users || [])
    .filter((user) => (
      !productionSeedUserIds.has(user.id) &&
      !productionSeedUserEmails.has(user.email.toLowerCase()) &&
      !productionSeedUserNames.has(user.name)
    ))
    .map((user) => ({ ...user, role: "user" as const }));
  const merchantUsers = (state.merchantUsers || []).filter((merchant) => !productionSeedMerchantUserIds.has(merchant.id));
  const merchantUserIds = new Set(merchantUsers.map((merchant) => merchant.id));
  const restaurants = (state.restaurants || []).filter(
    (restaurant) => !productionSeedRestaurantIds.has(restaurant.id) && !productionSeedNames.has(restaurant.name)
  );
  const restaurantIds = new Set(restaurants.map((restaurant) => restaurant.id));
  const currentUserStillExists =
    !state.session.authenticated ||
    !state.session.currentRole ||
    state.session.currentRole === "admin" ||
    (state.session.currentRole === "user" &&
      users.some((user) => user.id === state.session.currentUserId && user.status === "active" && user.emailVerified)) ||
    state.session.currentRole === "merchant";
  const currentMerchant = merchantUsers.find((merchant) => merchant.id === state.session.currentUserId);
  const currentMerchantStillExists =
    state.session.currentRole !== "merchant" ||
    (Boolean(currentMerchant) &&
      currentMerchant?.status === "active" &&
      Boolean(currentMerchant.restaurantId) &&
      restaurantIds.has(currentMerchant.restaurantId));
  const sessionIsValid = currentUserStillExists && currentMerchantStillExists;

  return {
    ...state,
    employees: {},
    companies: {},
    merchants: {},
    transactions: (state.transactions || []).filter(
      (transaction) =>
        !transaction.id.startsWith("txn_seed") &&
        !productionSeedNames.has(transaction.merchantName || "") &&
        !productionSeedNames.has(transaction.description)
    ),
    redemptions: (state.redemptions || []).filter(
      (redemption) => !redemption.id.startsWith("red_seed") && !productionSeedNames.has(redemption.merchantName)
    ),
    supportNotes: (state.supportNotes || []).filter((note) => !note.id.startsWith("note_seed")),
    travelRates: {},
    users,
    merchantUsers,
    restaurants,
    studentMenus: [],
    featureFlags: {
      demoMode: false
    },
    session: sessionIsValid
      ? state.session
      : {
          authenticated: false
        }
  };
}

function loadStoredState(): DemoState {
  clearStaleAccountStorage();

  const fallback = cloneDemoState(initialDemoState);

  try {
    const stored = window.localStorage.getItem(STORAGE_KEY);

    if (!stored) {
      return sanitizeProductionState(fallback);
    }

    const parsed = JSON.parse(stored) as Omit<Partial<DemoState>, "session"> & {
      session?: DemoState["session"] & { currentRestaurantId?: string };
      students?: Array<any>;
    };
    const migratedUsers =
      parsed.users ||
      parsed.students?.map((student) => ({
        id: student.id.replace(/^student_/, "user_"),
        name: student.name,
        email: student.email,
        role: "user" as const,
        accountType: "user" as const,
        studentStatus: student.verificationStatus === "verified" ? "verified" as const : "not_verified" as const,
        universityName: student.universityName,
        universityDomain: student.universityDomain,
        studentMenuAccess: Boolean(student.studentAccess),
        emailVerified: true,
        acceptedTermsAt: student.acceptedTermsAt || nowIso(),
        qrToken: getCadescaQrToken(student.id.replace(/^student_/, "user_")),
        createdAt: student.createdAt || nowIso(),
        status: "active",
        updatedAt: nowIso()
      })) ||
      fallback.users;
    const migratedCheckIns = (parsed.studentCheckIns || fallback.studentCheckIns).map((checkIn: any) => ({
      ...checkIn,
      restaurantId: checkIn.restaurantId || checkIn.merchantId || "",
      merchantUserId: checkIn.merchantUserId || "",
      userId: checkIn.userId || checkIn.studentId?.replace(/^student_/, "user_") || "",
      studentName: checkIn.studentName || checkIn.userName || "",
      userName: checkIn.userName || checkIn.studentName || "",
      userEmail: checkIn.userEmail || "",
      restaurantName: checkIn.restaurantName || checkIn.merchantName || "",
      type: checkIn.type || "student_menu_checkin",
      amount: checkIn.amount || 0,
      currency: checkIn.currency || "AZN",
      paymentMethod: checkIn.paymentMethod || "direct_at_restaurant"
    }));
    
    const selectedRole = isProductRole(parsed.session?.currentRole) ? parsed.session?.currentRole : undefined;
    const currentUserId = parsed.session?.currentUserId || undefined;
    const authenticated = Boolean(parsed.session?.authenticated && selectedRole && (selectedRole === "admin" || currentUserId));

    return sanitizeProductionState({
      ...fallback,
      ...parsed,
      employees: parsed.employees || fallback.employees,
      companies: parsed.companies || fallback.companies,
      merchants: parsed.merchants || fallback.merchants,
      transactions: parsed.transactions || fallback.transactions,
      redemptions: parsed.redemptions || fallback.redemptions,
      supportNotes: parsed.supportNotes || fallback.supportNotes,
      travelRates: parsed.travelRates || fallback.travelRates,
      approvedEmailExtensions: parsed.approvedEmailExtensions || fallback.approvedEmailExtensions,
      merchantUsers: parsed.merchantUsers || fallback.merchantUsers,
      users: migratedUsers,
      studentMenus: parsed.studentMenus || fallback.studentMenus,
      restaurants: parsed.restaurants || fallback.restaurants,
      studentCheckIns: migratedCheckIns,
      qrTokens: parsed.qrTokens || fallback.qrTokens,
      featureFlags: parsed.featureFlags || fallback.featureFlags,
      session: {
        authenticated,
        currentRole: selectedRole,
        currentUserId: currentUserId || (authenticated && selectedRole === "admin" ? "admin_legacy" : undefined)
      },
      toast: ""
    });
  } catch {
    window.localStorage.removeItem(STORAGE_KEY);
    return sanitizeProductionState(fallback);
  }
}

function persistState(state: DemoState) {
  const persisted: DemoState = { ...state, toast: "" };
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(persisted));
}

export function DemoStateProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(demoReducer, undefined, () => cloneDemoState(initialDemoState));
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    dispatch({ type: "HYDRATE", payload: loadStoredState() });
    setHydrated(true);
  }, []);

  useEffect(() => {
    if (!hydrated) return;
    persistState(state);
  }, [hydrated, state]);

  useEffect(() => {
    if (!state.toast) return;
    const timeout = window.setTimeout(() => dispatch({ type: "CLEAR_TOAST" }), 2600);
    return () => window.clearTimeout(timeout);
  }, [state.toast]);

  const stableDispatch = useCallback((action: DemoAction) => dispatch(action), []);
  const value = useMemo(() => ({ state, dispatch: stableDispatch, hydrated }), [hydrated, stableDispatch, state]);

  return <DemoStateContext.Provider value={value}>{children}</DemoStateContext.Provider>;
}

export function useDemoState() {
  const value = useContext(DemoStateContext);
  if (!value) {
    throw new Error("useDemoState must be used inside DemoStateProvider");
  }
  return value;
}

export function getEmployeeById(state: DemoState, employeeId: string) {
  return state.employees[employeeId];
}

export function getEmployeeByCode(state: DemoState, code: string) {
  const normalized = code.trim().toUpperCase();
  return Object.values(state.employees).find((employee) => employee.code.toUpperCase() === normalized) || null;
}

export function getCompanyEmployees(state: DemoState, companyId: string) {
  const company = state.companies[companyId];
  if (!company) return [];
  return company.employeeIds.map((id) => state.employees[id]).filter(Boolean);
}

export function getEmployeeTransactions(state: DemoState, employeeId: string) {
  return sortByCreatedAtDesc(state.transactions.filter((transaction) => transaction.employeeId === employeeId));
}

export function getMerchantRedemptions(state: DemoState, merchantId: string) {
  return sortByCreatedAtDesc(state.redemptions.filter((redemption) => redemption.merchantId === merchantId));
}

export function getEmployerUsage(state: DemoState, companyId: string) {
  const transactions = state.transactions.filter((transaction) => transaction.companyId === companyId);
  return transactions.reduce(
    (usage, transaction) => {
      if (transaction.type === "cmu" || transaction.type === "split") usage.cmuUsed += transaction.cmuAmount;
      if (transaction.type === "azn" || transaction.type === "split") usage.aznUsed += transaction.aznAmount;
      return usage;
    },
    { cmuUsed: 0, aznUsed: 0, transactionCount: transactions.length }
  );
}

export function getActiveEmployeeCount(state: DemoState, companyId: string) {
  return getCompanyEmployees(state, companyId).filter((employee) => employee.status === "active").length;
}

export function getTopMerchants(state: DemoState, companyId: string) {
  const counts = new Map<string, { merchantId?: string; merchantName: string; cmu: number; azn: number; transactions: number }>();

  for (const transaction of state.transactions) {
    if (transaction.companyId !== companyId || !transaction.merchantName) continue;
    const key = transaction.merchantId || transaction.merchantName;
    const current = counts.get(key) || {
      merchantId: transaction.merchantId,
      merchantName: transaction.merchantName,
      cmu: 0,
      azn: 0,
      transactions: 0
    };
    current.cmu += transaction.type === "cmu" || transaction.type === "split" ? transaction.cmuAmount : 0;
    current.azn += transaction.type === "azn" || transaction.type === "split" ? transaction.aznAmount : 0;
    current.transactions += 1;
    counts.set(key, current);
  }

  return [...counts.values()].sort((a, b) => b.cmu + b.azn / 12 - (a.cmu + a.azn / 12)).slice(0, 5);
}

export function getCompanyUsageBars(state: DemoState, companyId: string) {
  const grouped = new Map<string, { label: string; cmu: number; azn: number; timestamp: number }>();

  for (const transaction of state.transactions) {
    if (transaction.companyId !== companyId) continue;
    const date = new Date(transaction.createdAt);
    const key = transaction.createdAt.slice(0, 10);
    const current =
      grouped.get(key) || {
        label: new Intl.DateTimeFormat("en-US", { weekday: "short" }).format(date),
        cmu: 0,
        azn: 0,
        timestamp: date.getTime()
      };
    if (transaction.type === "cmu" || transaction.type === "split") current.cmu += transaction.cmuAmount;
    if (transaction.type === "azn" || transaction.type === "split") current.azn += transaction.aznAmount;
    grouped.set(key, current);
  }

  const rows = [...grouped.values()].sort((a, b) => a.timestamp - b.timestamp).slice(-5);
  const max = Math.max(1, ...rows.map((row) => Math.max(row.cmu, row.azn / 4)));

  return rows.map((row) => ({
    label: row.label,
    cmu: Math.max(8, Math.round((row.cmu / max) * 100)),
    azn: Math.max(8, Math.round(((row.azn / 4) / max) * 100))
  }));
}

export function getAdminMetrics(state: DemoState) {
  const companies = Object.values(state.companies);
  const employees = Object.values(state.employees);
  const merchants = state.merchantUsers || [];
  const activityCount = (state.studentCheckIns || []).length + (state.adminAuditLogs || []).length;
  return {
    companies: companies.length,
    employees: employees.length,
    merchants: merchants.length,
    activeMerchants: merchants.filter((merchant) => merchant.status === "active").length,
    pendingMerchantApprovals: getPendingMerchantApprovals(state).length,
    transactions: activityCount,
    supportNotes: state.supportNotes.length
  };
}

export function getMerchantDailyTotals(state: DemoState, merchantId: string) {
  const today = new Date().toISOString().slice(0, 10);
  const transactions = state.transactions.filter((transaction) => transaction.merchantId === merchantId && transaction.createdAt.slice(0, 10) === today);

  return transactions.reduce(
    (totals, transaction) => {
      if (transaction.type === "cmu" || transaction.type === "split") totals.cmu += transaction.cmuAmount;
      if (transaction.type === "azn" || transaction.type === "split") totals.azn += transaction.aznAmount;
      return totals;
    },
    { cmu: 0, azn: 0 }
  );
}

export function getTravelRates(state: DemoState) {
  return Object.values(state.travelRates);
}

export function getMenuMerchants(state: DemoState) {
  return Object.values(state.merchants).filter((merchant) => merchant.menuItems.length > 0 && merchant.status !== "pending");
}

export function getNearbyRestaurants(state: DemoState): Restaurant[] {
  return [...(state.restaurants || [])]
    .filter((restaurant) => restaurant.cadescaPartner && restaurant.status === "open")
    .map((restaurant) => ({
      ...restaurant,
      menuItems: (restaurant.menuItems || []).filter((item) => item.status === "active")
    }))
    .sort((a, b) => a.distanceKm - b.distanceKm);
}

export function getPendingMerchantApprovals(state: DemoState) {
  return Object.values(state.merchants).filter((merchant) => merchant.status === "pending" && merchant.approval);
}

export function getCurrentUser(state: DemoState) {
  if (state.session?.currentRole === "user" && state.session?.currentUserId) {
    const selectedUser = (state.users || []).find((user) => user.id === state.session.currentUserId);
    if (selectedUser) return selectedUser;
  }
  return null;
}

export function getCurrentSession(state: DemoState) {
  return state.session;
}

export function getCurrentAdmin(state: DemoState) {
  if (state.session?.currentRole === "admin") {
    return { id: state.session.currentUserId || "admin", role: "admin" as const };
  }
  return null;
}

export function getCurrentMerchant(state: DemoState) {
  if (state.session?.currentRole === "merchant" && state.session?.currentUserId) {
    return (state.merchantUsers || []).find((user) => user.id === state.session.currentUserId) || null;
  }
  return null;
}

export function getCurrentMerchantRestaurant(state: DemoState) {
  const merchant = getCurrentMerchant(state);
  if (merchant?.restaurantId) {
    return (state.restaurants || []).find((restaurant) => restaurant.id === merchant.restaurantId) || null;
  }
  return null;
}

export function getCurrentUserQrTokens(state: DemoState) {
  const currentUser = getCurrentUser(state);
  if (!currentUser) return [];
  return (state.qrTokens || []).filter((token) => token.userId === currentUser.id);
}

export function getCurrentUserCheckIns(state: DemoState) {
  const currentUser = getCurrentUser(state);
  if (!currentUser) return [];
  return sortByCreatedAtDesc((state.studentCheckIns || []).filter((checkIn) => checkIn.userId === currentUser.id));
}

export function getCurrentRestaurantSales(state: DemoState) {
  const currentRestaurant = getCurrentMerchantRestaurant(state);
  if (!currentRestaurant) return [];
  return sortByCreatedAtDesc((state.studentCheckIns || []).filter((checkIn) => checkIn.restaurantId === currentRestaurant.id));
}

export const getCurrentRestaurantCheckIns = getCurrentRestaurantSales;

export function getCurrentRestaurantMenuItems(state: DemoState) {
  const currentRestaurant = getCurrentMerchantRestaurant(state);
  if (!currentRestaurant) return [];
  return (currentRestaurant.menuItems || []).filter((item) => item.status !== "deleted");
}

export const getVisibleRestaurantsForUser = getNearbyRestaurants;

export function getActiveApprovedExtensions(state: DemoState) {
  return (state.approvedEmailExtensions || []).filter((extension) => extension.status === "active");
}

export function getCurrentRestaurantProfile(state: DemoState) {
  return getCurrentMerchantRestaurant(state);
}

export function getVerifiedStudentUsers(state: DemoState) {
  return (state.users || []).filter((user) => user.studentStatus === "verified" && user.studentMenuAccess);
}

export function getStudentCheckIns(state: DemoState, userId: string) {
  return sortByCreatedAtDesc((state.studentCheckIns || []).filter((checkIn) => checkIn.userId === userId));
}

export function getMerchantStudentCheckIns(state: DemoState, merchantId?: string) {
  const checkIns = merchantId ? (state.studentCheckIns || []).filter((checkIn) => checkIn.merchantId === merchantId) : state.studentCheckIns || [];
  return sortByCreatedAtDesc(checkIns);
}

export function getStudentCheckInsToday(state: DemoState) {
  const today = getTodayDateKey();
  return (state.studentCheckIns || []).filter((checkIn) => checkIn.dateKey === today);
}

export function getConfirmedStudentCheckInsToday(state: DemoState) {
  return getStudentCheckInsToday(state).filter((checkIn) => checkIn.status === "confirmed");
}

export function getCancelledStudentCheckIns(state: DemoState) {
  return (state.studentCheckIns || []).filter((checkIn) => checkIn.status === "cancelled");
}

function sortByCreatedAtDesc<T extends { createdAt: string }>(items: T[]) {
  return [...items].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
}

export function toActivityItems(transactions: Transaction[]): LegacyTransaction[] {
  return sortByCreatedAtDesc(transactions).map((transaction) => ({
    id: transaction.id,
    merchant: transaction.merchantName || transaction.description,
    detail: transaction.description,
    amount: formatTransactionAmount(transaction),
    kind: transaction.type === "adjustment" ? "topup" : transaction.type,
    icon: transactionIcon(transaction),
    time: formatTime(transaction.createdAt)
  }));
}

export function toRedemptionCards(redemptions: Redemption[]): LegacyRedemption[] {
  return sortByCreatedAtDesc(redemptions).map((redemption) => ({
    id: redemption.id,
    employee: redemption.employeeName,
    order: redemption.itemName,
    payment: redemption.paymentBreakdown,
    status: "Approved"
  }));
}

export function toEmployeeRows(employees: Employee[]): LegacyEmployee[] {
  return employees.map((employee) => ({
    id: employee.id,
    name: employee.name,
    department: employee.department,
    cmu: employee.cmuBalance,
    azn: formatAzn(employee.aznBalance),
    status: employee.status === "active" ? "Active" : "Limited"
  }));
}

export function toMerchantCards(merchants: Merchant[]): LegacyMerchant[] {
  return merchants.map((merchant) => {
    const meals = merchant.menuItems.filter((item) => item.kind === "meal");
    const extras = merchant.menuItems.filter((item) => item.kind === "extra");

    return {
      id: merchant.id,
      name: merchant.name,
      location: `${merchant.city}, ${merchant.country}`,
      availability: merchant.availability,
      status: merchant.status === "limited" ? "Limited" : merchant.status === "pending" ? "Pending" : "Available",
      meals: meals.map((meal) => ({
        name: meal.name,
        price: `${meal.cmuPrice || 1} CMU`,
        description: meal.description
      })),
      extras: extras.map((extra) => ({
        name: extra.name,
        price: `${extra.aznPrice?.toFixed(0) || 0} AZN`
      }))
    };
  });
}

export function toTravelRateCards(rates: TravelRate[], employee?: Employee): LegacyCountryRate[] {
  return rates.map((rate) => ({
    code: rate.code,
    country: rate.country,
    city: rate.city,
    rate: `1 CMU = ${rate.localValue}`,
    localValue: rate.localValue,
    walletPreview: employee ? `${employee.cmuBalance} CMU + ${formatAzn(employee.aznBalance)}` : `${rate.localValue} meal value`,
    partners: rate.partners
  }));
}

export function toCompanyRows(companies: Company[]): LegacyCompany[] {
  return companies.map((company) => ({
    id: company.id,
    name: company.name,
    employees: company.employeeIds.length || company.reportedEmployeeCount || 0,
    budget: `${company.monthlyBudget.toLocaleString("en-US")} AZN`,
    status: company.status === "active" ? "Active" : company.status === "review" ? "Review" : "Travel pilot"
  }));
}

export function toAdminMetricCards(state: DemoState): AdminMetric[] {
  const metrics = getAdminMetrics(state);
  return [
    { label: "Companies", value: metrics.companies.toLocaleString("en-US"), detail: `${metrics.pendingMerchantApprovals} merchant approvals`, icon: "apartment" },
    { label: "Employees", value: metrics.employees.toLocaleString("en-US"), detail: "Across demo companies", icon: "groups" },
    { label: "Merchants", value: metrics.merchants.toLocaleString("en-US"), detail: `${metrics.activeMerchants} active`, icon: "storefront" },
    { label: "Transactions", value: metrics.transactions.toLocaleString("en-US"), detail: "Shared product ledger", icon: "receipt_long" }
  ];
}

export function getPrimaryEmployee(state: DemoState) {
  return getEmployeeById(state, PRIMARY_EMPLOYEE_ID);
}

export function getPrimaryCompany(state: DemoState) {
  return state.companies[PRIMARY_COMPANY_ID];
}

export function getPrimaryMerchant(state: DemoState) {
  return state.merchants[PRIMARY_MERCHANT_ID];
}

function transactionIcon(transaction: Transaction) {
  if (transaction.type === "topup") return "add_card";
  if (transaction.type === "adjustment") return "tune";
  if (transaction.type === "azn") return "payments";
  if (transaction.type === "split") return "call_split";
  return "restaurant";
}

function formatTransactionAmount(transaction: Transaction) {
  if (transaction.type === "topup") {
    return joinAmounts(transaction.cmuAmount, transaction.aznAmount, "positive");
  }

  if (transaction.type === "adjustment") {
    return joinSignedAmounts(transaction.cmuAmount, transaction.aznAmount);
  }

  return joinAmounts(transaction.cmuAmount, transaction.aznAmount, "negative");
}

function joinAmounts(cmuAmount: number, aznAmount: number, direction: "positive" | "negative") {
  const sign = direction === "positive" ? "+" : "-";
  const parts: string[] = [];
  if (cmuAmount > 0) parts.push(`${sign}${cmuAmount} CMU`);
  if (aznAmount > 0) parts.push(`${sign}${aznAmount.toFixed(2)} AZN`);
  return parts.join(" ") || "0";
}

function joinSignedAmounts(cmuAmount: number, aznAmount: number) {
  const parts: string[] = [];
  if (cmuAmount !== 0) parts.push(`${cmuAmount > 0 ? "+" : ""}${cmuAmount} CMU`);
  if (aznAmount !== 0) parts.push(`${aznAmount > 0 ? "+" : ""}${aznAmount.toFixed(2)} AZN`);
  return parts.join(" ") || "0";
}

function formatTime(createdAt: string) {
  const date = new Date(createdAt);
  const today = new Date().toISOString().slice(0, 10);
  const time = new Intl.DateTimeFormat("en-US", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false
  }).format(date);

  if (createdAt.slice(0, 10) === today) return `Today, ${time}`;

  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false
  }).format(date);
}

export { PRIMARY_COMPANY_ID, PRIMARY_EMPLOYEE_ID, PRIMARY_MERCHANT_ID };
