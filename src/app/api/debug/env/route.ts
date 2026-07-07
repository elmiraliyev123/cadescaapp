import { NextResponse } from "next/server";

export const runtime = "nodejs";

export async function GET() {
  if (process.env.DEBUG_ENV_STATUS !== "true") {
    return new NextResponse("Not Found", { status: 404 });
  }

  const info = {
    hasResendApiKey: Boolean(process.env.RESEND_API_KEY),
    resendKeyLooksValid: Boolean(process.env.RESEND_API_KEY?.startsWith("re_")),
    hasEmailFrom: Boolean(process.env.EMAIL_FROM),
    emailFromLooksValid: Boolean(process.env.EMAIL_FROM?.includes("@")),
    hasDatabaseUrl: Boolean(process.env.DATABASE_URL),
    databaseUrlLooksValid: Boolean(process.env.DATABASE_URL?.startsWith("postgresql://") && !process.env.DATABASE_URL?.includes("[YOUR-PASSWORD]")),
    hasAuthSecret: Boolean(process.env.AUTH_SECRET),
    authSecretLooksValid: Boolean(process.env.AUTH_SECRET && process.env.AUTH_SECRET.length >= 32),
    nodeEnv: process.env.NODE_ENV,
    vercelEnv: process.env.VERCEL_ENV
  };

  return NextResponse.json(info);
}
