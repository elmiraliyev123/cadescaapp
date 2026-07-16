# Cadesca public-search deployment checklist

Google controls the final search result appearance. Valid metadata and structured data make pages eligible for better understanding and presentation, but do not guarantee a particular rich result.

1. Verify the `cadesca.com` domain property in Google Search Console.
2. Submit `https://cadesca.com/sitemap.xml`.
3. Inspect the homepage with URL Inspection.
4. Inspect one eligible public profile at `/user/[username]`.
5. Inspect one eligible public-preview post at `/post/[postId]`.
6. Request indexing for those representative URLs after deployment.
7. Test the profile page JSON-LD with Google Rich Results Test and Schema Markup Validator.
8. Test the post `DiscussionForumPosting` JSON-LD with Google Rich Results Test.
9. Monitor Search Console Profile page and Discussion forum enhancement reports.
10. Monitor excluded, `noindex`, redirect, and 404 reports for unexpected public URLs.

## Release checks

- Confirm `robots.txt` references the sitemap index and does not block `/user/`, `/post/`, `/media/`, CSS, or JavaScript.
- Confirm app, admin, merchant, login, signup, settings, and other private routes are excluded or `noindex`.
- Confirm profile and post canonical URLs use `https://cadesca.com`.
- Confirm signed Supabase Storage URLs never appear in metadata or JSON-LD.
- Confirm hidden profiles, university-only posts, moderated posts, suspended users, and deleted users return 404 publicly.
- Configure `GOOGLE_SITE_VERIFICATION` only with the Search Console token for the Cadesca domain.
- Configure `CADESCA_OFFICIAL_SOCIAL_URLS` only with verified official Cadesca Instagram, TikTok, or LinkedIn profile URLs. Leave it unset rather than adding unrelated accounts.
