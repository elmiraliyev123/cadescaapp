import { ClubApplicationScreen } from "@/components/clubs/ClubApplicationScreen";
import { PRIVATE_ROUTE_METADATA } from "@/lib/seo/metadata";
import { listActiveUniversities } from "@/lib/server/universities";

export const metadata = {
  ...PRIVATE_ROUTE_METADATA,
  title: "Student Club Application | Cadesca"
};
export const dynamic = "force-dynamic";

export default async function StudentClubApplicationPage() {
  const universities = await listActiveUniversities().catch(() => []);
  return <ClubApplicationScreen universities={universities.map(({ id, name }) => ({ id, name }))} />;
}
