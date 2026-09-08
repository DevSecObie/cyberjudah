# Publishing and recovery

## Content priorities

The primary entry points are Classes, Precepts, Case Studies, and The Law.
The Bible remains in navigation and supports these collections. Keep existing URLs
and verse anchors stable when reorganizing the homepage.

For new or revised teaching notes:

- Record the teacher and recording date from the source, not inference.
- Distinguish verbatim scripture, paraphrase, and teaching commentary.
- Link scripture quotations to their chapter and verse anchor.
- Use recording timestamps only when verified against the recording.
- Link relevant laws, precepts and cases when the connection is supported by the
  content; do not manufacture relationships to fill a related-content section.

## Publication checks

Run from the repository root:

```sh
node engine/check.mjs
npm test --prefix site
npm run build --prefix site
```

The checker validates supported site-relative note links and Bible verse ranges,
recording dates, and duplicate content URLs. Missing teacher metadata is currently
a warning because legacy records need source review. It is not a complete HTML,
external-video availability, heading-anchor, or browser interaction test.

Pull requests run validation without deployment credentials. Site publication also
runs the link checker. Repository administrators should make the validation job a
required branch-protection check; the workflow alone does not enforce this.

Before accepting a release, run the browser suite documented in `site/e2e/README.md`.
It checks navigation at four widths, class filters and reload/clear behavior,
full-text handoff, and quoted D1 search followed by a verse link. The suite is wired
into pull-request validation and site publication. Recording playback, the homepage
animation, Safari and Firefox still need separate checks.

## What needs recovering

- `main` holds the authored Markdown, JSON reference material, engine and frontend.
- The generated `data` branch is replaced on publication; it is NOT a historical backup.
- The content Worker serves generated files. D1 holds the generated search index.
- The site and data workflows publish independently. Rolling back the site does
  not roll back the content Worker or D1. Verify all three after an incident.

## Recovery procedure

1. Identify the failing component and last known-good source commit from Actions.
   Preserve failure logs and current source; do not force-push or reset `main`.
2. Prepare a reviewed revert of the faulty source changes, run validation, and use
   the existing deployment workflows. A content revert must rebuild the content
   Worker AND reload the D1 search index, not merely redeploy the frontend.
3. For a database-only incident, inspect D1 Time Travel restore points in Cloudflare.
   Confirm the database, timestamp, affected releases and backup before approving
   a production restore. Prefer rebuilding a generated search index when the
   committed source is correct.
4. Confirm the homepage, four priority routes, a known class and Genesis 1:1;
   verify that `"in the beginning"` finds Genesis 1:1 and John 1:1.
5. Record the source commit, restored components, test results and incident cause.

Retain an independent copy of the authored vault and periodic database exports
outside this repository/account. Choose a private backup destination and retention
policy before automating it. A recovery rehearsal should use a separate staging
Worker/database, never overwrite production as a test. No recovery rehearsal or
independent backup has been performed by this change.

Cloudflare reference: https://developers.cloudflare.com/d1/reference/time-travel/

## Error reporting

Worker observability is already enabled in `site/wrangler.jsonc`. Search failures
emit a structured `search_failed` event with elapsed time, without query text or
raw database errors. Visitors receive a generic unavailable reason.

Use Workers Logs to investigate these events alongside request failures. Confirm
account retention and sampling settings before relying on logs for incident history.
Alert routing and external uptime checks still need an owner and notification
destination; neither is configured by these source changes.

Cloudflare reference: https://developers.cloudflare.com/workers/observability/logs/workers-logs/
