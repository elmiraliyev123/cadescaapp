import { LoginPageClient } from "./LoginPageClient";

export const dynamic = "force-dynamic";

export default function LoginPage() {
  return <LoginPageClient turnstileSiteKey={process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY || ""} />;
}
