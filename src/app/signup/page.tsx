import { LoginPageClient } from "@/app/login/LoginPageClient";

export const dynamic = "force-dynamic";

export default function SignupPage() {
  return <LoginPageClient initialMode="signup" turnstileSiteKey={process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY || ""} />;
}
