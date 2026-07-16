import { ForgotPasswordPageClient } from "./ForgotPasswordPageClient";
import { PRIVATE_ROUTE_METADATA } from "@/lib/seo/metadata";

export const dynamic = "force-dynamic";
export const metadata = PRIVATE_ROUTE_METADATA;

export default function ForgotPasswordPage() {
  return <ForgotPasswordPageClient />;
}
