import { redirect } from "next/navigation";

import { ClubApplicationsAdminView } from "@/components/clubs/ClubApplicationsAdminView";
import { getAdminSessionFromCookies } from "@/lib/server/adminAuth";
import { listClubApplicationsForAdmin } from "@/lib/server/studentClubs";

import { moderateClubStatusAction, reviewClubApplicationAction } from "./actions";

export const dynamic = "force-dynamic";

export default async function ClubApplicationsAdminPage() {
  const session = await getAdminSessionFromCookies();
  if (!session) redirect("/admin/login");
  const applications = await listClubApplicationsForAdmin("all");

  return (
    <ClubApplicationsAdminView
      applications={applications}
      reviewApplicationAction={reviewClubApplicationAction}
      moderateStatusAction={moderateClubStatusAction}
    />
  );
}
