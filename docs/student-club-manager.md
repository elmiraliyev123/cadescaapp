# Student Club Manager architecture

## Existing architecture assessment

Cadesca is one Next.js 15 App Router application deployed as a multi-domain service. Host routing in `src/middleware.ts` maps `studentclub.cadesca.com`, `auth.cadesca.com`, `events.cadesca.com`, and the main Cadesca host onto domain-specific route trees without duplicating the application or database. React 19, TypeScript, Tailwind, server components, route handlers, and server actions are used throughout.

Postgres is the canonical data layer. Supabase provides managed Postgres and object storage; Cadesca's server modules use the existing `pg` pool for domain operations and the service-role storage client for authorized media operations. Cadesca's signed HTTP-only user session cookie remains the first-party browser session. The existing authorization-code/PKCE implementation at the Auth host is the authorization boundary for registered clients.

The pre-refactor Student Club surface mixed unauthenticated onboarding with the application form, treated the portal as a single-club application page, and did not provide a complete operational workspace. Events and club-authored posts already had useful canonical models and were retained rather than copied.

## Authentication and routing

The Student Club client now follows this sequence:

```text
studentclub.cadesca.com
  -> clean unauthenticated landing page
  -> auth.cadesca.com/authorize (state + nonce + PKCE)
  -> exact allowlisted /auth/callback
  -> server-side code exchange and immutable sub validation
  -> /resolve
  -> trusted database state resolver
```

The OAuth access token is consumed only by the server-side callback and is never placed in a browser URL or local storage. Callback state is signed, short-lived, HTTP-only, SameSite=Lax, and Secure in production. `return_to` accepts only known local Student Club route shapes; `/resolve` revalidates that an application or dashboard destination belongs to the signed-in user.

Resolver outcomes are:

- no application or managed club: `/application`
- active draft: `/application/:id`
- submitted, changes-requested, or rejected application: `/application/:id/status`
- one approved club: `/dashboard/:clubSlug`
- multiple approved clubs: `/clubs`

Pending applicants see only the application status experience. They do not receive a disabled dashboard.

## Route map

The public/authenticated Student Club host exposes:

- `/` — login or authenticated resolver redirect
- `/auth/start`, `/auth/callback` — Cadesca authorization client flow
- `/resolve` — trusted post-login state resolution
- `/application`, `/application/:id`, `/application/:id/status`
- `/clubs` — multi-club selector
- `/dashboard/:clubSlug` — operational overview
- `/dashboard/:clubSlug/events`, `/events/new`, `/events/:eventId`, `/events/:eventId/edit`, `/events/:eventId/check-in`
- `/dashboard/:clubSlug/posts`, `/posts/new`, `/posts/:postId/edit`
- `/dashboard/:clubSlug/team`, `/profile`, `/media`, `/analytics`, `/settings`, `/more`

Middleware rewrites these host routes to the existing internal App Router modules. It also protects application, selector, and dashboard paths with the Cadesca session.

## Canonical domain data

The manager uses the existing canonical tables:

- `users`, `universities`
- `student_clubs`, `club_memberships`
- `events`, `event_images`, `event_registrations`, `event_checkins`
- `university_posts`
- `notifications`, `event_audit_logs`

No manager-specific event or post copies are created. Publishing in Student Club Manager updates the same records consumed by main Cadesca and Events. Club posts use `actor_type = 'club'` and retain `created_by_user_id`/`updated_by_user_id` for private auditability.

The additive migration introduces application drafts/history, media catalog records, append-only club audit records, post workflow metadata, club profile/application metadata, invite expiry, the viewer role, and supporting indexes. Existing users, clubs, events, tickets, and posts are preserved.

## Permission model

Backend authorization is capability-based. Current roles are Owner, Admin, Event Manager, Content Manager, Viewer, Member, plus compatible legacy operational roles. Capabilities include separate rights for workspace access, posts, events, attendee data, check-in, finance, team membership, roles, profile, settings, analytics, and audit access.

Every management query validates this chain server-side:

```text
active Cadesca user
  -> active membership
  -> approved club
  -> required capability
  -> requested event/post/media belongs to that club
```

Frontend visibility is only a usability layer. Event moderation state is never writable by club actions. Capacity changes and registration mutations use locked transactions and cannot reduce capacity below consumed reservations or oversell concurrent requests.

## Migration and release assumptions

Migration: `supabase/migrations/20260815205425_student_club_manager_platform.sql`

Release order:

1. Back up and test against a production-like database.
2. Run Supabase migration lint and database integration tests with Docker/Supabase available.
3. Apply the additive migration.
4. Confirm required storage buckets and CORS/domain configuration.
5. Configure the exact Student Club OAuth redirect URI and production domain environment variables.
6. Deploy the application and smoke-test login, resolver outcomes, a draft application, a manager mutation, media access, and logout.

The migration intentionally does not delete old club/application data or create duplicate events/posts. New tables are RLS-enabled, direct anon/authenticated Data API access is revoked, and only the service role is granted access. Audit logs are append-only. The production migration was not applied as part of local implementation.

## Reused components and behavior

The implementation retains Cadesca's localization, typography, black/warm-white/yellow design language, notification service, canonical event ticket/reservation/check-in logic, image moderation and Supabase storage, existing event audit records, registered OAuth client infrastructure, and common form/button/card components. The dashboard is intentionally denser than the application and marketing surfaces while remaining responsive for mobile Safari.
