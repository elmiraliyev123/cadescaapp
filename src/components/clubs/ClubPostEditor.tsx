"use client";

import { useActionState, useState } from "react";

import { createClubPostAction, updateClubPostAction, type ClubPostActionState } from "@/app/app/club/posts/actions";
import type { ClubManagedPost } from "@/lib/server/clubPosts";

const EMPTY: ClubPostActionState = { ok: false, message: "" };
const input = "min-h-12 w-full rounded-xl border border-black/20 bg-white px-3.5 py-2.5 text-[15px] outline-none focus:border-black focus:ring-2 focus:ring-[#FFD84D]";

export function ClubPostEditor({ clubId, clubName, events, post }: { clubId: string; clubName: string; events: Array<{ id: string; title: string }>; post?: ClubManagedPost }) {
  const [state, action, pending] = useActionState(post ? updateClubPostAction : createClubPostAction, EMPTY);
  const [title, setTitle] = useState(post?.title || "");
  const [body, setBody] = useState(post?.body || "");
  const [scheduledAt, setScheduledAt] = useState(post?.scheduledAt || "");

  return <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_minmax(300px,0.55fr)]">
    <form action={action} className="rounded-2xl border border-black/10 bg-white p-5 sm:p-7">
      <input type="hidden" name="clubId" value={clubId} />
      {post ? <input type="hidden" name="postId" value={post.id} /> : null}
      <p className="text-xs font-bold uppercase tracking-[0.14em] text-black/45">Publishing as {clubName}</p>
      <h1 className="mt-2 text-4xl font-semibold tracking-[-0.045em]">{post ? "Edit post" : "Create post"}</h1>
      <div className="mt-7 space-y-5">
        <label className="block"><span className="mb-2 block text-xs font-bold uppercase tracking-[0.08em] text-black/50">Title (optional)</span><input name="title" maxLength={160} value={title} onChange={(event) => setTitle(event.target.value)} className={input} /></label>
        <label className="block"><span className="mb-2 block text-xs font-bold uppercase tracking-[0.08em] text-black/50">Caption</span><textarea name="body" required minLength={1} maxLength={1000} rows={8} value={body} onChange={(event) => setBody(event.target.value)} className={`${input} resize-y`} placeholder="Share an update with students" /></label>
        <div className="grid gap-4 sm:grid-cols-2"><label className="block"><span className="mb-2 block text-xs font-bold uppercase tracking-[0.08em] text-black/50">{post?.imageUrl ? "Replace image" : "Image"}</span><input name="image" type="file" accept="image/jpeg,image/png,image/webp,image/avif" className={`${input} file:mr-3 file:rounded-lg file:border-0 file:bg-black file:px-3 file:py-2 file:text-sm file:font-bold file:text-white`} /></label><label className="block"><span className="mb-2 block text-xs font-bold uppercase tracking-[0.08em] text-black/50">Related event</span><select name="relatedEventId" defaultValue={post?.relatedEventId || ""} className={input}><option value="">None</option>{events.map((event) => <option key={event.id} value={event.id}>{event.title}</option>)}</select></label></div>
        <div className="grid gap-4 sm:grid-cols-2"><label className="block"><span className="mb-2 block text-xs font-bold uppercase tracking-[0.08em] text-black/50">Link</span><input type="url" inputMode="url" name="linkUrl" defaultValue={post?.linkUrl || ""} className={input} placeholder="https://" /></label><label className="block"><span className="mb-2 block text-xs font-bold uppercase tracking-[0.08em] text-black/50">Tags</span><input name="tags" defaultValue={post?.tags.join(", ") || ""} maxLength={480} className={input} placeholder="announcement, community" /></label></div>
        <label className="block"><span className="mb-2 block text-xs font-bold uppercase tracking-[0.08em] text-black/50">Schedule time</span><input type="datetime-local" value={scheduledAt ? new Date(new Date(scheduledAt).getTime() - new Date(scheduledAt).getTimezoneOffset() * 60_000).toISOString().slice(0, 16) : ""} onChange={(event) => setScheduledAt(event.target.value ? new Date(event.target.value).toISOString() : "")} className={input} /><input type="hidden" name="scheduledAt" value={scheduledAt} /><span className="mt-2 block text-xs text-black/45">Required only when choosing Schedule. Your local time is converted securely.</span></label>
      </div>
      {state.message ? <p role={state.ok ? "status" : "alert"} className={`mt-5 rounded-xl p-3 text-sm font-semibold ${state.ok ? "bg-emerald-50 text-emerald-800" : "bg-red-50 text-red-800"}`}>{state.message}</p> : null}
      <div className="mt-7 flex flex-wrap gap-2"><button type="submit" name="publicationStatus" value="draft" disabled={pending} className="min-h-11 rounded-xl border border-black bg-white px-4 text-sm font-bold">Save draft</button><button type="submit" name="publicationStatus" value="scheduled" disabled={pending} className="min-h-11 rounded-xl border border-black bg-white px-4 text-sm font-bold">Schedule</button><button type="submit" name="publicationStatus" value="published" disabled={pending} className="min-h-11 rounded-xl border border-black bg-[#FFD84D] px-4 text-sm font-bold">{pending ? "Saving…" : post ? "Update post" : "Publish now"}</button></div>
    </form>
    <aside className="self-start rounded-2xl border border-black/10 bg-[#FFF8D8] p-5 xl:sticky xl:top-8"><p className="text-xs font-bold uppercase tracking-[0.12em] text-black/45">Preview</p><article className="mt-4 rounded-2xl border border-black/10 bg-white p-5"><p className="text-xs font-bold uppercase tracking-[0.08em] text-black/45">{clubName}</p>{title ? <h2 className="mt-2 text-xl font-semibold">{title}</h2> : null}<p className="mt-3 whitespace-pre-wrap text-sm leading-6 text-black/65">{body || "Your post preview will appear here."}</p></article></aside>
  </div>;
}
