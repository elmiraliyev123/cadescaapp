import { notFound, redirect } from "next/navigation";

import { ClubApplicationScreen } from "@/components/clubs/ClubApplicationScreen";
import { getCurrentStudentContext } from "@/lib/server/social";
import {
  getCurrentClubApplication,
  getCurrentClubApplicationDraftById
} from "@/lib/server/studentClubs";
import { listActiveUniversities } from "@/lib/server/universities";

export const dynamic = "force-dynamic";

export default async function ClubApplicationDraftPage({ params }: { params: Promise<{ applicationId: string }> }) {
  const user = await getCurrentStudentContext();
  if (!user) redirect("/");
  const { applicationId } = await params;
  const application = await getCurrentClubApplication().catch(() => null);
  if (application?.id === applicationId) redirect(`/application/${application.id}/status`);

  const [draft, universities] = await Promise.all([
    getCurrentClubApplicationDraftById(applicationId).catch(() => null),
    listActiveUniversities().catch(() => [])
  ]);
  if (!draft) notFound();

  return <ClubApplicationScreen
    universities={universities.map(({ id, name }) => ({ id, name }))}
    draft={draft}
    applicant={{ name: user.displayName || user.name, email: user.email }}
    defaultUniversityId={user.universityId}
  />;
}
