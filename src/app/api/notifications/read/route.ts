import { NextResponse } from "next/server";

import { getCurrentStudentContext } from "@/lib/server/social";
import { getReadyPool } from "@/lib/server/users";

export const runtime = "nodejs";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export async function PATCH(request: Request) {
  const origin = request.headers.get("origin");
  if (origin && origin !== new URL(request.url).origin) {
    return NextResponse.json({ error: "request_not_allowed" }, { status: 403 });
  }
  const user = await getCurrentStudentContext();
  if (!user || user.status !== "active") return NextResponse.json({ error: "authentication_required" }, { status: 401 });
  const payload = await request.json().catch(() => null) as { ids?: unknown } | null;
  const ids = Array.isArray(payload?.ids)
    ? Array.from(new Set(payload.ids.filter((id): id is string => typeof id === "string" && UUID.test(id)))).slice(0, 100)
    : [];
  if (!ids.length) return NextResponse.json({ ok: true, updated: 0 });
  const pool = await getReadyPool();
  const result = await pool.query(
    `update public.notifications
        set read_at = coalesce(read_at, now())
      where user_id = $1
        and id = any($2::uuid[])`,
    [user.id, ids]
  );
  return NextResponse.json({ ok: true, updated: result.rowCount || 0 }, { headers: { "cache-control": "no-store" } });
}
