import assert from "node:assert/strict";

import { config as loadDotenv } from "dotenv";

import { assertImageAllowed } from "../src/lib/server/imageModeration";

const args = process.argv.slice(2);
const envFileArg = args.find((arg) => arg.startsWith("--env-file="));
if (envFileArg) {
  loadDotenv({ path: envFileArg.slice("--env-file=".length), override: true, quiet: true });
}

const ORIGINAL_FETCH = globalThis.fetch;
const ENV_KEYS = [
  "CLOUDFLARE_ACCOUNT_ID",
  "CLOUDFLARE_API_TOKEN",
  "CLOUDFLARE_AUTH_TOKEN",
  "CLOUDFLARE_IMAGE_MODERATION_MODEL",
  "CLOUDFLARE_IMAGE_MODERATION_REQUIRED",
  "CLOUDFLARE_IMAGE_MODERATION_TIMEOUT_MS",
  "CLOUDFLARE_IMAGE_MODERATION_TOKEN",
  "CLOUDFLARE_IMAGE_MODERATION_URL",
  "CLOUDFLARE_WORKERS_AI_ACCEPT_LICENSE_ON_403"
] as const;
const ORIGINAL_ENV = Object.fromEntries(ENV_KEYS.map((key) => [key, process.env[key]]));
const ONE_PIXEL_PNG = "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=";
const ONE_PIXEL_JPEG = "/9j/4AAQSkZJRgABAQAAAQABAAD/2wBDAP//////////////////////////////////////////////////////////////////////////////////////2wBDAf//////////////////////////////////////////////////////////////////////////////////////wAARCAABAAEDASIAAhEBAxEB/8QAFQABAQAAAAAAAAAAAAAAAAAAAAX/xAAUEAEAAAAAAAAAAAAAAAAAAAAA/9oADAMBAAIQAxAAAAH/xAAUEAEAAAAAAAAAAAAAAAAAAAAA/9oACAEBAAEFAqf/xAAUEQEAAAAAAAAAAAAAAAAAAAAA/9oACAEDAQE/ASP/xAAUEQEAAAAAAAAAAAAAAAAAAAAA/9oACAECAQE/ASP/xAAUEAEAAAAAAAAAAAAAAAAAAAAA/9oACAEBAAY/Ap//xAAUEAEAAAAAAAAAAAAAAAAAAAAA/9oACAEBAAE/IX//2gAMAwEAAgADAAAAEP/EABQRAQAAAAAAAAAAAAAAAAAAABD/2gAIAQMBAT8QH//EABQRAQAAAAAAAAAAAAAAAAAAABD/2gAIAQIBAT8QH//EABQQAQAAAAAAAAAAAAAAAAAAABD/2gAIAQEAAT8QH//Z";
const WORKERS_AI_MODEL = "@cf/meta/llama-3.2-11b-vision-instruct";

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

