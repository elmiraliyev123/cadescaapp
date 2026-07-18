import {
  downloadEventAsset,
  eventAssetNotFoundResponse,
  eventAssetResponse,
  getPublicEventCoverPath
} from "@/lib/server/eventAssets";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(_request: Request, { params }: { params: Promise<{ eventId: string }> }) {
  const { eventId } = await params;
  const access = await getPublicEventCoverPath(eventId).catch(() => null);
  if (!access) return eventAssetNotFoundResponse();
  const asset = await downloadEventAsset(access.path).catch(() => null);
  return asset ? eventAssetResponse(asset, access.isPublic) : eventAssetNotFoundResponse();
}
