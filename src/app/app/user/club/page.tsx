import { redirect } from "next/navigation";

import { getStudentClubUrl } from "@/lib/appConfig";

export const dynamic = "force-dynamic";

export default async function ClubGatewayPage() {
  const studentClubUrl = getStudentClubUrl();
  redirect(`${studentClubUrl}/resolve`);
}
