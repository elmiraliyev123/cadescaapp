import { RequestUniversityPageClient } from "./RequestUniversityPageClient";
import { PRIVATE_ROUTE_METADATA } from "@/lib/seo/metadata";

export const dynamic = "force-dynamic";
export const metadata = PRIVATE_ROUTE_METADATA;

export default function RequestUniversityPage() {
  return <RequestUniversityPageClient />;
}