function jpegFile() {
  return new File([Buffer.from(ONE_PIXEL_JPEG, "base64")], "safe.jpg", { type: "image/jpeg" });
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

function mockWorkersAi(responses: Response[]) {
  const calls: Array<{ url: string; body: Record<string, unknown> }> = [];
  globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
    const response = responses[calls.length];
    const body = JSON.parse(String(init?.body || "{}")) as Record<string, unknown>;
    calls.push({ url: String(input), body });
    if (!response) throw new Error("unexpected_fetch_call");
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

async function testWorkersAiRestSafeJpeg() {
  resetEnv();
  process.env.CLOUDFLARE_IMAGE_MODERATION_REQUIRED = "true";
  process.env.CLOUDFLARE_ACCOUNT_ID = "test-account";
  process.env.CLOUDFLARE_API_TOKEN = "test-token";
  process.env.CLOUDFLARE_IMAGE_MODERATION_MODEL = WORKERS_AI_MODEL;
  const calls = mockWorkersAi([
    new Response(JSON.stringify({
      success: true,
      result: { response: "{\"allowed\":true,\"reason\":\"safe\",\"labels\":[\"safe\"]}" }
    }), { status: 200 })
  ]);

  await assertImageAllowed(jpegFile(), "post");
  const request = calls()[0];
  assert.equal(calls().length, 1);
  assert.equal(request.url, `https://api.cloudflare.com/client/v4/accounts/test-account/ai/run/${WORKERS_AI_MODEL}`);
  assert.equal(typeof request.body.image, "string");
  assert.ok(String(request.body.image).startsWith("data:image/jpeg;base64,"));
  assert.equal(request.body.prompt && typeof request.body.prompt, "string");
  console.log("ok workers ai rest safe jpeg");
}

async function testWorkersAiRestLicenseRetry() {
  resetEnv();
  process.env.CLOUDFLARE_IMAGE_MODERATION_REQUIRED = "true";
  process.env.CLOUDFLARE_ACCOUNT_ID = "test-account";
  process.env.CLOUDFLARE_API_TOKEN = "test-token";
  process.env.CLOUDFLARE_IMAGE_MODERATION_MODEL = WORKERS_AI_MODEL;
  const calls = mockWorkersAi([
    new Response(JSON.stringify({
      success: false,
      errors: [{ code: 10000, message: "Please agree to Meta License and Acceptable Use Policy with prompt agree." }]
    }), { status: 403 }),
    new Response(JSON.stringify({
      errors: [{
        code: 5016,
        message: "AiError: Model Agreement: Thank you for agreeing to this model's terms. You may now use the model."
      }],
      success: false,
      result: {},
      messages: []
    }), { status: 403 }),
    new Response(JSON.stringify({
      success: true,
      result: { response: "{\"allowed\":true,\"reason\":\"safe\",\"labels\":[\"safe\"]}" }
    }), { status: 200 })
  ]);

  await assertImageAllowed(jpegFile(), "avatar");
  assert.equal(calls().length, 3);
  assert.equal(calls()[1].body.prompt, "agree");
  assert.ok(!("image" in calls()[1].body));
  assert.ok(String(calls()[2].body.image).startsWith("data:image/jpeg;base64,"));
  console.log("ok workers ai rest license retry");
}

async function testWorkersAiAuthFailure() {
  resetEnv();
  process.env.CLOUDFLARE_IMAGE_MODERATION_REQUIRED = "true";
  process.env.CLOUDFLARE_ACCOUNT_ID = "test-account";
  process.env.CLOUDFLARE_API_TOKEN = "test-token";
  process.env.CLOUDFLARE_IMAGE_MODERATION_MODEL = WORKERS_AI_MODEL;
  const calls = mockWorkersAi([
    new Response(JSON.stringify({
      success: false,
      errors: [{ code: 10001, message: "Authentication error: token missing Workers AI permissions." }]
    }), { status: 403 })
  ]);

  await expectErrorMessage(
    "workers ai auth failure",
    () => assertImageAllowed(jpegFile(), "post"),
    "image_moderation_failed"
  );
  assert.equal(calls().length, 1);
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

async function testLiveWorkersAiJpeg() {
  resetEnv();
  if (!args.includes("--live")) return;
  if (!process.env.CLOUDFLARE_ACCOUNT_ID || !(process.env.CLOUDFLARE_API_TOKEN || process.env.CLOUDFLARE_AUTH_TOKEN)) {
    throw new Error("Live moderation test requires CLOUDFLARE_ACCOUNT_ID and CLOUDFLARE_API_TOKEN or CLOUDFLARE_AUTH_TOKEN.");
  }
  delete process.env.CLOUDFLARE_IMAGE_MODERATION_URL;
  process.env.CLOUDFLARE_IMAGE_MODERATION_REQUIRED = "true";
  process.env.CLOUDFLARE_IMAGE_MODERATION_MODEL ||= WORKERS_AI_MODEL;

  await assertImageAllowed(jpegFile(), "post");
  console.log("ok live workers ai jpeg");
}

async function main() {
  try {
    await testSafeGeneratedImage();
    await testInvalidImageInput();
    await testUnsafeImageDecision();
    await testCloudflareApiFailure();
    await testWorkersAiRestSafeJpeg();
    await testWorkersAiRestLicenseRetry();
    await testWorkersAiAuthFailure();
    await testLiveWorkersAiJpeg();
  } finally {
    globalThis.fetch = ORIGINAL_FETCH;
    resetEnv();
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
