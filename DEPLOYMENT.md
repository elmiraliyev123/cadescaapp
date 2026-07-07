# Deployment Notes

## Environment variables

Configure all required Vercel environment variables before deploying production. This includes server-only values such as `AUTH_SECRET`, `DATABASE_URL`, `RESEND_API_KEY`, Turnstile secrets, admin credentials, and any optional admin access controls.

Admin credentials must be set as Vercel environment variables, not committed:

- `CADESCA_ADMIN_EMAIL` or `CADESCA_ADMIN_EMAILS`
- `CADESCA_ADMIN_PASSWORD`
- `TURNSTILE_SECRET_KEY`
- `NEXT_PUBLIC_TURNSTILE_SITE_KEY`

Optional admin access controls:

- `ADMIN_ALLOWED_IPS`: comma-separated exact IP allowlist.
- `ADMIN_CF_ACCESS_REQUIRED`: set to `true` to require Cloudflare Access JWT validation.
- `CF_ACCESS_TEAM_DOMAIN`: Cloudflare Access team domain, for example `https://team.cloudflareaccess.com`.
- `CF_ACCESS_AUD`: Cloudflare Access application audience tag.
- `ADMIN_CF_ACCESS_TEAM_DOMAIN` / `ADMIN_CF_ACCESS_AUD`: backward-compatible aliases.

## Database schema

Apply the SQL migration in `supabase/migrations/20260606000000_merchant_restaurants_hardening.sql` before creating production merchants. It creates/repairs:

- `merchant_accounts`
- `restaurants`
- the active lower-case merchant email unique index
- restaurant owner/status and merchant restaurant lookup indexes

The migration enables RLS on both public tables. This app uses server-side Postgres access for merchant auth and admin mutations; do not expose these tables through browser clients without explicit least-privilege policies.

## Cloudflare Turnstile

Create a Turnstile widget in Cloudflare and configure:

- `NEXT_PUBLIC_TURNSTILE_SITE_KEY`: public site key for browser widgets.
- `TURNSTILE_SECRET_KEY`: server-only secret key for Siteverify.

Turnstile is rendered on:

- `app.cadesca.com` login
- `app.cadesca.com` signup
- `merchant.cadesca.com` login

Server routes validate tokens with Cloudflare Siteverify. Missing, invalid, or failed validation returns one of:

- `turnstile_missing`
- `turnstile_invalid`
- `turnstile_verification_failed`

## Cloudflare Zero Trust for adminlog.cadesca.com

Protect `adminlog.cadesca.com` with Cloudflare Access before traffic reaches Vercel:

1. Create a Cloudflare Zero Trust Access application for `adminlog.cadesca.com`.
2. Add an allow policy for Elmir's email only.
3. If MacBook-only access is required, enforce it with Cloudflare device posture, WARP, mTLS, or an Access policy. Do not attempt browser-side MacBook detection.
4. Block everyone else.
5. Set `ADMIN_CF_ACCESS_REQUIRED=true`.
6. Set `CF_ACCESS_TEAM_DOMAIN` to the Access team domain, for example `https://team.cloudflareaccess.com`.
7. Set `CF_ACCESS_AUD` to the Access application audience tag.
8. Keep `CADESCA_ADMIN_EMAILS` and `CADESCA_ADMIN_PASSWORD` configured as the second layer after Cloudflare Access.

The app validates `Cf-Access-Jwt-Assertion` in middleware when `ADMIN_CF_ACCESS_REQUIRED=true`. Admin app routes and `/api/admin/*` routes also require the server-side admin session, except `/api/admin/login` and `/api/admin/logout`.

## Debug exposure

`/api/debug/env` returns `404` unless `DEBUG_ENV_STATUS=true`. Remove `DEBUG_ENV_STATUS=true` from Vercel after debugging and redeploy so production does not expose environment diagnostics.

## Redeploy after env changes

Vercel deployments receive environment values at build/runtime for that deployment. After adding or changing environment variables, force a new production deployment so the latest code receives the latest configuration:

```bash
npx vercel --prod --force
```

## Production promotion

The deployment serving users must be a Ready Production deployment, not a Preview deployment. After deploying, verify:

```bash
npx vercel inspect cadesca-app.vercel.app
npx vercel alias ls
```

`cadesca-app.vercel.app` and the custom domains should point to the newest Ready Production deployment.
