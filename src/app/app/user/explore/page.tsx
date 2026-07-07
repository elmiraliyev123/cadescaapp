import { ExploreScreen, SocialUnavailableScreen } from "@/components/social/UserSocialScreens";
import {
  getCurrentStudentContext,
  isVerifiedUniversityStudent,
  listExplorePosts,
  type SocialPost
} from "@/lib/server/social";

export const dynamic = "force-dynamic";

const localMockExplorePosts: SocialPost[] = [
  {
    id: "demo_post_roommates",
    universityId: "demo_bilkent",
    userId: "demo_author_1",
    authorName: "Aylin Demir",
    authorUsername: "aylin.d",
    authorAvatarUrl: null,
    universityName: "Bilkent University",
    universitySlug: "bilkent",
    body: "Looking for two verified students to join a quiet apartment close to campus. DM if you want photos and details.",
    imageUrl: "https://images.unsplash.com/photo-1522708323590-d24dbb6b0267?auto=format&fit=crop&w=1200&q=82",
    status: "active",
    createdAt: new Date(Date.now() - 1000 * 60 * 35).toISOString(),
    updatedAt: new Date(Date.now() - 1000 * 60 * 35).toISOString(),
    likeCount: 18,
    commentCount: 2,
    reportCount: 0,
    likedByCurrentUser: false,
    ownPost: false,
    comments: []
  },
  {
    id: "demo_post_event",
    universityId: "demo_bilkent",
    userId: "demo_author_2",
    authorName: "Mert Kaya",
    authorUsername: "mert.kaya",
    authorAvatarUrl: null,
    universityName: "Bilkent University",
    universitySlug: "bilkent",
    body: "Anyone going to the Friday music night? A few of us are meeting near the library before heading out.",
    imageUrl: "https://images.unsplash.com/photo-1501281668745-f7f57925c3b4?auto=format&fit=crop&w=1200&q=82",
    status: "active",
    createdAt: new Date(Date.now() - 1000 * 60 * 90).toISOString(),
    updatedAt: new Date(Date.now() - 1000 * 60 * 90).toISOString(),
    likeCount: 31,
    commentCount: 5,
    reportCount: 0,
    likedByCurrentUser: true,
    ownPost: false,
    comments: []
  }
];

export default async function UserExploreRoute() {
  try {
    const user = await getCurrentStudentContext();
    const isLocalMockStudent = process.env.NODE_ENV === "development" && user?.id === "user_mock";
    const posts = isLocalMockStudent
      ? localMockExplorePosts
      : isVerifiedUniversityStudent(user)
        ? await listExplorePosts(user)
        : [];
    return <ExploreScreen user={user} posts={posts} />;
  } catch (error) {
    console.error("[user_explore] unavailable", {
      reason: error instanceof Error ? error.message : "unknown"
    });
    return <SocialUnavailableScreen message="Campus community is almost ready." />;
  }
}
