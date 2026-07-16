import "server-only";

import { cookies } from "next/headers";

import { assertImageAllowed } from "@/lib/server/imageModeration";
import { USER_SESSION_COOKIE, verifyUserSessionToken } from "@/lib/server/userSession";
import { getReadyPool } from "@/lib/server/users";
import { ensureUniversitySchemaReady, normalizeEmailDomains, normalizeUniversitySlug } from "@/lib/server/universities";
import { getSupabaseAdminClient } from "@/lib/supabase/admin";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export type CurrentStudentContext = {
  id: string;
  authUserId: string | null;
  name: string;
  email: string;
  role: string;
  status: string;
  username: string | null;
  displayName: string | null;
  bio: string | null;
  avatarUrl: string | null;
  universityId: string | null;
  universityName: string | null;
  universitySlug: string | null;
  universityEmailDomain: string | null;
  legacyUniversityName: string | null;
  legacyUniversityDomain: string | null;
  studentStatus: string;
  studentMenuAccess: boolean;
  verifiedAt: string | null;
  verifiedVia: string;
  createdAt: string | null;
  socialReady: boolean;
};

export type SocialComment = {
  id: string;
  postId: string;
  userId: string;
  authorName: string;
  authorUsername: string | null;
  authorAvatarUrl: string | null;
  body: string;
  createdAt: string;
  ownComment: boolean;
};

export type SocialPost = {
  id: string;
  universityId: string;
  userId: string;
  authorName: string;
  authorUsername: string | null;
  authorAvatarUrl: string | null;
  universityName: string;
  universitySlug: string;
  body: string;
  imageUrl: string | null;
  status: "active" | "hidden" | "deleted";
  createdAt: string;
  updatedAt: string;
  likeCount: number;
  commentCount: number;
  reportCount: number;
  likedByCurrentUser: boolean;
  ownPost: boolean;
  comments: SocialComment[];
};

export type SocialActivityItem = {
  id: string;
  type: "like" | "comment" | "follow";
  actorName: string;
  actorUsername: string | null;
  actorAvatarUrl: string | null;
  postId: string;
  postPreview: string;
  commentBody: string | null;
  createdAt: string;
};

export type StudentProfileStats = {
  postsCount: number;
  followerCount: number;
  followingCount: number;
  joinedAt: string | null;
  communityName: string;
};

export type PublicStudentProfile = {
  id: string;
  username: string;
  displayName: string;
  avatarUrl: string | null;
  bio: string | null;
  universityName: string;
  universitySlug: string | null;
  followerCount: number;
  followingCount: number;
  postsCount: number;
  isFollowing: boolean;
  isOwnProfile: boolean;
  posts: SocialPost[];
};

export type AdminModerationPost = {
  id: string;
  body: string;
  imageUrl: string | null;
  status: "active" | "hidden" | "deleted";
  createdAt: string;
  updatedAt: string;
  authorName: string;
  authorEmail: string;
  authorUsername: string | null;
  authorAvatarUrl: string | null;
  universityName: string;
  universitySlug: string;
  likeCount: number;
  commentCount: number;
  reportCount: number;
  openReportCount: number;
};

export type AdminPostReport = {
  id: string;
  postId: string;
  reason: string;
  status: "open" | "resolved" | "dismissed";
  createdAt: string;
  reporterName: string;
  reporterEmail: string;
  reporterUsername: string | null;
  postPreview: string;
  universityName: string;
};

export type AdminSocialOverview = {
  totalUsers: number;
  verifiedUsers: number;
  totalPosts: number;
  pendingReports: number;
  activeUniversities: number;
};

export type AdminSocialUser = {
  id: string;
  displayName: string;
  username: string | null;
  email: string;
  universityName: string | null;
  universitySlug: string | null;
  status: string;
  studentStatus: string;
  postsCount: number;
  reportsCount: number;
  createdAt: string;
};

export type AdminSocialUniversity = {
  id: string;
  slug: string;
  name: string;
  universityEmailDomain: string;
  emailDomains: string[];
  countryCode: string | null;
  countryName: string | null;
  city: string | null;
  websiteUrl: string | null;
  status: string;
  studentCount: number;
  postCount: number;
  createdAt: string;
};

type CurrentStudentRow = {
  id: string;
  auth_user_id: string | null;
  name: string;
  email: string;
  role: string;
  status: string;
  username: string | null;
  display_name: string | null;
  bio: string | null;
  avatar_url: string | null;
  university_id: string | null;
  university_name: string | null;
  university_domain: string | null;
  student_status: string;
  student_menu_access: boolean;
  verified_at: Date | string | null;
  verified_via: string | null;
  created_at: Date | string | null;
  university_slug: string | null;
  resolved_university_name: string | null;
  university_email_domain: string | null;
};

type LegacyCurrentStudentRow = Omit<
  CurrentStudentRow,
  | "university_id"
  | "verified_at"
  | "university_slug"
  | "resolved_university_name"
  | "university_email_domain"
  | "username"
  | "display_name"
  | "bio"
  | "avatar_url"
> & {
  university_id?: null;
  verified_at?: null;
  university_slug?: null;
  resolved_university_name?: null;
  university_email_domain?: null;
  username?: null;
  display_name?: null;
  bio?: null;
  avatar_url?: null;
};

type PostRow = {
  id: string;
  university_id: string;
  user_id: string;
  body: string;
  image_url: string | null;
  status: "active" | "hidden" | "deleted";
  created_at: Date | string;
  updated_at: Date | string;
  author_name: string;
  author_username: string | null;
  author_avatar_url: string | null;
  university_name: string;
  university_slug: string;
  like_count: number;
  comment_count: number;
  report_count: number;
  liked_by_current_user: boolean;
};

type CommentRow = {
  id: string;
  post_id: string;
  user_id: string;
  author_name: string;
  author_username: string | null;
  author_avatar_url: string | null;
  body: string;
  created_at: Date | string;
};

const AVATAR_BUCKET = "avatars";
const SOCIAL_IMAGE_BUCKET = "social-images";
const MAX_AVATAR_FILE_BYTES = 8 * 1024 * 1024;
const MAX_POST_IMAGE_FILE_BYTES = 10 * 1024 * 1024;
const SUPPORTED_IMAGE_EXTENSIONS = new Set(["jpg", "jpeg", "png", "webp", "heic", "heif", "avif", "gif"]);
const EXTENSION_BY_MIME_TYPE: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/jpg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "image/heic": "heic",
  "image/heif": "heif",
  "image/avif": "avif",
  "image/gif": "gif"
};
const USERNAME_PATTERN = /^[a-z0-9_][a-z0-9_.]{1,28}[a-z0-9_]$/;
const RESERVED_USERNAMES = new Set([
  "admin",
  "app",
  "api",
  "login",
  "register",
  "wallet",
  "merchant",
  "support",
  "help",
  "settings",
  "profile",
  "cadesca",
  "root",
  "system"
]);

