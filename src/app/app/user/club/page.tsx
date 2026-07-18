import { redirect } from "next/navigation";

import { ClubGatewayPanel } from "@/components/clubs/ClubGatewayPanel";
import { getStudentClubUrl } from "@/lib/appConfig";
import { getCurrentStudentContext } from "@/lib/server/social";
import {
  getCurrentClubApplication,
  hasCurrentActiveClubMembership,
  listCurrentClubMembershipInvitations
} from "@/lib/server/studentClubs";

export const dynamic = "force-dynamic";

export default async function ClubGatewayPage() {
  const user = await getCurrentStudentContext();
  if (!user) redirect("/login?next=/app/user/club");
  const [application, invitations, hasActiveMembership] = await Promise.all([
    getCurrentClubApplication(),
    listCurrentClubMembershipInvitations(),
    hasCurrentActiveClubMembership()
  ]);
  if (hasActiveMembership && !invitations.length) {
    redirect("/app/club");
  }

  return <ClubGatewayPanel application={application} invitations={invitations} applyHref={getStudentClubUrl()} />;
}
