import {
  downloadEventAsset,
  eventAssetNotFoundResponse,
  eventAssetResponse,
  getPublicClubLogoPath
} from "@/lib/server/eventAssets";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(_request: Request, { params }: { params: Promise<{ clubId: string }> }) {
  const { clubId } = await params;
  const access = await getPublicClubLogoPath(clubId).catch(() => null);
  if (!access) return eventAssetNotFoundResponse();
  const asset = await downloadEventAsset(access.path).catch(() => null);
  return asset ? eventAssetResponse(asset, access.isPublic) : eventAssetNotFoundResponse();
}