function iso(value: Date | string | null | undefined) {
  if (!value) return null;
  return value instanceof Date ? value.toISOString() : new Date(value).toISOString();
}

function displayNameFor(name: string | null | undefined, displayName?: string | null) {
  return (displayName || name || "Cadesca Student").trim();
}

function isHttpUrl(value: string | null | undefined) {
  return Boolean(value && /^https?:\/\//i.test(value));
}

async function resolveStorageUrls(bucket: string, values: Array<string | null | undefined>, logScope: string) {
  const result = new Map<string, string | null>();
  const objectPaths = Array.from(new Set(values.filter((value): value is string => Boolean(value && !isHttpUrl(value)))));

  for (const value of values) {
    if (value && isHttpUrl(value)) {
      result.set(value, value);
    }
  }

  if (!objectPaths.length) return result;

  try {
    const { data, error } = await getSupabaseAdminClient()
      .storage
      .from(bucket)
      .createSignedUrls(objectPaths, 60 * 60);

    if (error) throw error;

    for (const item of data || []) {
      if (item.path) {
        result.set(item.path, item.signedUrl || null);
      }
    }
  } catch (error) {
    console.error(`[${logScope}] signed_url_failed`, {
      reason: error instanceof Error ? error.message : "unknown"
    });
    for (const path of objectPaths) {
      result.set(path, null);
    }
  }

  return result;
}

async function resolveAvatarUrls(values: Array<string | null | undefined>) {
  return resolveStorageUrls(AVATAR_BUCKET, values, "avatars");
}

async function resolvePostImageUrls(values: Array<string | null | undefined>) {
  return resolveStorageUrls(SOCIAL_IMAGE_BUCKET, values, "post_images");
}

async function resolveAvatarUrl(value: string | null | undefined) {
  if (!value) return null;
  const urls = await resolveAvatarUrls([value]);
  return urls.get(value) || null;
}

export function normalizeUsernameInput(value: string) {
  return value.trim().toLowerCase();
}

export function validateUsernameInput(value: string) {
  const username = normalizeUsernameInput(value);
  if (!username) throw new Error("username_required");
  if (username.length < 3 || username.length > 30) throw new Error("invalid_username");
  if (!USERNAME_PATTERN.test(username)) throw new Error("invalid_username");
  if (username.includes("..")) throw new Error("invalid_username");
  if (RESERVED_USERNAMES.has(username)) throw new Error("reserved_username");
  return username;
}

function getPgCode(error: unknown) {
  return typeof error === "object" && error !== null && "code" in error
    ? String((error as { code?: unknown }).code || "")
    : "";
}

function isMissingSocialSchemaError(error: unknown) {
  return ["42P01", "42703", "42883"].includes(getPgCode(error));
}

function mapCurrentStudent(row: CurrentStudentRow | LegacyCurrentStudentRow, socialReady: boolean): CurrentStudentContext {
  const universityId = row.university_id || null;
  const resolvedUniversityName = row.resolved_university_name || row.university_name || null;

  return {
    id: row.id,
    authUserId: row.auth_user_id,
    name: row.name,
    email: row.email,
    role: row.role,
    status: row.status,
    username: row.username || null,
    displayName: row.display_name || row.name,
    bio: row.bio || null,
    avatarUrl: row.avatar_url || null,
    universityId,
    universityName: resolvedUniversityName,
    universitySlug: row.university_slug || null,
    universityEmailDomain: row.university_email_domain || row.university_domain || null,
    legacyUniversityName: row.university_name,
    legacyUniversityDomain: row.university_domain,
    studentStatus: row.student_status,
    studentMenuAccess: row.student_menu_access,
    verifiedAt: iso(row.verified_at),
    verifiedVia: row.verified_via || "email",
    createdAt: iso(row.created_at),
    socialReady
  };
}

async function getSupabaseAuthUserId() {
  try {
    const supabase = await createSupabaseServerClient();
    const {
      data: { user }
    } = await supabase.auth.getUser();
    return user?.id || null;
  } catch {
    return null;
  }
}

async function getLegacyUserId() {
  const cookieStore = await cookies();
  const token = cookieStore.get(USER_SESSION_COOKIE)?.value;
  const secret = process.env.AUTH_SECRET;
  const session = token && secret ? await verifyUserSessionToken(token, secret) : null;
  return session?.role === "user" ? session.id : null;
}

export async function getCurrentStudentContext(): Promise<CurrentStudentContext | null> {
  const [authUserId, legacyUserId] = await Promise.all([getSupabaseAuthUserId(), getLegacyUserId()]);

  if (!authUserId && !legacyUserId) {
    return null;
  }

  if (legacyUserId === "user_mock" && process.env.NODE_ENV === "development") {
    return {
      id: "user_mock",
      authUserId: null,
      name: "Demo Student",
      email: "student@bilkent.edu.tr",
      role: "user",
      status: "active",
      username: "demo.student",
      displayName: "Demo Student",
      bio: null,
      avatarUrl: null,
      universityId: "demo_bilkent",
      universityName: "Bilkent University",
      universitySlug: "bilkent",
      universityEmailDomain: "bilkent.edu.tr",
      legacyUniversityName: "Bilkent University",
      legacyUniversityDomain: "bilkent.edu.tr",
      studentStatus: "verified",
      studentMenuAccess: true,
      verifiedAt: null,
      verifiedVia: "email",
      createdAt: null,
      socialReady: true
    };
  }

  const pool = await getReadyPool();

  try {
    const result = await pool.query<CurrentStudentRow>(
      `select
         app_user.id,
         app_user.auth_user_id,
         app_user.name,
         app_user.email,
         app_user.role,
         app_user.status,
         app_user.username,
         app_user.display_name,
         app_user.bio,
         app_user.avatar_url,
         app_user.university_id,
         app_user.university_name,
         app_user.university_domain,
         app_user.student_status,
         app_user.student_menu_access,
         app_user.verified_at,
         app_user.verified_via,
         app_user.created_at,
         university.slug as university_slug,
         university.name as resolved_university_name,
         university.university_email_domain
       from public.users app_user
       left join public.universities university
         on university.id = app_user.university_id
       where ($1::uuid is not null and app_user.auth_user_id = $1::uuid)
          or ($2::text is not null and app_user.id = $2::text)
       order by app_user.auth_user_id is not null desc
       limit 1`,
      [authUserId, legacyUserId]
    );

    if (!result.rows[0]) return null;
    const user = mapCurrentStudent(result.rows[0], true);
    return { ...user, avatarUrl: await resolveAvatarUrl(user.avatarUrl) };
  } catch (error) {
    if (!isMissingSocialSchemaError(error)) throw error;

    const result = await pool.query<LegacyCurrentStudentRow>(
      `select
         app_user.id,
         app_user.auth_user_id,
         app_user.name,
         app_user.email,
         app_user.role,
         app_user.status,
         null::text as username,
         null::text as display_name,
         null::text as bio,
         null::text as avatar_url,
         app_user.university_name,
         app_user.university_domain,
         app_user.student_status,
         app_user.student_menu_access,
         app_user.verified_via,
         app_user.created_at
       from public.users app_user
       where ($1::uuid is not null and app_user.auth_user_id = $1::uuid)
          or ($2::text is not null and app_user.id = $2::text)
       order by app_user.auth_user_id is not null desc
       limit 1`,
      [authUserId, legacyUserId]
    );

    if (!result.rows[0]) return null;
    const user = mapCurrentStudent(result.rows[0], false);
    return { ...user, avatarUrl: await resolveAvatarUrl(user.avatarUrl) };
  }
}

export function isVerifiedUniversityStudent(
  user: CurrentStudentContext | null
): user is CurrentStudentContext & { universityId: string } {
  return Boolean(
    user &&
      user.socialReady &&
      user.status === "active" &&
      user.studentStatus === "verified" &&
      user.universityId
  );
}

export function isAdminUser(user: CurrentStudentContext | null) {
  return Boolean(user?.role === "admin" && user.status === "active");
}

function requireVerifiedUniversityStudent(user: CurrentStudentContext | null): asserts user is CurrentStudentContext & { universityId: string } {
  if (!isVerifiedUniversityStudent(user)) {
    throw new Error("verified_university_student_required");
  }
}

function requireActiveUser(user: CurrentStudentContext | null): asserts user is CurrentStudentContext {
  if (!user || user.status !== "active") {
    throw new Error("unauthorized");
  }
}

function normalizePostBody(value: FormDataEntryValue | string | null | undefined, maxLength: number, allowEmpty = false) {
  const body = String(value || "").trim();
  if (!body && !allowEmpty) throw new Error("post_body_required");
  if (body.length > maxLength) throw new Error("post_body_too_long");
  return body;
}

function normalizeOptionalImageUrl(value: FormDataEntryValue | string | null | undefined) {
  const imageUrl = String(value || "").trim();
  if (!imageUrl) return null;

  try {
    const parsed = new URL(imageUrl);
    if (parsed.protocol !== "https:" && parsed.protocol !== "http:") {
      throw new Error("invalid_image_url");
    }
    return parsed.toString();
  } catch {
    throw new Error("invalid_image_url");
  }
}

function getImageExtension(file: File) {
  const mimeExtension = EXTENSION_BY_MIME_TYPE[(file.type || "").toLowerCase()];
  if (mimeExtension) return mimeExtension;

  const filenameExtension = (file.name || "").split(".").pop()?.toLowerCase();
  if (filenameExtension && SUPPORTED_IMAGE_EXTENSIONS.has(filenameExtension)) {
    return filenameExtension === "jpeg" ? "jpg" : filenameExtension;
  }

  return null;
}

function validateImageFile(file: File, maxBytes: number, invalidTypeError: string, tooLargeError: string) {
  if (!file || file.size === 0) return null;
  if (file.size > maxBytes) throw new Error(tooLargeError);

  const extension = getImageExtension(file);
  if (!extension) throw new Error(invalidTypeError);
  return extension;
}

function normalizeDisplayName(value: FormDataEntryValue | string | null | undefined) {
  const displayName = String(value || "").trim();
  if (!displayName) return null;
  if (displayName.length > 80) throw new Error("display_name_too_long");
  return displayName;
}

function normalizeBio(value: FormDataEntryValue | string | null | undefined) {
  const bio = String(value || "").trim();
  if (!bio) return null;
  if (bio.length > 240) throw new Error("bio_too_long");
  return bio;
}

async function loadCommentsForPosts(postIds: string[], currentUserId: string) {
  if (!postIds.length) return new Map<string, SocialComment[]>();

  const pool = await getReadyPool();
  const result = await pool.query<CommentRow>(
    `select
       comment.id,
       comment.post_id,
       comment.user_id,
       coalesce(author.display_name, author.name) as author_name,
       author.username as author_username,
       author.avatar_url as author_avatar_url,
       comment.body,
       comment.created_at
     from public.university_post_comments comment
     join public.users author
       on author.id = comment.user_id
     where comment.post_id = any($1::uuid[])
       and comment.status = 'active'
     order by comment.created_at asc`,
    [postIds]
  );

  const avatarUrls = await resolveAvatarUrls(result.rows.map((row) => row.author_avatar_url));
  const grouped = new Map<string, SocialComment[]>();
  for (const row of result.rows) {
    const list = grouped.get(row.post_id) || [];
    list.push({
      id: row.id,
      postId: row.post_id,
      userId: row.user_id,
      authorName: row.author_name,
      authorUsername: row.author_username,
      authorAvatarUrl: row.author_avatar_url ? avatarUrls.get(row.author_avatar_url) || null : null,
      body: row.body,
      createdAt: iso(row.created_at) || "",
      ownComment: row.user_id === currentUserId
    });
    grouped.set(row.post_id, list);
  }

  return grouped;
}

function mapPost(
  row: PostRow,
  comments: SocialComment[],
  currentUserId: string,
  avatarUrls: Map<string, string | null>,
  imageUrls: Map<string, string | null>
): SocialPost {
  return {
    id: row.id,
    universityId: row.university_id,
    userId: row.user_id,
    authorName: row.author_name,
    authorUsername: row.author_username,
    authorAvatarUrl: row.author_avatar_url ? avatarUrls.get(row.author_avatar_url) || null : null,
    universityName: row.university_name,
    universitySlug: row.university_slug,
    body: row.body,
    imageUrl: row.image_url ? imageUrls.get(row.image_url) || null : null,
    status: row.status,
    createdAt: iso(row.created_at) || "",
    updatedAt: iso(row.updated_at) || "",
    likeCount: row.like_count,
    commentCount: row.comment_count,
    reportCount: row.report_count,
    likedByCurrentUser: row.liked_by_current_user,
    ownPost: row.user_id === currentUserId,
    comments
  };
}

export async function listUniversityFeed(user: CurrentStudentContext, limit = 50) {
  requireVerifiedUniversityStudent(user);
  const pool = await getReadyPool();
  const result = await pool.query<PostRow>(
    `select
       post.id,
       post.university_id,
       post.user_id,
       post.body,
       post.image_url,
       post.status,
       post.created_at,
       post.updated_at,
       coalesce(author.display_name, author.name) as author_name,
       author.username as author_username,
       author.avatar_url as author_avatar_url,
       university.name as university_name,
       university.slug as university_slug,
       (select count(*)::int from public.university_post_likes like_row where like_row.post_id = post.id) as like_count,
       (select count(*)::int from public.university_post_comments comment where comment.post_id = post.id and comment.status = 'active') as comment_count,
       (select count(*)::int from public.university_post_reports report where report.post_id = post.id) as report_count,
       exists (
         select 1
         from public.university_post_likes current_like
         where current_like.post_id = post.id
           and current_like.user_id = $2
       ) as liked_by_current_user
     from public.university_posts post
     join public.users author
       on author.id = post.user_id
     join public.universities university
       on university.id = post.university_id
     where post.university_id = $1
       and post.status = 'active'
     order by
       exists (
         select 1
         from public.user_follows follow
         where follow.follower_id = $2
           and follow.following_id = post.user_id
           and follow.university_id = post.university_id
       ) desc,
       post.created_at desc
     limit $3`,
    [user.universityId, user.id, limit]
  );

  const comments = await loadCommentsForPosts(result.rows.map((row) => row.id), user.id);
  const avatarUrls = await resolveAvatarUrls(result.rows.map((row) => row.author_avatar_url));
  const imageUrls = await resolvePostImageUrls(result.rows.map((row) => row.image_url));
  return result.rows.map((row) => mapPost(row, comments.get(row.id) || [], user.id, avatarUrls, imageUrls));
}

export async function listExplorePosts(user: CurrentStudentContext, limit = 20) {
  const posts = await listUniversityFeed(user, limit);
  return posts.sort((left, right) => {
    const rightScore = right.likeCount * 2 + right.commentCount;
    const leftScore = left.likeCount * 2 + left.commentCount;
    if (rightScore !== leftScore) return rightScore - leftScore;
    return new Date(right.createdAt).getTime() - new Date(left.createdAt).getTime();
  });
}

async function listUserPostsForViewer(
  viewer: CurrentStudentContext,
  targetUserId: string,
  targetUniversityId: string,
  limit = 30
) {
  const pool = await getReadyPool();
  const result = await pool.query<PostRow>(
    `select
       post.id,
       post.university_id,
       post.user_id,
       post.body,
       post.image_url,
       post.status,
       post.created_at,
       post.updated_at,
       coalesce(author.display_name, author.name) as author_name,
       author.username as author_username,
       author.avatar_url as author_avatar_url,
       university.name as university_name,
       university.slug as university_slug,
       (select count(*)::int from public.university_post_likes like_row where like_row.post_id = post.id) as like_count,
       (select count(*)::int from public.university_post_comments comment where comment.post_id = post.id and comment.status = 'active') as comment_count,
       (select count(*)::int from public.university_post_reports report where report.post_id = post.id) as report_count,
       exists (
         select 1
         from public.university_post_likes current_like
         where current_like.post_id = post.id
           and current_like.user_id = $4
       ) as liked_by_current_user
     from public.university_posts post
     join public.users author
       on author.id = post.user_id
     join public.universities university
       on university.id = post.university_id
     where post.user_id = $1
       and post.university_id = $2
       and post.status = 'active'
     order by post.created_at desc
     limit $3`,
    [targetUserId, targetUniversityId, limit, viewer.id]
  );

  const comments = await loadCommentsForPosts(result.rows.map((row) => row.id), viewer.id);
  const avatarUrls = await resolveAvatarUrls(result.rows.map((row) => row.author_avatar_url));
  const imageUrls = await resolvePostImageUrls(result.rows.map((row) => row.image_url));
  return result.rows.map((row) => mapPost(row, comments.get(row.id) || [], viewer.id, avatarUrls, imageUrls));
}

export async function getPublicProfileByUsername(usernameInput: string): Promise<PublicStudentProfile | null> {
  let username: string;
  try {
    username = validateUsernameInput(usernameInput);
  } catch {
    return null;
  }

  const viewer = await getCurrentStudentContext();
  const adminViewer = isAdminUser(viewer);
  if (!adminViewer) {
    requireVerifiedUniversityStudent(viewer);
  } else {
    requireActiveUser(viewer);
  }

  const pool = await getReadyPool();
  const profileResult = await pool.query<{
    id: string;
    name: string;
    display_name: string | null;
    username: string;
    bio: string | null;
    avatar_url: string | null;
    university_id: string;
    university_name: string;
    university_slug: string | null;
  }>(
    `select
       app_user.id,
       app_user.name,
       app_user.display_name,
       app_user.username,
       app_user.bio,
       app_user.avatar_url,
       app_user.university_id,
       university.name as university_name,
       university.slug as university_slug
     from public.users app_user
     join public.universities university
       on university.id = app_user.university_id
     where app_user.username = $1
       and app_user.status = 'active'
       and app_user.deleted_at is null
       and app_user.student_status = 'verified'
     limit 1`,
    [username]
  );

  const profile = profileResult.rows[0];
  if (!profile) return null;
  if (!adminViewer && profile.university_id !== viewer.universityId) return null;

  const countsResult = await pool.query<{
    follower_count: number;
    following_count: number;
    posts_count: number;
    is_following: boolean;
  }>(
    `select
       (select count(*)::int
        from public.user_follows
        where following_id = $1) as follower_count,
       (select count(*)::int
        from public.user_follows
        where follower_id = $1) as following_count,
       (select count(*)::int
        from public.university_posts
        where user_id = $1
          and university_id = $2
          and status = 'active') as posts_count,
       exists (
         select 1
         from public.user_follows
         where follower_id = $3
           and following_id = $1
       ) as is_following`,
    [profile.id, profile.university_id, viewer.id]
  );

  const counts = countsResult.rows[0] || {
    follower_count: 0,
    following_count: 0,
    posts_count: 0,
    is_following: false
  };
  const posts = await listUserPostsForViewer(viewer, profile.id, profile.university_id);
  const avatarUrl = await resolveAvatarUrl(profile.avatar_url);

  return {
    id: profile.id,
    username: profile.username,
    displayName: displayNameFor(profile.name, profile.display_name),
    avatarUrl,
    bio: profile.bio,
    universityName: profile.university_name,
    universitySlug: profile.university_slug,
    followerCount: counts.follower_count || 0,
    followingCount: counts.following_count || 0,
    postsCount: counts.posts_count || 0,
    isFollowing: Boolean(counts.is_following),
    isOwnProfile: profile.id === viewer.id,
    posts
  };
}

export async function listOwnProfilePosts(user: CurrentStudentContext | null, limit = 20) {
  if (!isVerifiedUniversityStudent(user)) return [];
  return listUserPostsForViewer(user, user.id, user.universityId, limit);
}

export async function getStudentProfileStats(user: CurrentStudentContext | null): Promise<StudentProfileStats> {
  if (!user) {
    return { postsCount: 0, followerCount: 0, followingCount: 0, joinedAt: null, communityName: "University community" };
  }

  if (!user.socialReady) {
    return {
      postsCount: 0,
      followerCount: 0,
      followingCount: 0,
      joinedAt: user.createdAt,
      communityName: user.universityName || "University community"
    };
  }

  const pool = await getReadyPool();
  let counts = { posts_count: 0, follower_count: 0, following_count: 0 };

  try {
    const result = await pool.query<{
      posts_count: number;
      follower_count: number;
      following_count: number;
    }>(
      `select
         (select count(*)::int
          from public.university_posts
          where user_id = $1
            and status <> 'deleted') as posts_count,
         (select count(*)::int
          from public.user_follows
          where following_id = $1) as follower_count,
         (select count(*)::int
          from public.user_follows
          where follower_id = $1) as following_count`,
      [user.id]
    );
    counts = result.rows[0] || counts;
  } catch (error) {
    if (!isMissingSocialSchemaError(error)) throw error;

    const result = await pool.query<{ posts_count: number }>(
      `select count(*)::int as posts_count
       from public.university_posts
       where user_id = $1
         and status <> 'deleted'`,
      [user.id]
    );
    counts.posts_count = result.rows[0]?.posts_count || 0;
  }

  return {
    postsCount: counts.posts_count || 0,
    followerCount: counts.follower_count || 0,
    followingCount: counts.following_count || 0,
    joinedAt: user.createdAt,
    communityName: user.universityName || "University community"
  };
}

export async function createUniversityPost(input: { body: string; imageUrl?: string | null; imagePath?: string | null }) {
  const user = await getCurrentStudentContext();
  requireVerifiedUniversityStudent(user);

  const imageUrl = input.imagePath || normalizeOptionalImageUrl(input.imageUrl);
  const body = normalizePostBody(input.body, 1000, Boolean(imageUrl));
  const visibility = input.imageUrl && !input.imagePath ? "university_only" : "public_preview";
  const pool = await getReadyPool();

  await pool.query(
    `insert into public.university_posts (university_id, user_id, body, image_url, visibility)
     values ($1, $2, $3, $4, $5)`,
    [user.universityId, user.id, body, imageUrl, visibility]
  );
}

export async function uploadUniversityPostImage(file: File) {
  const user = await getCurrentStudentContext();
  requireVerifiedUniversityStudent(user);

  const extension = validateImageFile(file, MAX_POST_IMAGE_FILE_BYTES, "invalid_post_image_type", "post_image_file_too_large");
  if (!extension) return null;

  await assertImageAllowed(file, "post");

  const objectPath = `${user.universityId}/${user.id}/${crypto.randomUUID()}.${extension}`;
  const { error } = await getSupabaseAdminClient()
    .storage
    .from(SOCIAL_IMAGE_BUCKET)
    .upload(objectPath, file, {
      cacheControl: "3600",
      contentType: file.type || `image/${extension === "jpg" ? "jpeg" : extension}`,
      upsert: false
    });

  if (error) {
    const message = error.message.toLowerCase();
    if (message.includes("bucket") || message.includes("not found")) {
      throw new Error("post_image_bucket_missing");
    }
    throw new Error("post_image_upload_failed");
  }

  return objectPath;
}

export async function uploadCurrentUserAvatar(file: File) {
  const user = await getCurrentStudentContext();
  requireActiveUser(user);

  const extension = validateImageFile(file, MAX_AVATAR_FILE_BYTES, "invalid_avatar_type", "avatar_file_too_large");
  if (!extension) return null;

  await assertImageAllowed(file, "avatar");

  const objectPath = `${user.id}/avatar.${extension}`;
  const { error } = await getSupabaseAdminClient()
    .storage
    .from(AVATAR_BUCKET)
    .upload(objectPath, file, {
      cacheControl: "3600",
      contentType: file.type || `image/${extension === "jpg" ? "jpeg" : extension}`,
      upsert: true
    });

  if (error) {
    const message = error.message.toLowerCase();
    if (message.includes("bucket") || message.includes("not found")) {
      throw new Error("avatar_bucket_missing");
    }
    throw new Error("avatar_upload_failed");
  }

  return objectPath;
}

export async function updateCurrentUserProfile(input: {
  displayName?: string | null;
  username: string;
  bio?: string | null;
  avatarPath?: string | null;
}) {
  const user = await getCurrentStudentContext();
  requireActiveUser(user);

  const displayName = normalizeDisplayName(input.displayName);
  const username = validateUsernameInput(input.username);
  const bio = normalizeBio(input.bio);
  const pool = await getReadyPool();

  const existing = await pool.query<{ id: string }>(
    `select id
     from public.users
     where username = $1
       and id <> $2
     limit 1`,
    [username, user.id]
  );

  if (existing.rows[0]) throw new Error("username_taken");

  try {
    await pool.query(
      `update public.users
       set display_name = $1,
           username = $2,
           bio = $3,
           avatar_url = coalesce($4, avatar_url),
           updated_at = now()
       where id = $5`,
      [displayName, username, bio, input.avatarPath || null, user.id]
    );
  } catch (error) {
    if (getPgCode(error) === "23505") throw new Error("username_taken");
    if (getPgCode(error) === "23514") throw new Error("invalid_username");
    throw error;
  }
}

export async function toggleUserFollow(username: string) {
  const user = await getCurrentStudentContext();
  requireVerifiedUniversityStudent(user);
  const targetUsername = validateUsernameInput(username);
  const pool = await getReadyPool();

  const target = await pool.query<{ id: string; university_id: string }>(
    `select id, university_id
     from public.users
     where username = $1
       and status = 'active'
       and deleted_at is null
       and student_status = 'verified'
       and university_id = $2
     limit 1`,
    [targetUsername, user.universityId]
  );

  const targetUser = target.rows[0];
  if (!targetUser) throw new Error("profile_not_found");
  if (targetUser.id === user.id) throw new Error("cannot_follow_self");

  const existing = await pool.query<{ id: string }>(
    `select id
     from public.user_follows
     where follower_id = $1
       and following_id = $2
     limit 1`,
    [user.id, targetUser.id]
  );

  if (existing.rows[0]) {
    await pool.query(
      `delete from public.user_follows
       where id = $1
         and follower_id = $2`,
      [existing.rows[0].id, user.id]
    );
    return;
  }

  await pool.query(
    `insert into public.user_follows (follower_id, following_id, university_id)
     values ($1, $2, $3)
     on conflict (follower_id, following_id) do nothing`,
    [user.id, targetUser.id, user.universityId]
  );
}

export async function toggleUniversityPostLike(postId: string) {
  const user = await getCurrentStudentContext();
  requireVerifiedUniversityStudent(user);
  const pool = await getReadyPool();

  const existing = await pool.query<{ id: string }>(
    `select like_row.id
     from public.university_post_likes like_row
     join public.university_posts post
       on post.id = like_row.post_id
     where like_row.post_id = $1
       and like_row.user_id = $2
       and post.university_id = $3
       and post.status = 'active'
     limit 1`,
    [postId, user.id, user.universityId]
  );

  if (existing.rows[0]) {
    await pool.query(
      `delete from public.university_post_likes
       where id = $1
         and user_id = $2`,
      [existing.rows[0].id, user.id]
    );
    return;
  }

  await pool.query(
    `insert into public.university_post_likes (university_id, post_id, user_id)
     select post.university_id, post.id, $2
     from public.university_posts post
     where post.id = $1
       and post.university_id = $3
       and post.status = 'active'
     on conflict (post_id, user_id) do nothing`,
    [postId, user.id, user.universityId]
  );
}

export async function createUniversityPostComment(input: { postId: string; body: string }) {
  const user = await getCurrentStudentContext();
  requireVerifiedUniversityStudent(user);
  const body = normalizePostBody(input.body, 500);
  const pool = await getReadyPool();

  await pool.query(
    `insert into public.university_post_comments (university_id, post_id, user_id, body)
     select post.university_id, post.id, $2, $3
     from public.university_posts post
     where post.id = $1
       and post.university_id = $4
       and post.status = 'active'`,
    [input.postId, user.id, body, user.universityId]
  );
}

export async function deleteOwnUniversityPost(postId: string) {
  const user = await getCurrentStudentContext();
  requireVerifiedUniversityStudent(user);
  const pool = await getReadyPool();

  await pool.query(
    `update public.university_posts
     set status = 'deleted'
     where id = $1
       and user_id = $2
       and university_id = $3`,
    [postId, user.id, user.universityId]
  );
}

export async function reportUniversityPost(input: { postId: string; reason?: string | null }) {
  const user = await getCurrentStudentContext();
  requireVerifiedUniversityStudent(user);
  const reason = normalizePostBody(input.reason || "Reported from feed", 300);
  const pool = await getReadyPool();

  await pool.query(
    `insert into public.university_post_reports (university_id, post_id, user_id, reason)
     select post.university_id, post.id, $2, $3
     from public.university_posts post
     where post.id = $1
       and post.university_id = $4
       and post.status = 'active'
     on conflict (post_id, user_id) do update
       set reason = excluded.reason,
           status = 'open',
           resolved_by = null,
           resolved_at = null,
           updated_at = now()`,
    [input.postId, user.id, reason, user.universityId]
  );
}

export async function listSocialActivity(user: CurrentStudentContext, limit = 40) {
  requireVerifiedUniversityStudent(user);
  const pool = await getReadyPool();

  type ActivityRow = {
    id: string;
    type: "like" | "comment" | "follow";
    actor_name: string;
    actor_username: string | null;
    actor_avatar_url: string | null;
    post_id: string;
    post_preview: string;
    comment_body: string | null;
    created_at: Date | string;
  };

  const baseQuery = `(select
        like_row.id::text as id,
        'like'::text as type,
        coalesce(actor.display_name, actor.name) as actor_name,
        actor.username as actor_username,
        actor.avatar_url as actor_avatar_url,
        post.id::text as post_id,
        left(post.body, 120) as post_preview,
        null::text as comment_body,
        like_row.created_at
      from public.university_post_likes like_row
      join public.university_posts post
        on post.id = like_row.post_id
      join public.users actor
        on actor.id = like_row.user_id
      where post.user_id = $1
        and like_row.user_id <> $1
        and post.university_id = $2)
     union all
     (select
        comment.id::text as id,
        'comment'::text as type,
        coalesce(actor.display_name, actor.name) as actor_name,
        actor.username as actor_username,
        actor.avatar_url as actor_avatar_url,
        post.id::text as post_id,
        left(post.body, 120) as post_preview,
        comment.body as comment_body,
        comment.created_at
      from public.university_post_comments comment
      join public.university_posts post
        on post.id = comment.post_id
      join public.users actor
        on actor.id = comment.user_id
      where post.user_id = $1
        and comment.user_id <> $1
        and comment.status = 'active'
        and post.university_id = $2)`;

  let rows: ActivityRow[];
  try {
    const result = await pool.query<ActivityRow>(
      `${baseQuery}
       union all
       (select
          follow.id::text as id,
          'follow'::text as type,
          coalesce(actor.display_name, actor.name) as actor_name,
          actor.username as actor_username,
          actor.avatar_url as actor_avatar_url,
          ''::text as post_id,
          ''::text as post_preview,
          null::text as comment_body,
          follow.created_at
        from public.user_follows follow
        join public.users actor
          on actor.id = follow.follower_id
        where follow.following_id = $1
          and follow.university_id = $2)
     order by created_at desc
     limit $3`,
      [user.id, user.universityId, limit]
    );
    rows = result.rows;
  } catch (error) {
    if (!isMissingSocialSchemaError(error)) throw error;
    const result = await pool.query<ActivityRow>(
      `${baseQuery}
       order by created_at desc
       limit $3`,
      [user.id, user.universityId, limit]
    );
    rows = result.rows;
  }

  const avatarUrls = await resolveAvatarUrls(rows.map((row) => row.actor_avatar_url));
  return rows.map<SocialActivityItem>((row) => ({
    id: row.id,
    type: row.type,
    actorName: row.actor_name,
    actorUsername: row.actor_username,
    actorAvatarUrl: row.actor_avatar_url ? avatarUrls.get(row.actor_avatar_url) || null : null,
    postId: row.post_id,
    postPreview: row.post_preview,
    commentBody: row.comment_body,
    createdAt: iso(row.created_at) || ""
  }));
}

export async function listAdminModerationPosts(limit = 100) {
  const pool = await getReadyPool();
  const result = await pool.query<{
    id: string;
    body: string;
    image_url: string | null;
    status: "active" | "hidden" | "deleted";
    created_at: Date | string;
    updated_at: Date | string;
    author_name: string;
    author_email: string;
    author_username: string | null;
    author_avatar_url: string | null;
    university_name: string;
    university_slug: string;
    like_count: number;
    comment_count: number;
    report_count: number;
    open_report_count: number;
  }>(
    `select
       post.id,
       post.body,
       post.image_url,
       post.status,
       post.created_at,
       post.updated_at,
       coalesce(author.display_name, author.name) as author_name,
       author.email as author_email,
       author.username as author_username,
       author.avatar_url as author_avatar_url,
       university.name as university_name,
       university.slug as university_slug,
       (select count(*)::int from public.university_post_likes like_row where like_row.post_id = post.id) as like_count,
       (select count(*)::int from public.university_post_comments comment where comment.post_id = post.id and comment.status = 'active') as comment_count,
       (select count(*)::int from public.university_post_reports report where report.post_id = post.id) as report_count,
       (select count(*)::int from public.university_post_reports report where report.post_id = post.id and report.status = 'open') as open_report_count
     from public.university_posts post
     join public.users author
       on author.id = post.user_id
     join public.universities university
       on university.id = post.university_id
     order by
       (select count(*) from public.university_post_reports report where report.post_id = post.id and report.status = 'open') desc,
       post.created_at desc
     limit $1`,
    [limit]
  );

  const avatarUrls = await resolveAvatarUrls(result.rows.map((row) => row.author_avatar_url));
  const imageUrls = await resolvePostImageUrls(result.rows.map((row) => row.image_url));
  return result.rows.map<AdminModerationPost>((row) => ({
    id: row.id,
    body: row.body,
    imageUrl: row.image_url ? imageUrls.get(row.image_url) || null : null,
    status: row.status,
    createdAt: iso(row.created_at) || "",
    updatedAt: iso(row.updated_at) || "",
    authorName: row.author_name,
    authorEmail: row.author_email,
    authorUsername: row.author_username,
    authorAvatarUrl: row.author_avatar_url ? avatarUrls.get(row.author_avatar_url) || null : null,
    universityName: row.university_name,
    universitySlug: row.university_slug,
    likeCount: row.like_count,
    commentCount: row.comment_count,
    reportCount: row.report_count,
    openReportCount: row.open_report_count
  }));
}

export async function listAdminPostReports(limit = 100) {
  const pool = await getReadyPool();
  const result = await pool.query<{
    id: string;
    post_id: string;
    reason: string;
    status: "open" | "resolved" | "dismissed";
    created_at: Date | string;
    reporter_name: string;
    reporter_email: string;
    reporter_username: string | null;
    post_preview: string;
    university_name: string;
  }>(
    `select
       report.id,
       report.post_id,
       report.reason,
       report.status,
       report.created_at,
       coalesce(reporter.display_name, reporter.name) as reporter_name,
       reporter.email as reporter_email,
       reporter.username as reporter_username,
       left(post.body, 140) as post_preview,
       university.name as university_name
     from public.university_post_reports report
     join public.university_posts post
       on post.id = report.post_id
     join public.users reporter
       on reporter.id = report.user_id
     join public.universities university
       on university.id = report.university_id
     order by
       case report.status when 'open' then 0 else 1 end,
       report.created_at desc
     limit $1`,
    [limit]
  );

  return result.rows.map<AdminPostReport>((row) => ({
    id: row.id,
    postId: row.post_id,
    reason: row.reason,
    status: row.status,
    createdAt: iso(row.created_at) || "",
    reporterName: row.reporter_name,
    reporterEmail: row.reporter_email,
    reporterUsername: row.reporter_username,
    postPreview: row.post_preview,
    universityName: row.university_name
  }));
}

export async function getAdminSocialOverview(): Promise<AdminSocialOverview> {
  const pool = await getReadyPool();
  const result = await pool.query<{
    total_users: number;
    verified_users: number;
    total_posts: number;
    pending_reports: number;
    active_universities: number;
  }>(
    `select
       (select count(*)::int
        from public.users app_user
        where app_user.deleted_at is null
          and app_user.role = 'user') as total_users,
       (select count(*)::int
        from public.users app_user
        where app_user.deleted_at is null
          and app_user.role = 'user'
          and app_user.student_status = 'verified') as verified_users,
       (select count(*)::int
        from public.university_posts post
        where post.status <> 'deleted') as total_posts,
       (select count(*)::int
        from public.university_post_reports report
        where report.status = 'open') as pending_reports,
       (select count(*)::int
        from public.universities university
        where university.status = 'active') as active_universities`
  );

  const row = result.rows[0];
  return {
    totalUsers: row?.total_users || 0,
    verifiedUsers: row?.verified_users || 0,
    totalPosts: row?.total_posts || 0,
    pendingReports: row?.pending_reports || 0,
    activeUniversities: row?.active_universities || 0
  };
}

export async function listAdminSocialUsers(input: {
  query?: string | null;
  universityId?: string | null;
  studentStatus?: string | null;
  limit?: number;
} = {}) {
  const pool = await getReadyPool();
  const query = input.query?.trim() || null;
  const universityId = input.universityId?.trim() || null;
  const studentStatus = input.studentStatus?.trim() || null;
  const result = await pool.query<{
    id: string;
    display_name: string;
    username: string | null;
    email: string;
    university_name: string | null;
    university_slug: string | null;
    status: string;
    student_status: string;
    posts_count: number;
    reports_count: number;
    created_at: Date | string;
  }>(
    `select
       app_user.id,
       coalesce(app_user.display_name, app_user.name) as display_name,
       app_user.username,
       app_user.email,
       university.name as university_name,
       university.slug as university_slug,
       app_user.status,
       app_user.student_status,
       (select count(*)::int
        from public.university_posts post
        where post.user_id = app_user.id
          and post.status <> 'deleted') as posts_count,
       (select count(*)::int
        from public.university_post_reports report
        where report.user_id = app_user.id) as reports_count,
       app_user.created_at
     from public.users app_user
     left join public.universities university
       on university.id = app_user.university_id
     where app_user.role = 'user'
       and app_user.deleted_at is null
       and ($1::text is null or (
         app_user.email ilike '%' || $1 || '%'
         or app_user.name ilike '%' || $1 || '%'
         or app_user.username ilike '%' || $1 || '%'
       ))
       and ($2::uuid is null or app_user.university_id = $2::uuid)
       and ($3::text is null or app_user.student_status = $3)
     order by app_user.created_at desc
     limit $4`,
    [query, universityId, studentStatus, input.limit || 50]
  );

  return result.rows.map<AdminSocialUser>((row) => ({
    id: row.id,
    displayName: row.display_name,
    username: row.username,
    email: row.email,
    universityName: row.university_name,
    universitySlug: row.university_slug,
    status: row.status,
    studentStatus: row.student_status,
    postsCount: row.posts_count,
    reportsCount: row.reports_count,
    createdAt: iso(row.created_at) || ""
  }));
}

export async function listAdminSocialUniversities() {
  const pool = await ensureUniversitySchemaReady();
  const result = await pool.query<{
    id: string;
    slug: string;
    name: string;
    university_email_domain: string;
    email_domains: string[] | null;
    country_code: string | null;
    country_name: string | null;
    city: string | null;
    website_url: string | null;
    status: string;
    student_count: number;
    post_count: number;
    created_at: Date | string;
  }>(
    `select
       university.id,
       university.slug,
       university.name,
       university.university_email_domain,
       university.email_domains,
       university.country_code,
       university.country_name,
       university.city,
       university.website_url,
       university.status,
       (select count(*)::int
        from public.users app_user
        where app_user.university_id = university.id
          and app_user.deleted_at is null
          and app_user.role = 'user') as student_count,
       (select count(*)::int
        from public.university_posts post
        where post.university_id = university.id
          and post.status <> 'deleted') as post_count,
       university.created_at
     from public.universities university
     order by university.name asc`
  );

  return result.rows.map<AdminSocialUniversity>((row) => {
    const emailDomains = normalizeEmailDomains(row.email_domains || row.university_email_domain || []);
    return {
      id: row.id,
      slug: row.slug,
      name: row.name,
      universityEmailDomain: emailDomains[0] || row.university_email_domain,
      emailDomains,
      countryCode: row.country_code,
      countryName: row.country_name,
      city: row.city,
      websiteUrl: row.website_url,
      status: row.status,
      studentCount: row.student_count,
      postCount: row.post_count,
      createdAt: iso(row.created_at) || ""
    };
  });
}

export async function setAdminUserStatus(userId: string, status: "active" | "suspended") {
  const pool = await getReadyPool();
  await pool.query(
    `update public.users
     set status = $2,
         suspended_at = case when $2 = 'suspended' then now() else null end,
         updated_at = now()
     where id = $1
       and role = 'user'`,
    [userId, status]
  );
}

export async function resetAdminUserUsername(userId: string) {
  const pool = await getReadyPool();
  await pool.query(
    `update public.users app_user
     set username = public.generate_unique_public_username(
           coalesce(nullif(btrim(app_user.display_name), ''), app_user.name),
           app_user.email,
           app_user.id
         ),
         updated_at = now()
     where app_user.id = $1
       and app_user.role = 'user'`,
    [userId]
  );
}

function normalizeSlug(value: string) {
  return value.trim().toLowerCase().replace(/[^a-z0-9-]+/g, "-").replace(/^-+|-+$/g, "");
}

export async function upsertAdminUniversity(input: {
  id?: string | null;
  slug: string;
  name: string;
  emailDomains: string[];
  countryCode?: string | null;
  countryName?: string | null;
  city?: string | null;
  websiteUrl?: string | null;
  status: "active" | "inactive";
}) {
  const slug = normalizeUniversitySlug(input.slug);
  const name = input.name.trim();
  const emailDomains = normalizeEmailDomains(input.emailDomains);
  const primaryDomain = emailDomains[0] || "";
  if (!slug || !name || !primaryDomain) throw new Error("invalid_university_payload");

  const pool = await ensureUniversitySchemaReady();
  if (input.id) {
    await pool.query(
      `update public.universities
       set slug = $2,
           name = $3,
           university_email_domain = $4,
           email_domains = $5,
           country_code = $6,
           country_name = $7,
           city = $8,
           website_url = $9,
           status = $10,
           updated_at = now()
       where id = $1`,
      [
        input.id,
        slug,
        name,
        primaryDomain,
        emailDomains,
        input.countryCode?.trim() || null,
        input.countryName?.trim() || null,
        input.city?.trim() || null,
        input.websiteUrl?.trim() || null,
        input.status
      ]
    );
    return;
  }

  await pool.query(
    `insert into public.universities (
       slug, name, university_email_domain, email_domains, country_code, country_name, city, website_url, status
     )
     values ($1, $2, $3, $4, $5, $6, $7, $8, $9)
     on conflict (slug) do update
       set name = excluded.name,
           university_email_domain = excluded.university_email_domain,
           email_domains = excluded.email_domains,
           country_code = excluded.country_code,
           country_name = excluded.country_name,
           city = excluded.city,
           website_url = excluded.website_url,
           status = excluded.status,
           updated_at = now()`,
    [
      slug,
      name,
      primaryDomain,
      emailDomains,
      input.countryCode?.trim() || null,
      input.countryName?.trim() || null,
      input.city?.trim() || null,
      input.websiteUrl?.trim() || null,
      input.status
    ]
  );
}

export async function setAdminPostStatus(postId: string, status: "active" | "hidden" | "deleted") {
  const pool = await getReadyPool();
  await pool.query(
    `update public.university_posts
     set status = $2
     where id = $1`,
    [postId, status]
  );
}

export async function setAdminReportStatus(input: {
  reportId: string;
  status: "resolved" | "dismissed";
  adminEmail: string;
}) {
  const pool = await getReadyPool();
  await pool.query(
    `update public.university_post_reports
     set status = $2,
         resolved_by = $3,
         resolved_at = now()
     where id = $1`,
    [input.reportId, input.status, input.adminEmail]
  );
}
