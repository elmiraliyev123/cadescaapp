import {
  downloadPublicImage,
  publicImageNotFoundResponse,
  publicImageResponse
} from "@/lib/server/publicAssets";
import { getPublicProfileAvatarObjectPath } from "@/lib/server/publicProfiles";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ username: string }> }
) {
  const { username } = await params;
  const objectPath = await getPublicProfileAvatarObjectPath(username);
  if (!objectPath) return publicImageNotFoundResponse();

  const asset = await downloadPublicImage("avatars", objectPath);
  return asset ? publicImageResponse(asset) : publicImageNotFoundResponse();
}
