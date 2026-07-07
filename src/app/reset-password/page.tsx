import { ResetPasswordPageClient } from "./ResetPasswordPageClient";

export const dynamic = "force-dynamic";

export default async function ResetPasswordPage({
  searchParams
}: {
  searchParams: Promise<{ email?: string }>;
}) {
  const { email } = await searchParams;
  return <ResetPasswordPageClient initialEmail={email || ""} />;
}
