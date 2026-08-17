import { redirect } from "next/navigation";

import { ClubLoginScreen } from "@/components/clubs/ClubLoginScreen";
import { getStudentClubUrl } from "@/lib/appConfig";
import { PRIVATE_ROUTE_METADATA } from "@/lib/seo/metadata";
import { getCurrentStudentContext } from "@/lib/server/social";

export const metadata = {
  ...PRIVATE_ROUTE_METADATA,
  title: "Cadesca Student Clubs"
};
export const dynamic = "force-dynamic";

export default async function StudentClubLandingPage() {
  const user = await getCurrentStudentContext();
  if (user) redirect("/resolve");

  return <ClubLoginScreen authHref={`${getStudentClubUrl()}/auth/start?return_to=%2Fresolve`} />;
}
