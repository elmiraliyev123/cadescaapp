import { notFound, redirect } from "next/navigation";

import { ClubStatusPanel } from "@/components/clubs/ClubStatusPanel";
import { getCurrentStudentContext } from "@/lib/server/social";
import { getCurrentClubApplication, getCurrentClubApplicationHistory } from "@/lib/server/studentClubs";

export const dynamic = "force-dynamic";

export default async function ClubApplicationStatusByIdPage({ params }: { params: Promise<{ applicationId: string }> }) {
  const user = await getCurrentStudentContext();
  if (!user) redirect("/");
  const { applicationId } = await params;
  const application = await getCurrentClubApplication().catch(() => null);
  if (!application || application.id !== applicationId) notFound();
  const history = await getCurrentClubApplicationHistory(application.id).catch(() => []);

  return <ClubStatusPanel
    application={application}
    history={history}
    authenticated
    authHref="/"
    dashboardHref={`/dashboard/${application.slug}`}
  />;
}
