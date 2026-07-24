import { redirect } from "next/navigation";

import { getAuthUrl, getStudentClubUrl } from "@/lib/appConfig";
import { getCurrentStudentContext } from "@/lib/server/social";
import { hasCurrentActiveClubMembership } from "@/lib/server/studentClubs";

export const dynamic = "force-dynamic";

export default async function ClubGatewayPage() {
  const user = await getCurrentStudentContext();
  const studentClubUrl = getStudentClubUrl();
  if (!user) {
    const authUrl = new URL("/login", getAuthUrl());
    authUrl.searchParams.set("next", `${studentClubUrl}/application`);
    redirect(authUrl.toString());
  }
  redirect(`${studentClubUrl}${await hasCurrentActiveClubMembership() ? "/dashboard" : "/waiting-approval"}`);
}
