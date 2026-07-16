export type PublicProfileIndexingState = {
  role: string;
  status: string;
  studentStatus: string;
  publicProfileEnabled: boolean;
  suspended: boolean;
  deleted: boolean;
  universityStatus: string;
};

export type PublicPostIndexingState = {
  profile: PublicProfileIndexingState;
  postStatus: string;
  visibility: string;
  hasOpenReport: boolean;
};

export function isPublicProfileIndexable(state: PublicProfileIndexingState) {
  return (
    state.role === "user" &&
    state.status === "active" &&
    state.studentStatus === "verified" &&
    state.publicProfileEnabled &&
    !state.suspended &&
    !state.deleted &&
    state.universityStatus === "active"
  );
}

export function isPublicPostIndexable(state: PublicPostIndexingState) {
  return (
    isPublicProfileIndexable(state.profile) &&
    state.postStatus === "active" &&
    state.visibility === "public_preview" &&
    !state.hasOpenReport
  );
}
