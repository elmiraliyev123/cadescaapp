import { ActivityScreen, SocialUnavailableScreen } from "@/components/social/UserSocialScreens";
import {
  getCurrentStudentContext,
  isVerifiedUniversityStudent,
  listSocialActivity
} from "@/lib/server/social";

export const dynamic = "force-dynamic";

export default async function UserActivityRoute() {
  try {
    const user = await getCurrentStudentContext();
    const items = isVerifiedUniversityStudent(user) ? await listSocialActivity(user) : [];
    return <ActivityScreen user={user} items={items} />;
  } catch (error) {
    console.error("[user_activity] unavailable", {
      reason: error instanceof Error ? error.message : "unknown"
    });
    return <SocialUnavailableScreen message="Campus community is almost ready." />;
  }
}
