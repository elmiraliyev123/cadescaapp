import { ResetPasswordPageClient } from "./ResetPasswordPageClient";
import { PRIVATE_ROUTE_METADATA } from "@/lib/seo/metadata";

export const dynamic = "force-dynamic";
export const metadata = PRIVATE_ROUTE_METADATA;

export default async function ResetPasswordPage({
  searchParams
}: {
  searchParams: Promise<{ email?: string }>;
}) {
  const { email } = await searchParams;
  return <ResetPasswordPageClient initialEmail={email || ""} />;
}
