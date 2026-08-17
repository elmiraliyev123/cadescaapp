import { readFile } from "node:fs/promises";
import { spawnSync } from "node:child_process";

const session = process.argv[2];
if (!session) throw new Error("Playwright session name is required.");
const state = JSON.parse(await readFile("output/playwright/club-upload-qa-state.json", "utf8"));
const cookie = state.cookies?.find((item) => item.name === "cadesca_user_session");
if (!cookie?.value) throw new Error("QA session cookie is missing.");

const result = spawnSync("npx", [
  "--yes",
  "playwright@latest",
  "cli",
  `-s=${session}`,
  "cookie-set",
  cookie.name,
  cookie.value,
  "--domain",
  "studentclub.cadesca.com",
  "--path",
  "/",
  "--expires",
  String(cookie.expires),
  "--httpOnly",
  "--secure",
  "--sameSite",
  "Lax"
], { encoding: "utf8", stdio: ["ignore", "pipe", "inherit"] });

if (result.error) throw result.error;
if (result.status !== 0) throw new Error(`Could not load QA browser session (${result.status}).`);
if (result.stdout) console.log(result.stdout.replaceAll(cookie.value, "<redacted>").trim());
console.log(JSON.stringify({ ok: true, session }));
