import Link from "next/link";

import { hasClubCapability } from "@/lib/clubs/permissions";
import { getCurrentClubDashboardBySlug } from "@/lib/server/events";

export const dynamic = "force-dynamic";

export default async function ManagedClubMorePage({ params }: { params: Promise<{ clubSlug: string }> }) {
  const { clubSlug } = await params;
  const dashboard = await getCurrentClubDashboardBySlug(clubSlug);
  if (!dashboard) return null;
  const base = `/dashboard/${dashboard.club.slug}`;
  const items = [
    { href: `${base}/team`, label: "Team", description: "Members, roles and invitations", icon: "group", show: hasClubCapability(dashboard.roles, "club.members.view") },
    { href: `${base}/profile`, label: "Club profile", description: "Public identity and social links", icon: "domain", show: hasClubCapability(dashboard.roles, "club.profile.view") },
    { href: `${base}/media`, label: "Media", description: "Reusable club assets", icon: "perm_media", show: hasClubCapability(dashboard.roles, "club.posts.view") },
    { href: `${base}/analytics`, label: "Analytics", description: "Registration and engagement signals", icon: "monitoring", show: hasClubCapability(dashboard.roles, "club.analytics.view") },
    { href: `${base}/settings`, label: "Settings", description: "Permissions and club controls", icon: "settings", show: hasClubCapability(dashboard.roles, "club.settings.manage") },
    { href: "/clubs", label: "Switch club", description: "Open another managed organization", icon: "swap_horiz", show: true }
  ].filter((item) => item.show);
  return <><header className="border-b border-black/15 pb-6"><p className="text-xs font-bold uppercase tracking-[0.15em] text-black/45">Workspace</p><h1 className="mt-2 text-4xl font-semibold tracking-[-0.045em]">More</h1></header><section className="mt-6 grid gap-3 sm:grid-cols-2">{items.map((item) => <Link key={item.href} href={item.href} className="flex min-h-24 items-center gap-4 rounded-2xl border border-black/10 bg-white p-4"><span className="material-symbols-outlined flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-[#FFF3B8]" aria-hidden="true">{item.icon}</span><span className="min-w-0"><span className="block font-semibold">{item.label}</span><span className="mt-1 block text-xs leading-5 text-black/50">{item.description}</span></span></Link>)}</section></>;
}
