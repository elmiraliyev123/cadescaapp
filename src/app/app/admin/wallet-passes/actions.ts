"use server";

import { revalidatePath } from "next/cache";

import { requireAdminSession } from "@/lib/server/adminAuth";
import {
  disableStudentAndRevokeWalletPass,
  refreshGoogleWalletPass,
  reissueGoogleWalletPass,
  revokeGoogleWalletPass
} from "@/lib/server/googleWallet";

function formString(formData: FormData, key: string) {
  const value = formData.get(key);
  return typeof value === "string" ? value.trim() : "";
}

function revalidateWalletAdminPaths() {
  revalidatePath("/app/admin/wallet-passes");
  revalidatePath("/app/admin/users");
  revalidatePath("/app/user/pass");
}

export async function revokeWalletPassAction(formData: FormData) {
  await requireAdminSession();
  const userId = formString(formData, "userId");
  if (!userId) throw new Error("invalid_wallet_pass_payload");

  await revokeGoogleWalletPass(userId);
  revalidateWalletAdminPaths();
}

export async function reissueWalletPassAction(formData: FormData) {
  await requireAdminSession();
  const userId = formString(formData, "userId");
  if (!userId) throw new Error("invalid_wallet_pass_payload");

  await reissueGoogleWalletPass(userId);
  revalidateWalletAdminPaths();
}

export async function forceUpdateWalletPassAction(formData: FormData) {
  await requireAdminSession();
  const userId = formString(formData, "userId");
  if (!userId) throw new Error("invalid_wallet_pass_payload");

  await refreshGoogleWalletPass(userId);
  revalidateWalletAdminPaths();
}

export async function disableStudentAction(formData: FormData) {
  await requireAdminSession();
  const userId = formString(formData, "userId");
  if (!userId) throw new Error("invalid_wallet_pass_payload");

  await disableStudentAndRevokeWalletPass(userId);
  revalidateWalletAdminPaths();
}
