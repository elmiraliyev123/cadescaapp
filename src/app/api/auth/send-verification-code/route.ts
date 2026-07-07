import { handleSendVerificationCodeRequest } from "@/lib/server/verificationRouteHandlers";

export const runtime = "nodejs";

export async function POST(request: Request) {
  return handleSendVerificationCodeRequest(request);
}
