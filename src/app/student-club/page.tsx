import { redirect } from "next/navigation";

import { ClubApplicationScreen } from "@/components/clubs/ClubApplicationScreen";
import { ClubLoginScreen } from "@/components/clubs/ClubLoginScreen";
import { getAuthUrl, getStudentClubUrl } from "@/lib/appConfig";
import { PRIVATE_ROUTE_METADATA } from "@/lib/seo/metadata";
import { getCurrentStudentContext } from "@/lib/server/social";
import { getCurrentClubApplication } from "@/lib/server/studentClubs";
import { listActiveUniversities } from "@/lib/server/universities";

export const metadata = {
  ...PRIVATE_ROUTE_METADATA,
  title: "Student Club Application | Cadesca"
};
export const dynamic = "force-dynamic";

export default async function StudentClubApplicationPage() {
  const user = await getCurrentStudentContext();
  if (!user) {
    const login = new URL("/login", getAuthUrl());
    login.searchParams.set("next", `${getStudentClubUrl()}/application`);
    return <ClubLoginScreen authHref={login.toString()} />;
  }

  const application = await getCurrentClubApplication().catch(() => null);
  if (application?.status === "approved") redirect("/dashboard");
  if (application) redirect("/waiting-approval");

  const universities = await listActiveUniversities().catch(() => []);
  return <ClubApplicationScreen universities={universities.map(({ id, name }) => ({ id, name }))} />;
}
