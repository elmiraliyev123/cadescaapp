import { downloadCurrentClubMediaAsset } from "@/lib/server/clubMedia";

export const runtime = "nodejs";

export async function GET(_request: Request, { params }: { params: Promise<{ assetId: string }> }) {
  const { assetId } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(assetId)) return new Response("Not found", { status: 404 });
  const asset = await downloadCurrentClubMediaAsset(assetId);
  if (!asset) return new Response("Not found", { status: 404 });
  return new Response(asset.bytes, { headers: { "content-type": asset.contentType, "cache-control": "private, max-age=300", "x-content-type-options": "nosniff" } });
}
