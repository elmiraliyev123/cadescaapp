import { requireAdminSession } from "@/lib/server/adminAuth";
import { downloadClubVerificationDocumentForAdmin } from "@/lib/server/studentClubs";

export const runtime = "nodejs";

export async function GET(_request: Request, { params }: { params: Promise<{ clubId: string }> }) {
  try {
    await requireAdminSession();
  } catch {
    return new Response("Unauthorized", { status: 401 });
  }
  const { clubId } = await params;
  const document = await downloadClubVerificationDocumentForAdmin(clubId);
  if (!document) return new Response("Not found", { status: 404 });
  return new Response(document.body, {
    status: 200,
    headers: {
      "cache-control": "private, no-store",
      "content-disposition": `attachment; filename="${document.filename}"`,
      "content-length": String(document.size),
      "content-type": "application/octet-stream",
      "x-content-type-options": "nosniff",
      "x-frame-options": "DENY",
      "x-robots-tag": "noindex"
    }
  });
}
