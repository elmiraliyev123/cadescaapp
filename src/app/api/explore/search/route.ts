import { NextResponse } from "next/server";

import { ExploreSearchError, searchExplore } from "@/lib/server/exploreSearch";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const query = new URL(request.url).searchParams.get("q") || "";
  try {
    return NextResponse.json(
      { query: query.trim(), results: await searchExplore(query) },
      { headers: { "cache-control": "private, no-store" } }
    );
  } catch (error) {
    if (error instanceof ExploreSearchError) {
      return NextResponse.json({ error: error.code }, { status: error.status });
    }
    console.error("[explore_search] failed", { reason: error instanceof Error ? error.name : "unknown" });
    return NextResponse.json({ error: "search_unavailable" }, { status: 503 });
  }
}

