import { CreatePostScreen, SocialUnavailableScreen } from "@/components/social/UserSocialScreens";
import { getCurrentStudentContext } from "@/lib/server/social";

export const dynamic = "force-dynamic";

export default async function UserCreateRoute() {
  try {
    const user = await getCurrentStudentContext();
    return <CreatePostScreen user={user} />;
  } catch (error) {
    console.error("[user_create] unavailable", {
      reason: error instanceof Error ? error.message : "unknown"
    });
    return <SocialUnavailableScreen message="Campus community is almost ready." />;
  }
}
