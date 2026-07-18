import "server-only";

export const MAX_STUDENT_CLUB_FORM_BYTES = 14 * 1024 * 1024;
export const MAX_STUDENT_CLUB_JSON_BYTES = 16 * 1024;

export class StudentClubBodyTooLargeError extends Error {}

export async function readLimitedStudentClubFormData(request: Request) {
  const contentLength = request.headers.get("content-length");
  if (contentLength) {
    const declared = Number(contentLength);
    if (!Number.isSafeInteger(declared) || declared < 0 || declared > MAX_STUDENT_CLUB_FORM_BYTES) {
      throw new StudentClubBodyTooLargeError();
    }
  }
  if (!request.body) return request.formData();

  let received = 0;
  const limitedBody = request.body.pipeThrough(new TransformStream<Uint8Array, Uint8Array>({
    transform(chunk, controller) {
      received += chunk.byteLength;
      if (received > MAX_STUDENT_CLUB_FORM_BYTES) {
        controller.error(new StudentClubBodyTooLargeError());
        return;
      }
      controller.enqueue(chunk);
    }
  }));
  const init = {
    method: request.method,
    headers: request.headers,
    body: limitedBody,
    duplex: "half"
  } satisfies RequestInit & { duplex: "half" };

  try {
    return await new Request(request.url, init).formData();
  } catch (error) {
    if (received > MAX_STUDENT_CLUB_FORM_BYTES) throw new StudentClubBodyTooLargeError();
    throw error;
  }
}

export async function readLimitedStudentClubJson(request: Request) {
  const contentLength = request.headers.get("content-length");
  if (contentLength) {
    const declared = Number(contentLength);
    if (!Number.isSafeInteger(declared) || declared < 0 || declared > MAX_STUDENT_CLUB_JSON_BYTES) {
      throw new StudentClubBodyTooLargeError();
    }
  }
  if (!request.body) return null;

  let received = 0;
  const decoder = new TextDecoder();
  let body = "";
  const reader = request.body.getReader();
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      received += value.byteLength;
      if (received > MAX_STUDENT_CLUB_JSON_BYTES) throw new StudentClubBodyTooLargeError();
      body += decoder.decode(value, { stream: true });
    }
    body += decoder.decode();
    return JSON.parse(body) as unknown;
  } finally {
    reader.releaseLock();
  }
}
