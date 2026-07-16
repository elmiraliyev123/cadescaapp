import assert from "node:assert/strict";

import {
  parseOfficialSocialUrls,
  publicPostDescription,
  publicPostTitle,
  publicProfileDescription
} from "../src/lib/seo/metadata";
import {
  renderSitemapIndex,
  renderSitemapUrlSet,
  sitemapPageCount
} from "../src/lib/seo/sitemap";
import {
  buildDiscussionForumPostingStructuredData,
  buildHomepageStructuredData,
  buildProfilePageStructuredData,
  serializeJsonLd
} from "../src/lib/seo/structuredData";
import { hostRelativePublicAssetUrl } from "../src/lib/publicAssetUrl";
import {
  isPublicPostIndexable,
  isPublicProfileIndexable,
  type PublicProfileIndexingState
} from "../src/lib/seo/publicIndexingPolicy";

const profileUrl = "https://cadesca.com/user/elmir";
const profile = buildProfilePageStructuredData({
  canonicalUrl: profileUrl,
  displayName: "Elmir Aliyev",
  username: "elmir",
  universityName: "Bilkent University",
  bio: "Student building useful campus products.",
  avatarUrl: "https://cadesca.com/media/avatar/elmir",
  publicPostCount: 3,
  createdAt: "2026-01-01T00:00:00.000Z",
  updatedAt: "2026-07-16T00:00:00.000Z"
});

assert.equal(profile["@type"], "ProfilePage");
assert.equal(profile.mainEntity["@type"], "Person");
assert.equal(profile.mainEntity.alternateName, "@elmir");
assert.equal(profile.mainEntity.interactionStatistic[0].userInteractionCount, 3);
assert.equal("email" in profile.mainEntity, false);
assert.equal("identifier" in profile.mainEntity, false);

const post = buildDiscussionForumPostingStructuredData({
  canonicalUrl: "https://cadesca.com/post/11111111-1111-4111-8111-111111111111",
  siteUrl: "https://cadesca.com",
  body: "salam",
  imageUrl: "https://cadesca.com/media/post/11111111-1111-4111-8111-111111111111",
  createdAt: "2026-07-16T08:00:00.000Z",
  updatedAt: "2026-07-16T08:10:00.000Z",
  likeCount: 1,
  commentCount: 2,
  author: {
    displayName: "Elmir Aliyev",
    username: "elmir",
    profileUrl
  }
});

assert.equal(post["@type"], "DiscussionForumPosting");
assert.equal(post.author.url, profileUrl);
assert.equal(post.text, "salam");
assert.equal(post.commentCount, 2);
assert.deepEqual(
  post.interactionStatistic.map((item) => item.userInteractionCount),
  [1, 2]
);

const homepage = buildHomepageStructuredData({
  siteUrl: "https://cadesca.com",
  logoUrl: "https://cadesca.com/cadesca-mark.png",
  officialSocialUrls: ["https://www.instagram.com/cadesca"]
});

assert.deepEqual(
  homepage["@graph"].map((item) => item["@type"]),
  ["Organization", "WebSite"]
);

const serialized = serializeJsonLd({
  text: "</script><script>alert('x')</script>"
});
assert.equal(serialized.includes("</script>"), false);
assert.equal(serialized.includes("\\u003c"), true);

assert.equal(
  publicProfileDescription({
    displayName: "Elmir Aliyev",
    universityName: "Bilkent University"
  }),
  "Elmir Aliyev’s verified Bilkent University profile on Cadesca. View public campus posts and profile information."
);
assert.equal(publicPostTitle("Elmir", "salam"), "Elmir on Cadesca: “salam”");
assert.ok(publicPostDescription("word ".repeat(80)).length <= 158);

assert.deepEqual(
  parseOfficialSocialUrls(
    "https://www.instagram.com/cadesca/, https://example.com/not-cadesca, javascript:alert(1)"
  ),
  ["https://www.instagram.com/cadesca"]
);

assert.equal(
  hostRelativePublicAssetUrl("https://cadesca.com/media/avatar/elmir"),
  "/media/avatar/elmir"
);
assert.equal(
  hostRelativePublicAssetUrl("https://images.example.com/avatar.png"),
  "https://images.example.com/avatar.png"
);

const publicProfileState: PublicProfileIndexingState = {
  role: "user",
  status: "active",
  studentStatus: "verified",
  publicProfileEnabled: true,
  suspended: false,
  deleted: false,
  universityStatus: "active"
};

assert.equal(isPublicProfileIndexable(publicProfileState), true);
assert.equal(
  isPublicProfileIndexable({
    ...publicProfileState,
    publicProfileEnabled: false
  }),
  false
);
assert.equal(
  isPublicProfileIndexable({
    ...publicProfileState,
    suspended: true
  }),
  false
);
assert.equal(
  isPublicPostIndexable({
    profile: publicProfileState,
    postStatus: "active",
    visibility: "public_preview",
    hasOpenReport: false
  }),
  true
);
assert.equal(
  isPublicPostIndexable({
    profile: publicProfileState,
    postStatus: "active",
    visibility: "university_only",
    hasOpenReport: false
  }),
  false
);
assert.equal(
  isPublicPostIndexable({
    profile: publicProfileState,
    postStatus: "active",
    visibility: "public_preview",
    hasOpenReport: true
  }),
  false
);

assert.equal(sitemapPageCount(0), 0);
assert.equal(sitemapPageCount(45_001), 2);
assert.match(
  renderSitemapIndex(["https://cadesca.com/sitemaps/static"]),
  /<sitemapindex/
);
assert.match(
  renderSitemapUrlSet([{
    url: "https://cadesca.com/user/a&b",
    lastModified: "2026-07-16T00:00:00.000Z"
  }]),
  /a&amp;b/
);

console.log("SEO structured-data checks passed.");
