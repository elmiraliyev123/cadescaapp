import { ExploreScreen, SocialUnavailableScreen } from "@/components/social/UserSocialScreens";
import {
  getCurrentStudentContext,
  isVerifiedUniversityStudent,
  listExplorePosts
} from "@/lib/server/social";
import { canAccessClient } from "@/lib/auth/clientAccessPolicy";
import { getBilmatchUrl } from "@/lib/appConfig";
export const dynamic = "force-dynamic";

export default async function UserExploreRoute() {
  try {
    const user = await getCurrentStudentContext();
    const isLocalPreview = process.env.NODE_ENV === "development" && user?.id === "user_mock";
    const posts = isVerifiedUniversityStudent(user) && !isLocalPreview
      ? await listExplorePosts(user, 6)
      : [];
    const matchMeAccess = canAccessClient(user, "bilmatch");
    const bilmatchStart = new URL("/auth/cadesca/start", getBilmatchUrl());
    bilmatchStart.searchParams.set("return_to", "/");
    return (
      <ExploreScreen
        user={user}
        posts={posts}
        matchMeEligible={matchMeAccess.allowed}
        matchMeHref={matchMeAccess.allowed ? bilmatchStart.toString() : undefined}
      />
    );
  } catch (error) {
    console.error("[user_explore] unavailable", {
      reason: error instanceof Error ? error.message : "unknown"
    });
    return <SocialUnavailableScreen />;
  }
}
