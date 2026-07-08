import assert from "node:assert/strict";

import { assertImageAllowed } from "../src/lib/server/imageModeration";

const ORIGINAL_FETCH = globalThis.fetch;
const ENV_KEYS = [
  "CLOUDFLARE_ACCOUNT_ID",
  "CLOUDFLARE_API_TOKEN",
  "CLOUDFLARE_AUTH_TOKEN",
  "CLOUDFLARE_IMAGE_MODERATION_REQUIRED",
  "CLOUDFLARE_IMAGE_MODERATION_TOKEN",
  "CLOUDFLARE_IMAGE_MODERATION_URL"
] as const;
const ORIGINAL_ENV = Object.fromEntries(ENV_KEYS.map((key) => [key, process.env[key]]));
const ONE_PIXEL_PNG = "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=";

function resetEnv() {
  for (const key of ENV_KEYS) {
    const value = ORIGINAL_ENV[key];
    if (typeof value === "string") {
      process.env[key] = value;
    } else {
      delete process.env[key];
    }
  }
}

function pngFile() {
  return new File([Buffer.from(ONE_PIXEL_PNG, "base64")], "safe.png", { type: "image/png" });
}

function emptyImageFile() {
  return new File([new Uint8Array()], "empty.png", { type: "image/png" });
}

function mockWorker(response: Response) {
  let calls = 0;
  globalThis.fetch = (async (_input: RequestInfo | URL, init?: RequestInit) => {
    calls += 1;
    const body = JSON.parse(String(init?.body || "{}")) as Record<string, unknown>;
    assert.equal(typeof body.imageBase64, "string");
    assert.ok(String(body.imageBase64).length > 0);
    return response.clone();
  }) as typeof fetch;
  return () => calls;
}

async function expectErrorMessage(name: string, run: () => Promise<void>, message: string) {
  try {
    await run();
  } catch (error) {
    assert.equal(error instanceof Error ? error.message : "unknown", message);
    console.log(`ok ${name}`);
    return;
  }

  throw new Error(`${name} did not throw`);
}

async function testSafeGeneratedImage() {
  resetEnv();
  process.env.CLOUDFLARE_IMAGE_MODERATION_REQUIRED = "true";
  process.env.CLOUDFLARE_IMAGE_MODERATION_URL = "https://moderation.test/worker";
  const calls = mockWorker(new Response(JSON.stringify({ allowed: true, reason: "safe", labels: ["safe"] }), { status: 200 }));

  await assertImageAllowed(pngFile(), "post");
  assert.equal(calls(), 1);
  console.log("ok safe generated image");
}

async function testInvalidImageInput() {
  resetEnv();
  process.env.CLOUDFLARE_IMAGE_MODERATION_REQUIRED = "true";
  process.env.CLOUDFLARE_IMAGE_MODERATION_URL = "https://moderation.test/worker";
  const calls = mockWorker(new Response(JSON.stringify({ allowed: true }), { status: 200 }));

  await expectErrorMessage(
    "invalid image input",
    () => assertImageAllowed(emptyImageFile(), "post"),
    "image_moderation_invalid_input"
  );
  assert.equal(calls(), 0);
}

async function testUnsafeImageDecision() {
  resetEnv();
  process.env.CLOUDFLARE_IMAGE_MODERATION_REQUIRED = "true";
  process.env.CLOUDFLARE_IMAGE_MODERATION_URL = "https://moderation.test/worker";
  const calls = mockWorker(
    new Response(JSON.stringify({ allowed: false, reason: "policy", labels: ["explicit"] }), { status: 200 })
  );

  await expectErrorMessage(
    "unsafe image decision",
    () => assertImageAllowed(pngFile(), "post"),
    "image_rejected"
  );
  assert.equal(calls(), 1);
}

async function testCloudflareApiFailure() {
  resetEnv();
  process.env.CLOUDFLARE_IMAGE_MODERATION_REQUIRED = "true";
  process.env.CLOUDFLARE_IMAGE_MODERATION_URL = "https://moderation.test/worker";
  const calls = mockWorker(new Response(JSON.stringify({ error: "unavailable" }), { status: 503 }));

  await expectErrorMessage(
    "cloudflare api failure",
    () => assertImageAllowed(pngFile(), "avatar"),
    "image_moderation_failed"
  );
  assert.equal(calls(), 1);
}

async function main() {
  try {
    await testSafeGeneratedImage();
    await testInvalidImageInput();
    await testUnsafeImageDecision();
    await testCloudflareApiFailure();
  } finally {
    globalThis.fetch = ORIGINAL_FETCH;
    resetEnv();
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
