import { NextResponse } from "next/server";

import { findActiveUniversityByEmail, getEmailDomain } from "@/lib/server/universities";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const body = (await request.json().catch(() => ({}))) as { email?: string };
  const email = body.email?.trim().toLowerCase() || "";
  const emailDomain = getEmailDomain(email);

  if (!emailDomain) {
    return NextResponse.json({ error: "invalid_email" }, { status: 400 });
  }

  const university = await findActiveUniversityByEmail(email);
  if (!university) {
    return NextResponse.json({ ok: false, status: "unsupported", emailDomain }, { status: 200 });
  }

  return NextResponse.json({
    ok: true,
    status: "supported",
    emailDomain,
    university: {
      id: university.id,
      name: university.name,
      slug: university.slug,
      emailDomains: university.emailDomains
    }
  });
}
