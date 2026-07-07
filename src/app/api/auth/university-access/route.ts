import { NextResponse } from "next/server";

import { createUniversityAccessRequest, getEmailDomain } from "@/lib/server/universities";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const body = (await request.json().catch(() => ({}))) as {
    email?: string;
    universityName?: string;
    country?: string;
    websiteUrl?: string;
    note?: string;
  };

  const email = body.email?.trim().toLowerCase() || "";
  if (!getEmailDomain(email)) {
    return NextResponse.json({ error: "invalid_university_email" }, { status: 400 });
  }

  try {
    const accessRequest = await createUniversityAccessRequest({
      email,
      universityName: body.universityName,
      country: body.country,
      websiteUrl: body.websiteUrl,
      note: body.note
    });

    return NextResponse.json({ ok: true, request: accessRequest });
  } catch (error) {
    console.error("[university_access_request] create_failed", {
      reason: error instanceof Error ? error.message : "unknown"
    });
    return NextResponse.json({ error: "request_failed" }, { status: 500 });
  }
}
