"use client";

import { useActionState } from "react";

import { createClubPostAction, deleteClubPostAction, type ClubPostActionState } from "@/app/app/club/posts/actions";
import { ClubEventNav, EventsFrame, EventsHeader, eventPrimaryButton, eventSecondaryButton } from "@/components/events/EventPrimitives";
import { hasClubCapability, type ClubRole } from "@/lib/clubs/permissions";
import type { ClubManagedPost } from "@/lib/server/clubPosts";

const EMPTY_STATE: ClubPostActionState = { ok: false, message: "" };

export function ClubPostsManager({ clubId, clubName, roles, posts }: { clubId: string; clubName: string; roles: ClubRole[]; posts: ClubManagedPost[] }) {
  const [state, action, pending] = useActionState(createClubPostAction, EMPTY_STATE);
  const visible = [
    "overview",
    ...(hasClubCapability(roles, "club.posts.create") ? ["posts" as const] : []),
    ...(hasClubCapability(roles, "club.events.update") ? ["events" as const] : []),
    ...(hasClubCapability(roles, "club.members.manage") ? ["members" as const] : []),
    ...(hasClubCapability(roles, "club.settings.manage") ? ["settings" as const] : []),
    ...(hasClubCapability(roles, "club.events.manage_finance") ? ["finance" as const] : []),
    ...(hasClubCapability(roles, "club.events.check_in") ? ["scanner" as const] : [])
  ] as const;
  return (
    <EventsFrame>
      <ClubEventNav current="posts" visible={visible} clubId={clubId} />
      <EventsHeader eyebrow={clubName} title="Club posts" description="Publish to Cadesca using the club's public identity." />
      <form action={action} className="rounded-2xl border-2 border-black bg-white p-4 sm:p-5">
        <input type="hidden" name="clubId" value={clubId} />
        <label className="block">
          <span className="mb-2 block text-[12px] font-black uppercase tracking-[0.08em]">Post as {clubName}</span>
          <textarea name="body" maxLength={1000} rows={5} className="w-full rounded-xl border border-black/25 p-3 text-[15px] outline-none focus:border-black focus:ring-2 focus:ring-[#ffd400]" placeholder="Share an update with students" />
        </label>
        <label className="mt-3 block text-[13px] font-bold">
          <span className="mb-1.5 block">Optional image</span>
          <input type="file" name="image" accept="image/jpeg,image/png,image/webp,image/avif" className="w-full rounded-xl border border-black/25 p-2" />
        </label>
        <button type="submit" disabled={pending} className={`${eventPrimaryButton} mt-4`}><span>{pending ? "Publishing…" : "Publish as club"}</span></button>
        {state.message ? <p role={state.ok ? "status" : "alert"} className="mt-3 text-[13px] font-bold">{state.message}</p> : null}
      </form>

      <section className="mt-8">
        <h2 className="mb-4 text-[22px] font-black">Published posts</h2>
        {posts.length ? <div className="space-y-3">{posts.map((post) => (
          <article key={post.id} className="rounded-2xl border-2 border-black bg-white p-4">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0 flex-1">
                <p className="whitespace-pre-wrap break-words text-[14px] leading-6">{post.body || "Image post"}</p>
                <time className="mt-2 block text-[11px] font-bold text-black/50" dateTime={post.createdAt}>{new Date(post.createdAt).toLocaleString()}</time>
              </div>
              <span className="rounded-full border border-black/20 px-2 py-1 text-[10px] font-bold uppercase">{post.status}</span>
            </div>
            {post.imageUrl ? <img src={post.imageUrl} alt="Attached club post media" className="mt-3 max-h-72 w-full rounded-xl object-cover" /> : null}
            {post.status !== "deleted" ? (
              <form action={deleteClubPostAction} className="mt-3">
                <input type="hidden" name="clubId" value={clubId} />
                <input type="hidden" name="postId" value={post.id} />
                <button type="submit" className={eventSecondaryButton}><span>Delete</span></button>
              </form>
            ) : null}
          </article>
        ))}</div> : <div className="rounded-2xl border-2 border-dashed border-black bg-white px-5 py-8 text-center text-[14px] font-bold">No club posts yet.</div>}
      </section>
    </EventsFrame>
  );
}
