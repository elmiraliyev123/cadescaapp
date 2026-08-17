"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";

import { Logo } from "@/components/ui/Logo";
import { hasClubCapability, type ClubRole } from "@/lib/clubs/permissions";

type ShellClub = { id: string; name: string; slug: string; logoUrl: string | null };

const desktopItems = [
  { id: "overview", segment: "", label: "Overview", icon: "space_dashboard", capability: "club.workspace.view" as const },
  { id: "events", segment: "/events", label: "Events", icon: "event", capability: "club.events.view" as const },
  { id: "posts", segment: "/posts", label: "Posts", icon: "post_add", capability: "club.posts.view" as const },
  { id: "team", segment: "/team", label: "Team", icon: "group", capability: "club.members.view" as const },
  { id: "profile", segment: "/profile", label: "Club profile", icon: "domain", capability: "club.profile.view" as const },
  { id: "media", segment: "/media", label: "Media", icon: "perm_media", capability: "club.posts.view" as const },
  { id: "analytics", segment: "/analytics", label: "Analytics", icon: "monitoring", capability: "club.analytics.view" as const },
  { id: "settings", segment: "/settings", label: "Settings", icon: "settings", capability: "club.settings.manage" as const }
];

function roleLabel(roles: ClubRole[]) {
  const role = roles.includes("club_owner") ? "Owner" : roles.includes("club_admin") ? "Admin" : roles[0] || "Viewer";
  return role.replace(/^club_/, "").replaceAll("_", " ").replace(/\b\w/g, (letter) => letter.toUpperCase());
}

