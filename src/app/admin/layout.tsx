import { PRIVATE_ROUTE_METADATA } from "@/lib/seo/metadata";

export const metadata = PRIVATE_ROUTE_METADATA;

export default function AdminRouteLayout({
  children
}: {
  children: React.ReactNode;
}) {
  return children;
}
