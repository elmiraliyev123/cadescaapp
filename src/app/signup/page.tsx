import { LoginPageClient } from "@/app/login/LoginPageClient";
import { PRIVATE_ROUTE_METADATA } from "@/lib/seo/metadata";

export const dynamic = "force-dynamic";
export const metadata = PRIVATE_ROUTE_METADATA;

export default function SignupPage() {
  return <LoginPageClient initialMode="signup" turnstileSiteKey={process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY || ""} />;
}
