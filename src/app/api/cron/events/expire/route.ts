import { NextResponse } from "next/server";

import { expireEventReservations } from "@/lib/server/eventTickets";
import { publishScheduledClubPosts } from "@/lib/server/clubPosts";
import { cleanupExpiredStudentClubStagedFiles } from "@/lib/server/studentClubUploads";

export const runtime = "nodejs";

export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET;
  const authorization = request.headers.get("authorization");
  if (!secret || authorization !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  try {
    const [expired, publishedPosts, removedStagedUploads] = await Promise.all([
      expireEventReservations(null),
      publishScheduledClubPosts(),
      cleanupExpiredStudentClubStagedFiles()
    ]);
    return NextResponse.json({ ok: true, expired, publishedPosts, removedStagedUploads });
  } catch (error) {
    console.error("[events_cron] expiration_failed", {
      reason: error instanceof Error ? error.name : "unknown"
    });
    return NextResponse.json({ error: "expiration_failed" }, { status: 500 });
  }
}
