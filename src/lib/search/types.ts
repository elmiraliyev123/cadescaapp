export type ExploreSearchResultType = "person" | "post" | "club" | "event";

type ExploreSearchResultBase = {
  id: string;
  type: ExploreSearchResultType;
  title: string;
  subtitle: string;
  imageUrl: string | null;
  href: string;
};

export type PersonSearchResult = ExploreSearchResultBase & {
  type: "person";
  username: string;
  verified: boolean;
};

export type PostSearchResult = ExploreSearchResultBase & {
  type: "post";
  excerpt: string;
  createdAt: string;
};

export type ClubSearchResult = ExploreSearchResultBase & {
  type: "club";
  slug: string;
  official: boolean;
};

export type EventSearchResult = ExploreSearchResultBase & {
  type: "event";
  slug: string;
  startsAt: string;
  status: "published" | "sold_out";
};

export type ExploreSearchResult =
  | PersonSearchResult
  | PostSearchResult
  | ClubSearchResult
  | EventSearchResult;

export type ExploreSearchResponse = {
  query: string;
  results: ExploreSearchResult[];
};

