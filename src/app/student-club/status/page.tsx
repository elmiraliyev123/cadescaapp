import { ClubStatusPanel } from "@/components/clubs/ClubStatusPanel";
import { getAuthUrl, getStudentClubUrl } from "@/lib/appConfig";
import { PRIVATE_ROUTE_METADATA } from "@/lib/seo/metadata";
import { getCurrentStudentContext } from "@/lib/server/social";
import { getCurrentClubApplication } from "@/lib/server/studentClubs";

export const metadata = {
  ...PRIVATE_ROUTE_METADATA,
  title: "Club Application Status | Cadesca"
};
export const dynamic = "force-dynamic";

export default async function ClubApplicationStatusPage() {
  const user = await getCurrentStudentContext();
  const application = user ? await getCurrentClubApplication().catch(() => null) : null;
  const dashboardHref = "/dashboard";
  const authUrl = new URL("/login", getAuthUrl());
  authUrl.searchParams.set("next", `${getStudentClubUrl()}/waiting-approval`);

  return (
    <ClubStatusPanel
      application={application}
      authenticated={Boolean(user)}
      authHref={authUrl.toString()}
      dashboardHref={dashboardHref}
    />
  );
}
