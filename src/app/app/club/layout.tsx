import { redirect } from "next/navigation";

import { hasCurrentActiveClubMembership } from "@/lib/server/studentClubs";

export default async function ClubLayout({ children }: { children: React.ReactNode }) {
  if (!(await hasCurrentActiveClubMembership())) {
    redirect("/waiting-approval");
  }

  return children;
}
