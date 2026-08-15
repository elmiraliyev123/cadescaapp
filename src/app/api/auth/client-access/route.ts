import { NextResponse } from "next/server";

import { canAccessClient, type KnownOAuthClientId } from "@/lib/auth/clientAccessPolicy";
import { getCurrentStudentContext } from "@/lib/server/social";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function knownClient(value: string | null): value is KnownOAuthClientId {
  return value === "bilmatch" || value === "studentclub";
}

export async function GET(request: Request) {
  const clientId = new URL(request.url).searchParams.get("client_id");
  if (!knownClient(clientId)) {
    return NextResponse.json({ error: "unknown_client" }, { status: 404 });
  }

  const decision = canAccessClient(await getCurrentStudentContext(), clientId);
  return NextResponse.json(
    { clientId, eligible: decision.allowed, reason: decision.reason },
    { headers: { "cache-control": "private, no-store" } }
  );
}

