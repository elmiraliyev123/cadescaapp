import { loadReceiptForAuthorizedViewer } from "@/lib/server/eventTickets";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

function notFound() {
  return new Response("Not found", {
    status: 404,
    headers: {
      "cache-control": "no-store",
      "content-type": "text/plain; charset=utf-8",
      "x-content-type-options": "nosniff",
      "x-robots-tag": "noindex"
    }
  });
}

export async function GET(_request: Request, { params }: { params: Promise<{ ticketId: string }> }) {
  const { ticketId } = await params;
  const receipt = await loadReceiptForAuthorizedViewer(ticketId).catch(() => null);
  if (!receipt) return notFound();
  return new Response(receipt.body, {
    status: 200,
    headers: {
      "cache-control": "private, no-store",
      "content-disposition": "inline",
      "content-length": String(receipt.size),
      "content-type": receipt.contentType,
      "x-content-type-options": "nosniff",
      "x-frame-options": "SAMEORIGIN",
      "x-robots-tag": "noindex"
    }
  });
}