export function ClubManagerShell({
  club,
  roles,
  user,
  clubCount,
  logoutHref,
  children
}: {
  club: ShellClub;
  roles: ClubRole[];
  user: { name: string; email: string; avatarUrl: string | null };
  clubCount: number;
  logoutHref: string;
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const base = `/dashboard/${club.slug}`;
  const items = desktopItems.filter((item) => hasClubCapability(roles, item.capability));
  const active = items.slice().reverse().find((item) => item.segment ? pathname.startsWith(`${base}${item.segment}`) : pathname === base)?.id || "overview";
  const mobile = [
    { id: "overview", href: base, label: "Home", icon: "space_dashboard" },
    { id: "events", href: `${base}/events`, label: "Events", icon: "event" },
    { id: "posts", href: `${base}/posts`, label: "Posts", icon: "post_add" },
    { id: "more", href: `${base}/more`, label: "More", icon: "more_horiz" }
  ].filter((item) => item.id === "overview" || item.id === "more" || items.some((desktop) => desktop.id === item.id));

  return <div className="min-h-dvh bg-[#F3F1EA] text-black lg:grid lg:grid-cols-[272px_minmax(0,1fr)]">
    <aside className="fixed inset-y-0 left-0 z-30 hidden w-[272px] flex-col border-r border-black/10 bg-black px-4 py-5 text-white lg:flex">
      <div className="rounded-xl bg-white px-3 py-2"><Logo maxWidth={126} /></div>
      <div className="mt-5 rounded-2xl border border-white/15 bg-white/5 p-3">
        <div className="flex items-center gap-3">
          <div className="relative h-11 w-11 shrink-0 overflow-hidden rounded-xl bg-[#FFD84D] text-black">{club.logoUrl ? <Image src={club.logoUrl} alt={`${club.name} logo`} fill sizes="44px" className="object-cover" /> : <span className="material-symbols-outlined flex h-full items-center justify-center" aria-hidden="true">groups</span>}</div>
          <div className="min-w-0 flex-1"><p className="truncate text-sm font-bold">{club.name}</p><p className="mt-0.5 text-[11px] font-semibold text-white/50">{roleLabel(roles)}</p></div>
          {clubCount > 1 ? <Link href="/clubs" aria-label="Switch club" className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg hover:bg-white/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#FFD84D]"><span className="material-symbols-outlined text-[19px]" aria-hidden="true">unfold_more</span></Link> : null}
        </div>
      </div>
      <nav aria-label="Club workspace" className="mt-6 space-y-1">
        {items.map((item) => <Link key={item.id} href={`${base}${item.segment}`} aria-current={active === item.id ? "page" : undefined} className={`flex min-h-11 items-center gap-3 rounded-xl px-3 text-sm font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#FFD84D] ${active === item.id ? "bg-[#FFD84D] text-black" : "text-white/70 hover:bg-white/10 hover:text-white"}`}><span className="material-symbols-outlined text-[20px]" aria-hidden="true">{item.icon}</span>{item.label}</Link>)}
      </nav>
      <div className="mt-auto border-t border-white/15 pt-4">
        <div className="flex items-center gap-3 px-2">
          <div className="relative h-10 w-10 shrink-0 overflow-hidden rounded-full bg-white/15">{user.avatarUrl ? <Image src={user.avatarUrl} alt="" fill sizes="40px" className="object-cover" /> : <span className="material-symbols-outlined flex h-full items-center justify-center" aria-hidden="true">person</span>}</div>
          <div className="min-w-0"><p className="truncate text-sm font-semibold">{user.name}</p><p className="truncate text-[11px] text-white/45">{user.email}</p></div>
        </div>
        <Link href={logoutHref} className="mt-3 flex min-h-11 items-center gap-3 rounded-xl px-3 text-sm font-semibold text-white/65 hover:bg-white/10 hover:text-white"><span className="material-symbols-outlined text-[20px]" aria-hidden="true">logout</span>Log out</Link>
      </div>
    </aside>

    <div className="min-w-0 lg:col-start-2">
      <header className="sticky top-0 z-20 border-b border-black/10 bg-[#F3F1EA]/95 px-4 py-3 backdrop-blur lg:hidden">
        <div className="mx-auto flex max-w-4xl items-center gap-3"><div className="relative h-10 w-10 shrink-0 overflow-hidden rounded-xl bg-[#FFD84D]">{club.logoUrl ? <Image src={club.logoUrl} alt="" fill sizes="40px" className="object-cover" /> : <span className="material-symbols-outlined flex h-full items-center justify-center" aria-hidden="true">groups</span>}</div><div className="min-w-0 flex-1"><p className="truncate text-sm font-bold">{club.name}</p><p className="text-[11px] font-semibold text-black/45">{roleLabel(roles)}</p></div>{clubCount > 1 ? <Link href="/clubs" aria-label="Switch club" className="flex h-11 w-11 items-center justify-center rounded-xl border border-black/15 bg-white"><span className="material-symbols-outlined" aria-hidden="true">swap_horiz</span></Link> : null}</div>
      </header>
      <main className="mx-auto w-full max-w-[1260px] px-4 py-6 pb-[calc(6.5rem+env(safe-area-inset-bottom))] sm:px-6 sm:py-8 lg:px-9 lg:pb-10">{children}</main>
    </div>

    <nav aria-label="Club workspace" className="fixed inset-x-0 bottom-0 z-30 border-t border-black/10 bg-white/95 px-2 pb-[env(safe-area-inset-bottom)] backdrop-blur lg:hidden">
      <div className="mx-auto grid max-w-md grid-flow-col auto-cols-fr">
        {mobile.map((item) => {
          const selected = item.id === "more" ? pathname.startsWith(`${base}/more`) : active === item.id;
          return <Link key={item.id} href={item.href} aria-current={selected ? "page" : undefined} className={`flex min-h-[64px] flex-col items-center justify-center gap-1 px-1 text-[11px] font-bold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-black ${selected ? "text-black" : "text-black/45"}`}><span className={`material-symbols-outlined text-[22px] ${selected ? "rounded-full bg-[#FFD84D] px-3 py-0.5" : ""}`} aria-hidden="true">{item.icon}</span>{item.label}</Link>;
        })}
      </div>
    </nav>
  </div>;
}
