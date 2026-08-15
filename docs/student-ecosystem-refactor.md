# Student ecosystem refactor

## Repository audit

- **Frontend:** Next.js 15 App Router with React 19, server components/actions, Tailwind CSS, and host-aware rewrites in `src/middleware.ts`. Student pages live under `src/app/app/user`; the club workspace is internally under `src/app/app/club` and externally exposed by `studentclub.cadesca.com`.
- **Backend/API:** Next.js route handlers and server modules backed by PostgreSQL through `pg`; Supabase SSR/Auth and Storage are also used. JSON APIs generally return a typed `{ error }` code and use existing request rate limiting.
- **Database:** additive SQL migrations under `supabase/migrations`. Core entities are `users`, `universities`, `student_clubs`, `club_memberships`, `university_posts`, `events`, `event_tickets`, scanner/payment tables, and append-only `event_audit_logs`.
- **Authentication:** Cadesca currently bridges a signed `cadesca_user_session` and Supabase Auth cookies. Cookies are secure/httpOnly in production and scoped to `.cadesca.com`. The new external-client boundary is Authorization Code + PKCE with exact redirect allowlists, short-lived one-time codes, hashed opaque tokens, minimal scopes, and immutable `users.id` as `sub`.
- **Verification:** trusted fields already exist on `users`: `email_verified`, `student_status`, `university_id`, and the joined university slug/domain. BilMatch eligibility is centralized in `src/lib/auth/clientAccessPolicy.ts` and is re-evaluated by the authorization server.
- **Explore/search:** Explore previously mixed feature cards with another large post feed and had no global search. It now exposes typed People/Post/Club/Event search with debounce and a six-post discovery slice rather than a second Home feed.
- **Events:** `public.events` is the canonical model for student discovery, public discovery, club management, ticketing, payment review, capacity, and check-in. Existing ticket functions already use row/advisory locks and transactions. `events.cadesca.com` reads this same source.
- **Clubs:** application/review, approved club profiles, invitations, operational roles, and event tools existed. The refactor adds capability authorization, multi-club selection, club-authored posts, and separates management from consumer discovery.
- **Posts/notifications/card:** the social feed, follows, likes/comments/reports, media proxying, computed activity, Student Pass QR, and Wallet integration are retained. Product notifications are now durable while social activity remains compatible. Profile keeps one clear Student card entry point.
- **Files/images:** private Supabase Storage buckets and server media routes are reused. Images are MIME/size checked, moderated, stored as object references, and cleaned up when replacement/deletion succeeds; database rows do not contain base64 images.
- **Deployment:** one Next.js deployment currently serves host-specific surfaces. Expected hosts are `app.cadesca.com`, `auth.cadesca.com`, `studentclub.cadesca.com`, `events.cadesca.com`, and the existing public site. BilMatch remains an external client at `bilmatch.com.tr`.

## Trust boundaries and migration

Apply `supabase/migrations/20260815000000_student_ecosystem_foundation.sql` after the existing Events/social migrations. It is additive and backfills post actors and event discovery fields without deleting existing records or tickets. It adds capability-compatible roles, explicit event moderation/visibility, event galleries, durable notifications, and the OAuth client/code/token registry.

Club lifecycle state remains separate from event lifecycle state, and `moderation_status = 'platform_suspended'` remains platform-owned. Club operations cannot clear it. Capacity changes are serialized and rejected below consumed confirmed/held reservations. All club mutations resolve the acting user and active membership server-side; client-provided club/event IDs are targets, never authority.

OAuth codes are the only credential carried through callbacks. Access tokens are not placed in browser URLs. The seeded Student Club and BilMatch callbacks are exact allowlisted URIs. Add environment-specific callback rows explicitly rather than accepting a wildcard or arbitrary `return_to` URL.

## Primary implementation modules

- Navigation/header/Explore: `src/components/app`, `src/components/social/UserSocialScreens.tsx`, `src/components/search/ExploreSearch.tsx`
- Unified search: `src/lib/server/exploreSearch.ts`, `src/app/api/explore/search/route.ts`
- Auth and policy: `src/lib/server/oauth.ts`, `src/lib/auth`, `src/app/authorize`, `src/app/api/oauth`
- Club workspace/posts: `src/lib/clubs/permissions.ts`, `src/lib/server/clubPosts.ts`, `src/app/app/club`, `src/components/clubs`
- Canonical Events: `src/lib/server/events.ts`, `src/components/events`, `src/app/events`, `src/app/event`
- Host routing/deployment: `src/middleware.ts`, `.env.example`, `docs/cadesca-events-deployment.md`

## Release order

1. Apply the additive migration in staging and validate backfills/indexes.
2. Deploy backend authorization, OAuth, Events, club-post, notification, and search modules.
3. Deploy the main Cadesca navigation/Explore changes and public Events host.
4. Enable the Student Club host and exact OAuth callback.
5. Configure BilMatch’s server callback to exchange the code and key its account by `sub`.
6. Run authorization/domain tests, existing Events/club suites, typecheck, build, and mobile/a11y smoke tests before production promotion.
