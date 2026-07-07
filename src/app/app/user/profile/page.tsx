import { headers } from "next/headers";

import { ProfileScreen, SocialUnavailableScreen } from "@/components/social/UserSocialScreens";
import type { DeviceType } from "@/components/screens/WalletPassSection";
import { getCurrentStudentContext, getStudentProfileStats, listOwnProfilePosts } from "@/lib/server/social";

export const dynamic = "force-dynamic";

function detectDevice(userAgent: string): DeviceType {
  const ua = userAgent.toLowerCase();
  if (/iphone|ipad|ipod/.test(ua)) return "ios";
  if (/android/.test(ua)) return "android";
  return "desktop";
}

export default async function UserProfileRoute() {
  try {
    const [headerStore, user] = await Promise.all([headers(), getCurrentStudentContext()]);
    const device = detectDevice(headerStore.get("user-agent") ?? "");
    const [stats, posts] = await Promise.all([
      getStudentProfileStats(user),
      listOwnProfilePosts(user)
    ]);
    return <ProfileScreen user={user} stats={stats} device={device} posts={posts} />;
  } catch (error) {
    console.error("[user_profile] unavailable", {
      reason: error instanceof Error ? error.message : "unknown"
    });
    return <SocialUnavailableScreen message="Campus community is almost ready." />;
  }
}
