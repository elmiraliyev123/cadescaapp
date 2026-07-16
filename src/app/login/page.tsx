import { LoginPageClient } from "./LoginPageClient";
import { PRIVATE_ROUTE_METADATA } from "@/lib/seo/metadata";

export const dynamic = "force-dynamic";
export const metadata = PRIVATE_ROUTE_METADATA;

export default function LoginPage() {
  return <LoginPageClient turnstileSiteKey={process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY || ""} />;
}
