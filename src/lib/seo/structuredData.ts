type ProfilePageStructuredDataInput = {
  canonicalUrl: string;
  displayName: string;
  username: string;
  universityName: string;
  bio?: string | null;
  avatarUrl?: string | null;
  publicPostCount: number;
  createdAt?: string | null;
  updatedAt?: string | null;
};

type DiscussionForumPostingStructuredDataInput = {
  canonicalUrl: string;
  siteUrl: string;
  body: string;
  imageUrl?: string | null;
  createdAt: string;
  updatedAt: string;
  likeCount: number;
  commentCount: number;
  author: {
    displayName: string;
    username: string;
    profileUrl: string;
  };
};

type HomepageStructuredDataInput = {
  siteUrl: string;
  logoUrl: string;
  officialSocialUrls?: string[];
};

export function buildProfilePageStructuredData(input: ProfilePageStructuredDataInput) {
  const profileId = `${input.canonicalUrl}#profile`;
  const personId = `${input.canonicalUrl}#person`;

  return {
    "@context": "https://schema.org",
    "@type": "ProfilePage",
    "@id": profileId,
    url: input.canonicalUrl,
    name: `${input.displayName} (@${input.username}) on Cadesca`,
    ...(input.createdAt ? { dateCreated: input.createdAt } : {}),
    ...(input.updatedAt ? { dateModified: input.updatedAt } : {}),
    mainEntity: {
      "@type": "Person",
      "@id": personId,
      name: input.displayName,
      alternateName: `@${input.username}`,
      url: input.canonicalUrl,
      ...(input.avatarUrl ? { image: input.avatarUrl } : {}),
      ...(input.bio ? { description: input.bio } : {}),
      affiliation: {
        "@type": "CollegeOrUniversity",
        name: input.universityName
      },
      interactionStatistic: [{
        "@type": "InteractionCounter",
        interactionType: "https://schema.org/WriteAction",
        userInteractionCount: Math.max(0, Math.trunc(input.publicPostCount))
      }]
    }
  };
}

export function buildDiscussionForumPostingStructuredData(
  input: DiscussionForumPostingStructuredDataInput
) {
  return {
    "@context": "https://schema.org",
    "@type": "DiscussionForumPosting",
    "@id": `${input.canonicalUrl}#posting`,
    url: input.canonicalUrl,
    mainEntityOfPage: input.canonicalUrl,
    ...(input.body ? { text: input.body } : {}),
    ...(input.imageUrl ? { image: input.imageUrl } : {}),
    datePublished: input.createdAt,
    dateModified: input.updatedAt,
    author: {
      "@type": "Person",
      "@id": `${input.author.profileUrl}#person`,
      name: input.author.displayName,
      alternateName: `@${input.author.username}`,
      url: input.author.profileUrl
    },
    interactionStatistic: [
      {
        "@type": "InteractionCounter",
        interactionType: "https://schema.org/LikeAction",
        userInteractionCount: Math.max(0, Math.trunc(input.likeCount))
      },
      {
        "@type": "InteractionCounter",
        interactionType: "https://schema.org/CommentAction",
        userInteractionCount: Math.max(0, Math.trunc(input.commentCount))
      }
    ],
    commentCount: Math.max(0, Math.trunc(input.commentCount)),
    isPartOf: {
      "@type": "WebSite",
      "@id": `${input.siteUrl}/#website`,
      url: input.siteUrl,
      name: "Cadesca"
    }
  };
}

export function buildHomepageStructuredData(input: HomepageStructuredDataInput) {
  const organization = {
    "@type": "Organization",
    "@id": `${input.siteUrl}/#organization`,
    name: "Cadesca",
    url: input.siteUrl,
    logo: input.logoUrl,
    ...(input.officialSocialUrls?.length ? { sameAs: input.officialSocialUrls } : {})
  };

  const website = {
    "@type": "WebSite",
    "@id": `${input.siteUrl}/#website`,
    url: input.siteUrl,
    name: "Cadesca",
    alternateName: ["Cadesca Student Network"],
    publisher: {
      "@id": `${input.siteUrl}/#organization`
    }
  };

  return {
    "@context": "https://schema.org",
    "@graph": [organization, website]
  };
}

const JSON_LD_ESCAPE_CHARACTERS: Record<string, string> = {
  "<": "\\u003c",
  ">": "\\u003e",
  "&": "\\u0026",
  "\u2028": "\\u2028",
  "\u2029": "\\u2029"
};

export function serializeJsonLd(value: unknown) {
  return JSON.stringify(value).replace(/[<>&\u2028\u2029]/g, (character) => {
    return JSON_LD_ESCAPE_CHARACTERS[character] || character;
  });
}
