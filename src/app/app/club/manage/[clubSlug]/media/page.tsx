import Image from "next/image";

import { deleteClubMediaAction, uploadClubMediaAction } from "./actions";
import { EventsRouteError } from "@/components/events/EventPrimitives";
import { hasClubCapability } from "@/lib/clubs/permissions";
import { listClubMediaAssets } from "@/lib/server/clubMedia";
import { getCurrentClubDashboardBySlug } from "@/lib/server/events";

export const dynamic = "force-dynamic";

export default async function ManagedClubMediaPage({ params }: { params: Promise<{ clubSlug: string }> }) {
  const { clubSlug } = await params;
  const dashboard = await getCurrentClubDashboardBySlug(clubSlug);
  if (!dashboard || !hasClubCapability(dashboard.roles, "club.posts.view")) return <EventsRouteError error="club_access_denied" />;
  const assets = await listClubMediaAssets(dashboard.club.id);
  const canUpload = hasClubCapability(dashboard.roles, "club.posts.create");
  const canDelete = hasClubCapability(dashboard.roles, "club.posts.delete");
  return <><header className="border-b border-black/15 pb-6"><p className="text-xs font-bold uppercase tracking-[0.15em] text-black/45">Assets</p><h1 className="mt-2 text-4xl font-semibold tracking-[-0.045em]">Media</h1><p className="mt-2 text-sm text-black/55">Reuse approved images across club posts and events.</p></header>{canUpload ? <form action={uploadClubMediaAction} className="mt-6 grid gap-4 rounded-2xl border border-black/10 bg-white p-5 sm:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_auto] sm:items-end"><input type="hidden" name="clubId" value={dashboard.club.id} /><label><span className="mb-2 block text-xs font-bold uppercase tracking-[0.08em] text-black/45">Image</span><input required type="file" name="file" accept="image/jpeg,image/png,image/webp,image/avif" className="min-h-12 w-full rounded-xl border border-black/20 p-2 text-sm" /></label><label><span className="mb-2 block text-xs font-bold uppercase tracking-[0.08em] text-black/45">Alternative text</span><input name="altText" maxLength={240} className="min-h-12 w-full rounded-xl border border-black/20 px-3" /></label><button className="min-h-12 rounded-xl bg-[#FFD84D] px-4 text-sm font-bold">Upload</button></form> : null}{assets.length ? <section className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-4">{assets.map((asset) => <article key={asset.id} className="overflow-hidden rounded-2xl border border-black/10 bg-white"><div className="relative aspect-square bg-[#F3F1EA]"><Image src={asset.url} alt={asset.altText || "Club media"} fill sizes="(max-width: 640px) 50vw, 25vw" className="object-cover" /></div><div className="p-3"><div className="flex items-center justify-between gap-2"><span className="rounded-full bg-black/5 px-2 py-1 text-[10px] font-bold uppercase">{asset.kind}</span><time dateTime={asset.createdAt} className="text-[10px] text-black/40">{new Date(asset.createdAt).toLocaleDateString()}</time></div>{canDelete ? <form action={deleteClubMediaAction} className="mt-3"><input type="hidden" name="clubId" value={dashboard.club.id} /><input type="hidden" name="assetId" value={asset.id} /><button className="min-h-10 w-full rounded-xl border border-black text-xs font-bold">Delete if unused</button></form> : null}</div></article>)}</section> : <section className="mt-6 rounded-2xl border border-dashed border-black/25 bg-white p-10 text-center"><h2 className="text-xl font-semibold">No media yet</h2><p className="mt-2 text-sm text-black/50">Uploaded club, event and post images will appear here.</p></section>}</>;
}
