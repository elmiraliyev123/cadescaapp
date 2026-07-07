import { notFound } from "next/navigation";

import { PublicProfileScreen } from "@/components/social/UserSocialScreens";
import { getPublicProfileByUsername, type PublicStudentProfile } from "@/lib/server/social";

export const dynamic = "force-dynamic";

export default async function PublicUserProfileRoute({
  params
}: {
  params: Promise<{ username: string }>;
}) {
  const { username } = await params;
  let profile: PublicStudentProfile | null = null;

  try {
    profile = await getPublicProfileByUsername(username);
  } catch (error) {
    console.error("[public_profile] unavailable", {
      reason: error instanceof Error ? error.message : "unknown"
    });
  }

  if (!profile) notFound();
  return <PublicProfileScreen profile={profile} />;
}
