import { redirect } from "next/navigation";

import { ClubApplicationScreen } from "@/components/clubs/ClubApplicationScreen";
import { getCurrentStudentContext } from "@/lib/server/social";
import {
  getCurrentClubApplication,
  getCurrentClubApplicationDraft,
  listCurrentManagedClubs
} from "@/lib/server/studentClubs";
import { listActiveUniversities } from "@/lib/server/universities";

export const dynamic = "force-dynamic";

export default async function NewClubApplicationPage() {
  const user = await getCurrentStudentContext();
  if (!user) redirect("/");

  const [clubs, application, draft, universities] = await Promise.all([
    listCurrentManagedClubs(),
    getCurrentClubApplication().catch(() => null),
    getCurrentClubApplicationDraft().catch(() => null),
    listActiveUniversities().catch(() => [])
  ]);
  const allowMultiple = process.env.STUDENT_CLUB_ALLOW_MULTIPLE_APPLICATIONS === "true";
  if (application && (!allowMultiple || ["pending_review", "clarification_requested", "rejected", "suspended"].includes(application.status))) redirect(`/application/${application.id}/status`);
  if (draft) redirect(`/application/${draft.id}`);
  if (clubs.length && !allowMultiple) {
    redirect(clubs.length === 1 ? `/dashboard/${clubs[0].slug}` : "/clubs");
  }

  return <ClubApplicationScreen
    universities={universities.map(({ id, name }) => ({ id, name }))}
    draft={null}
    applicant={{ name: user.displayName || user.name, email: user.email }}
    defaultUniversityId={user.universityId}
  />;
}
