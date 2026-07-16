import { HomeFeedScreen, SocialUnavailableScreen } from "@/components/social/UserSocialScreens";
import {
  getCurrentStudentContext,
  isVerifiedUniversityStudent,
  listUniversityFeed
} from "@/lib/server/social";
export const dynamic = "force-dynamic";

export default async function UserHomeRoute() {
  try {
    const user = await getCurrentStudentContext();
    const isLocalPreview = process.env.NODE_ENV === "development" && user?.id === "user_mock";
    const posts = isVerifiedUniversityStudent(user) && !isLocalPreview
      ? await listUniversityFeed(user)
      : [];
    return <HomeFeedScreen user={user} posts={posts} />;
  } catch (error) {
    console.error("[user_home] social_feed_unavailable", {
      reason: error instanceof Error ? error.message : "unknown"
    });
    return <SocialUnavailableScreen />;
  }
}
