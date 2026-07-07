import "server-only";

import { cookies } from "next/headers";

import { ADMIN_SESSION_COOKIE, verifyAdminSessionToken } from "@/lib/server/adminSession";

export async function getAdminSessionFromCookies() {
  const cookieStore = await cookies();
  return verifyAdminSessionToken(cookieStore.get(ADMIN_SESSION_COOKIE)?.value, process.env.AUTH_SECRET || "");
}

export async function requireAdminSession() {
  const session = await getAdminSessionFromCookies();
  if (!session) throw new Error("admin_session_required");
  return session;
}
