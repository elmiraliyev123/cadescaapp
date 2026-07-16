import type { Metadata } from "next";

export const PRIVATE_ROUTE_METADATA: Metadata = {
  robots: {
    index: false,
    follow: false,
    googleBot: {
      index: false,
      follow: false
    }
  }
};

function compactText(value: string) {
  return value.replace(/\s+/g, " ").trim();
}

function truncateAtWord(value: string, maximumLength: number) {
  if (value.length <= maximumLength) return value;

  const candidate = value.slice(0, maximumLength - 1).trimEnd();
  const lastSpace = candidate.lastIndexOf(" ");
  const truncated = lastSpace >= Math.floor(maximumLength * 0.72)
    ? candidate.slice(0, lastSpace)
    : candidate;

  return `${truncated}…`;
}

export function publicProfileDescription(input: {
  displayName: string;
  universityName: string;
}) {
  return `${input.displayName}’s verified ${input.universityName} profile on Cadesca. View public campus posts and profile information.`;
}

export function publicPostDescription(body: string) {
  const compact = compactText(body);
  if (!compact) {
    return "A public campus post from a verified university student on Cadesca.";
  }

  return truncateAtWord(compact, 158);
}

export function publicPostTitle(displayName: string, body: string) {
  const compact = compactText(body);
  if (!compact) return `${displayName} shared a photo on Cadesca`;

  return `${displayName} on Cadesca: “${truncateAtWord(compact, 54)}”`;
}

const OFFICIAL_SOCIAL_HOSTS = new Set([
  "instagram.com",
  "www.instagram.com",
  "linkedin.com",
  "www.linkedin.com",
  "tiktok.com",
  "www.tiktok.com"
]);

export function parseOfficialSocialUrls(value: string | undefined) {
  const urls = new Set<string>();

  for (const candidate of (value || "").split(",")) {
    const trimmed = candidate.trim();
    if (!trimmed) continue;

    try {
      const url = new URL(trimmed);
      if (url.protocol !== "https:" || !OFFICIAL_SOCIAL_HOSTS.has(url.hostname.toLowerCase())) {
        continue;
      }

      url.hash = "";
      urls.add(url.toString().replace(/\/+$/, ""));
    } catch {
      // Invalid or unrelated values are intentionally omitted from sameAs.
    }
  }

  return Array.from(urls);
}
