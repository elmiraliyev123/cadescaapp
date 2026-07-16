import {
  downloadPublicImage,
  publicImageNotFoundResponse,
  publicImageResponse
} from "@/lib/server/publicAssets";
import { getPublicPostImageObjectPath } from "@/lib/server/publicPosts";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ postId: string }> }
) {
  const { postId } = await params;
  const objectPath = await getPublicPostImageObjectPath(postId);
  if (!objectPath) return publicImageNotFoundResponse();

  const asset = await downloadPublicImage("social-images", objectPath);
  return asset ? publicImageResponse(asset) : publicImageNotFoundResponse();
}
