import "server-only";

import type { ClubDashboard, ClubEventSummary } from "@/lib/events/types";
import { getCurrentClubDashboardBySlug } from "@/lib/server/events";
import { getReadyPool } from "@/lib/server/users";

export type ClubManagerOverview = {
  dashboard: ClubDashboard;
  publishedPostCount: number;
  recentPosts: Array<{ id: string; body: string | null; status: string; createdAt: string }>;
  activity: Array<{ id: string; action: string; actorName: string | null; createdAt: string }>;
  attention: Array<{ id: string; title: string; body: string; href: string }>;
  upcomingEvent: ClubEventSummary | null;
};

export type ClubManagerAnalytics = {
  dashboard: ClubDashboard;
  registrationTrend: Array<{ day: string; count: number }>;
  eventPerformance: Array<{ id: string; title: string; registrations: number; attendance: number; capacity: number }>;
  postPerformance: Array<{ id: string; label: string; likes: number; comments: number; createdAt: string }>;
};

function iso(value: Date | string) {
  return value instanceof Date ? value.toISOString() : new Date(value).toISOString();
}

export async function getClubManagerOverview(clubSlug: string): Promise<ClubManagerOverview> {
  const dashboard = await getCurrentClubDashboardBySlug(clubSlug);
  if (!dashboard) throw new Error("club_not_found");
  const pool = await getReadyPool();
  const [posts, activity] = await Promise.all([
    pool.query<{
      id: string;
      body: string | null;
      publication_status: string;
      created_at: Date | string;
      published_count: number;
    }>(
      `select post.id,
              post.body,
              post.publication_status,
              post.created_at,
              count(*) filter (where post.publication_status = 'published' and post.status = 'active') over ()::int as published_count
         from public.university_posts post
        where post.club_id = $1::uuid
          and post.actor_type = 'club'
          and post.status <> 'deleted'
        order by post.created_at desc
        limit 5`,
      [dashboard.club.id]
    ),
    pool.query<{ id: string; action: string; actor_name: string | null; created_at: Date | string }>(
      `select activity.id, activity.action,
              coalesce(app_user.display_name, app_user.name) as actor_name,
              activity.created_at
         from (
           select 'club:' || audit.id::text as id, audit.action, audit.actor_user_id, audit.created_at
             from public.club_audit_logs audit
            where audit.club_id = $1::uuid
           union all
           select 'event:' || audit.id::text as id, audit.action, audit.actor_user_id, audit.created_at
             from public.event_audit_logs audit
            where audit.club_id = $1::uuid
              and audit.action not in ('club_post_created', 'club_post_deleted', 'club_profile_updated', 'member_invited', 'membership_accepted', 'role_revoked')
         ) activity
         left join public.users app_user on app_user.id = activity.actor_user_id
        order by activity.created_at desc
        limit 8`,
      [dashboard.club.id]
    ).catch(() => ({ rows: [] }))
  ]);

  const upcoming = dashboard.events
    .filter((event) => new Date(event.startAt).getTime() >= Date.now() && !["cancelled", "archived"].includes(event.status))
    .sort((left, right) => new Date(left.startAt).getTime() - new Date(right.startAt).getTime())[0] || null;

  const attention: ClubManagerOverview["attention"] = [];
  if (dashboard.club.status === "suspended") attention.push({ id: "club-suspended", title: "Club access is restricted", body: dashboard.club.suspensionReason || "Cadesca has restricted this club pending review.", href: `/dashboard/${clubSlug}/settings` });
  for (const event of dashboard.events.slice(0, 20)) {
    if (event.status === "draft") attention.push({ id: `draft-${event.id}`, title: "Draft event not published", body: event.title, href: `/dashboard/${clubSlug}/events/${event.id}` });
    const used = Math.max(0, event.capacity - event.availableSlots);
    if (["published", "sold_out"].includes(event.status) && event.capacity > 0 && used / event.capacity >= 0.9) attention.push({ id: `full-${event.id}`, title: event.availableSlots <= 0 ? "Event is sold out" : "Event is almost full", body: `${used} of ${event.capacity} places are used for ${event.title}.`, href: `/dashboard/${clubSlug}/events/${event.id}` });
    if (event.moderationStatus === "platform_suspended") attention.push({ id: `suspended-${event.id}`, title: "Event suspended by Cadesca", body: event.title, href: `/dashboard/${clubSlug}/events/${event.id}` });
    if (attention.length >= 5) break;
  }

  return {
    dashboard,
    publishedPostCount: Number(posts.rows[0]?.published_count || 0),
    recentPosts: posts.rows.map((post) => ({ id: post.id, body: post.body, status: post.publication_status, createdAt: iso(post.created_at) })),
    activity: activity.rows.map((entry) => ({ id: entry.id, action: entry.action, actorName: entry.actor_name, createdAt: iso(entry.created_at) })),
    attention,
    upcomingEvent: upcoming
  };
}

export async function getClubManagerAnalytics(clubSlug: string): Promise<ClubManagerAnalytics> {
  const dashboard = await getCurrentClubDashboardBySlug(clubSlug);
  if (!dashboard) throw new Error("club_not_found");
  const pool = await getReadyPool();
  const [trend, posts] = await Promise.all([
    pool.query<{ day: string; count: number }>(
      `select to_char(date_trunc('day', ticket.created_at), 'YYYY-MM-DD') as day, count(*)::int as count
         from public.event_tickets ticket
         join public.events event on event.id = ticket.event_id
        where event.club_id = $1::uuid and ticket.created_at >= now() - interval '30 days'
        group by date_trunc('day', ticket.created_at)
        order by date_trunc('day', ticket.created_at) asc`,
      [dashboard.club.id]
    ),
    pool.query<{ id: string; label: string; likes: number; comments: number; created_at: Date | string }>(
      `select post.id,
              coalesce(nullif(post.title, ''), left(post.body, 80), 'Media post') as label,
              count(distinct post_like.id)::int as likes,
              count(distinct comment.id) filter (where comment.status = 'active')::int as comments,
              post.created_at
         from public.university_posts post
         left join public.university_post_likes post_like on post_like.post_id = post.id
         left join public.university_post_comments comment on comment.post_id = post.id
        where post.club_id = $1::uuid and post.actor_type = 'club' and post.status <> 'deleted'
        group by post.id
        order by (count(distinct post_like.id) + count(distinct comment.id)) desc, post.created_at desc
        limit 8`,
      [dashboard.club.id]
    )
  ]);

  return {
    dashboard,
    registrationTrend: trend.rows.map((row) => ({ day: row.day, count: Number(row.count) })),
    eventPerformance: dashboard.events.slice().sort((left, right) => right.approvedCount - left.approvedCount).slice(0, 8).map((event) => ({ id: event.id, title: event.title, registrations: event.approvedCount, attendance: event.checkedInCount, capacity: event.capacity })),
    postPerformance: posts.rows.map((post) => ({ id: post.id, label: post.label, likes: Number(post.likes), comments: Number(post.comments), createdAt: iso(post.created_at) }))
  };
}
