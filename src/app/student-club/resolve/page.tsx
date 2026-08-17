import { redirect } from "next/navigation";

import { resolveStudentClubDestination } from "@/lib/server/studentClubs";

export const dynamic = "force-dynamic";

export default async function StudentClubResolverPage({
  searchParams
}: {
  searchParams: Promise<{ return_to?: string }>;
}) {
  const { return_to: returnTo } = await searchParams;
  redirect(await resolveStudentClubDestination(returnTo));
}
