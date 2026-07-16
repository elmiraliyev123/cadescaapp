import { ExploreScreen, SocialUnavailableScreen } from "@/components/social/UserSocialScreens";
import {
  getCurrentStudentContext,
  isVerifiedUniversityStudent,
  listExplorePosts
} from "@/lib/server/social";
export const dynamic = "force-dynamic";

export default async function UserExploreRoute() {
  try {
    const user = await getCurrentStudentContext();
    const isLocalPreview = process.env.NODE_ENV === "development" && user?.id === "user_mock";
    const posts = isVerifiedUniversityStudent(user) && !isLocalPreview
      ? await listExplorePosts(user)
      : [];
    return <ExploreScreen user={user} posts={posts} />;
  } catch (error) {
    console.error("[user_explore] unavailable", {
      reason: error instanceof Error ? error.message : "unknown"
    });
    return <SocialUnavailableScreen />;
  }
}
