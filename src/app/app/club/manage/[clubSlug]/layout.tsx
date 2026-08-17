import { Suspense } from "react";
import { notFound, redirect } from "next/navigation";

import { ClubManagerShell } from "@/components/clubs/ClubManagerShell";
import { getAuthUrl, getStudentClubUrl } from "@/lib/appConfig";
import { getCurrentClubDashboardBySlug } from "@/lib/server/events";
import { getCurrentStudentContext } from "@/lib/server/social";
import { listCurrentManagedClubs } from "@/lib/server/studentClubs";

export const dynamic = "force-dynamic";

export default async function ManagedClubLayout({ children, params }: { children: React.ReactNode; params: Promise<{ clubSlug: string }> }) {
  const user = await getCurrentStudentContext();
  if (!user) redirect("/");
  const { clubSlug } = await params;
  const [dashboard, clubs] = await Promise.all([
    getCurrentClubDashboardBySlug(clubSlug).catch(() => null),
    listCurrentManagedClubs()
  ]);
  if (!dashboard) notFound();
  const logout = new URL("/logout", getAuthUrl());
  logout.searchParams.set("next", getStudentClubUrl());

  return <Suspense fallback={<div className="min-h-dvh bg-[#F3F1EA]" />}>
    <ClubManagerShell
      club={{ id: dashboard.club.id, name: dashboard.club.name, slug: dashboard.club.slug, logoUrl: dashboard.club.logoUrl }}
      roles={dashboard.roles}
      user={{ name: user.displayName || user.name, email: user.email, avatarUrl: user.avatarUrl }}
      clubCount={clubs.length}
      logoutHref={logout.toString()}
    >{children}</ClubManagerShell>
  </Suspense>;
}
