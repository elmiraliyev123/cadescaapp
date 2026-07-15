import { headers } from "next/headers";
import { WalletPassSection, type DeviceType } from "@/components/screens/WalletPassSection";
import { getCurrentStudentContext } from "@/lib/server/social";

function detectDevice(userAgent: string): DeviceType {
  const ua = userAgent.toLowerCase();

  if (/iphone|ipad|ipod/.test(ua)) return "ios";
  if (/android/.test(ua)) return "android";

  return "desktop";
}

export default async function UserPassRoute() {
  const headerStore = await headers();
  const userAgent = headerStore.get("user-agent") ?? "";
  const device = detectDevice(userAgent);
  const user = await getCurrentStudentContext();

  return <WalletPassSection device={device} user={user} />;
}
