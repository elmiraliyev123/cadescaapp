import { handleVerifyEmailRequest } from "@/lib/server/verificationRouteHandlers";

export const runtime = "nodejs";

export async function POST(request: Request) {
  return handleVerifyEmailRequest(request);
}
