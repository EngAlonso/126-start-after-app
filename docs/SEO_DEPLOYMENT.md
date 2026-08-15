# SEO and mobile deep-link deployment notes

The repository now contains the public SEO and referral-link assets. Production verification is intentionally pending deployment to `https://fnashha.com`.

## Public web

- `artifacts/fnashha/public/robots.txt` is copied to `/robots.txt` and references `/sitemap.xml`.
- `artifacts/fnashha/public/sitemap.xml` is the checked-in fallback for the
  existing public pages. The production web build writes the final sitemap to
  `dist/public/sitemap.xml`, adding current eligible service/area pages.
- `artifacts/fnashha/scripts/prerender-seo.mjs` creates route-specific HTML shells during the web build. The shell contains the title, description, canonical, H1, visible summary text, and internal links before the SPA hydrates.
- The hosting layer must serve the generated route directories (`/services/index.html`, `/faq/index.html`, etc.) before applying the SPA fallback. It must also serve `/sitemap.xml` as XML rather than rewriting it to the SPA.
- The hosting layer must preserve HTTP 404 for unknown URLs. A blanket `/* -> /index.html` rewrite or `try_files ... /index.html` fallback can create soft 404s that look successful to crawlers. The Replit artifact keeps SPA fallback rewrites limited to known application route families and deliberately leaves `/services/<service>/<area>` to static-file resolution; the Nginx example uses the equivalent `try_files ... =404` rule.

## Dynamic service/location landing pages

- Public URLs use `/services/:serviceSlug/:locationSlug`, where `locationSlug`
  is an active area name. The page content also names the area's governorate.
- `/api/seo/landing-pages` derives its inventory from the same relationships
  used by request matching: `technician_services` plus `technician_areas`,
  joined through an approved `technician_profiles` row and an active `users`
  row. Active services, areas, and governorates are required as well.
- The web build runs that source query server-side through the shared API
  utility, prerenders one HTML shell per eligible combination, and generates
  the final sitemap from the same set. No technician identity or private
  profile data is included.
- An unavailable combination returns API 404. The web route renders the
  existing not-found page and applies `noindex, nofollow`. The SEO API and
  browser/admin inventory consumers use `no-store`/zero stale time so
  eligibility changes are not hidden behind the normal 30-second app cache. If availability
  later disappears, rebuild/redeploy the web artifact to remove its
  prerendered HTML and sitemap entry; hydration also rechecks the API so a
  stale shell becomes noindex rather than claiming current availability.
- Slugs are deterministic projections of the existing `name` / `name_ar`
  fields. The current schema has no dedicated public slug column, so changing
  a reference name changes its public URL; a future slug-column migration
  should be treated as a separate URL-stability task.
- The CTA only opens the existing customer request page with service,
  governorate, and area IDs preselected. New visitors pass through the
  existing customer registration page and then continue to that same request
  form.

## Android App Links

`public/.well-known/assetlinks.json` is structurally ready for the Expo package `com.fnashha.app`, but the release keystore is not available in this workspace. Replace `__ANDROID_RELEASE_SHA256_FINGERPRINT__` with the SHA-256 certificate fingerprint from the exact production signing certificate. Do not use the debug certificate.

## iOS Universal Links

`public/.well-known/apple-app-site-association` associates the referral path `/r/*` with `com.fnashha.app`, but Apple requires the production Team ID. Replace `__APPLE_TEAM_ID__` with the Team ID that signs the production iOS build. Serve the file extensionless with `Content-Type: application/json` (or the equivalent JSON content type).

The Expo configuration already declares `applinks:fnashha.com`. Neither Universal Links nor App Links should be considered production-verified until the deployed domain serves these files over HTTPS and the installed release builds are tested.

The bare Expo build uses an explicit `runtimeVersion` of `1.0.0`, which is equivalent to the current app version and is required by the repository's static bundle build. Update it deliberately when releasing a new native runtime.

## Public service detail limitation

The current service model exposes an integer ID, display name, image/icon, and active state but no stable public slug or public-facing description field. This implementation keeps the existing `/services` page crawlable, adds descriptive route content, and does not invent `/services/:slug` pages or expose private request data. A future service-detail feature should add a deliberate public slug/content contract first.
