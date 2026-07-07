"use server";

import { revalidatePath } from "next/cache";

import { requireAdminSession } from "@/lib/server/adminAuth";
import { getSupabaseAdminClient } from "@/lib/supabase/admin";

function formString(formData: FormData, key: string) {
  const value = formData.get(key);
  return typeof value === "string" ? value.trim() : "";
}

export async function approveStudentVerification(formData: FormData) {
  await requireAdminSession();

  const userId = formString(formData, "userId");
  const universityName = formString(formData, "universityName");
  const universityDomain = formString(formData, "universityDomain");
  const studentNumber = formString(formData, "studentNumber");
  const studentIdExpiresAt = formString(formData, "studentIdExpiresAt");
  const studentIdIssuedAt = formString(formData, "studentIdIssuedAt");
  const studentFacultyDepartment = formString(formData, "studentFacultyDepartment");
  if (!userId || !universityName) throw new Error("invalid_pending_verification_payload");

  const { error } = await getSupabaseAdminClient()
    .from("users")
    .update({
      student_status: "verified",
      student_menu_access: true,
      verified_via: "ocr",
      university_name: universityName,
      university_domain: universityDomain || null,
      student_number: studentNumber || null,
      student_id_expires_at: studentIdExpiresAt || null,
      student_id_issued_at: studentIdIssuedAt || null,
      student_faculty_department: studentFacultyDepartment || null,
      updated_at: new Date().toISOString()
    })
    .eq("id", userId)
    .eq("student_status", "pending");

  if (error) throw error;

  revalidatePath("/app/admin/pending-verifications");
  revalidatePath("/app/admin/users");
  revalidatePath("/app/user/pass");
  revalidatePath("/app/user/home");
  revalidatePath("/app/user/profile");
}

export async function rejectStudentVerification(formData: FormData) {
  await requireAdminSession();

  const userId = formString(formData, "userId");
  if (!userId) throw new Error("invalid_pending_verification_payload");

  const { error } = await getSupabaseAdminClient()
    .from("users")
    .update({
      student_status: "rejected",
      student_menu_access: false,
      verified_via: "ocr",
      updated_at: new Date().toISOString()
    })
    .eq("id", userId)
    .eq("student_status", "pending");

  if (error) throw error;

  revalidatePath("/app/admin/pending-verifications");
  revalidatePath("/app/admin/users");
  revalidatePath("/app/user/pass");
  revalidatePath("/app/user/home");
  revalidatePath("/app/user/profile");
}
