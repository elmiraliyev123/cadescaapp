import { mkdir, writeFile } from "node:fs/promises";

const response = await fetch("https://studentclub.cadesca.com/api/internal/student-club-upload-check", {
  method: "POST",
  headers: {
    "content-type": "application/json",
    "x-cadesca-verification": "SCUV-20260816-k9pX4vw7dQ2nL6"
  },
  body: JSON.stringify({ action: "provision_browser_session" })
});
const body = await response.json();
if (!response.ok || !body.ok) throw new Error(`QA session provision failed: ${body.error || response.status}`);
const setCookie = response.headers.get("set-cookie");
if (!setCookie) throw new Error("QA session cookie was not returned.");
const [nameValue] = setCookie.split(";");
const separator = nameValue.indexOf("=");
if (separator < 1) throw new Error("QA session cookie was malformed.");

await mkdir("output/playwright", { recursive: true });
await writeFile("output/playwright/club-upload-qa-state.json", JSON.stringify({
  cookies: [{
    name: nameValue.slice(0, separator),
    value: nameValue.slice(separator + 1),
    domain: ".cadesca.com",
    path: "/",
    expires: Math.floor(Date.now() / 1000) + 60 * 60,
    httpOnly: true,
    secure: true,
    sameSite: "Lax"
  }],
  origins: []
}, null, 2));
await writeFile("output/playwright/club-upload-qa-metadata.json", JSON.stringify({
  userId: body.userId,
  universityId: body.universityId,
  universityName: body.universityName
}, null, 2));
console.log(JSON.stringify({ ok: true, userId: body.userId, universityName: body.universityName }));
