import { NextResponse } from "next/server";

import { publishScheduledClubPosts } from "@/lib/server/clubPosts";

export const runtime = "nodejs";

export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret || request.headers.get("authorization") !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  try {
    return NextResponse.json({ ok: true, published: await publishScheduledClubPosts() });
  } catch (error) {
    console.error("[club_posts_cron] publish_failed", { reason: error instanceof Error ? error.name : "unknown" });
    return NextResponse.json({ error: "publish_failed" }, { status: 500 });
  }
}
