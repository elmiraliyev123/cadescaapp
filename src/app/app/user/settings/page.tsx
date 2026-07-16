import { ProfileSettingsScreen, SocialUnavailableScreen } from "@/components/social/UserSocialScreens";
import { getCurrentStudentContext } from "@/lib/server/social";

export const dynamic = "force-dynamic";

export default async function UserSettingsRoute() {
  try {
    const user = await getCurrentStudentContext();
    return <ProfileSettingsScreen user={user} />;
  } catch (error) {
    console.error("[user_settings] unavailable", {
      reason: error instanceof Error ? error.message : "unknown"
    });
    return <SocialUnavailableScreen />;
  }
}
