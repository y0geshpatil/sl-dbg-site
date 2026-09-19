# sl-dbg website

Static HTML, CSS, JavaScript, and Markdown. No application build or package install is needed to serve the site. The novice journey starts at `docs/getting-started.html`; old `docs.html?p=getting-started` links still work.

## Source of truth

The **core repository** (`y0geshpatil/sl-dbg`) owns installer/uninstaller behavior, CLI and MCP APIs, adapters, platform support, configuration, and security policy. Fix those documents in core first.

This repository owns the homepage, viewer, `docs/getting-started.md`, and `docs/security-review.md`. Other `docs/*.md` files are committed snapshots, not separately maintained references. `docs-manifest.json` records the exact source commit, source paths, snapshot hashes, and the binary hash used for MCP introspection. The viewer displays source provenance and treats embedded HTML as text rather than executable content.

`install.sh` and `uninstall.sh` are compatibility wrappers: they download the canonical `main/scripts/` script into a temporary file, fail if the download fails, and forward arguments/environment/exit status. Do not duplicate installer logic here.

## Refresh the documentation snapshot

Use an isolated, clean **committed** core checkout at a reviewed release or commit. Build the binary in that checkout according to core's instructions, or use the checksum-verified official binary released from that exact source revision. Pass its absolute path as the second argument below. Never generate from an unrelated installed binary.

```bash
node scripts/sync-docs.mjs /absolute/path/to/core-checkout /absolute/path/to/core-checkout/bin/sl-dbg
node scripts/sync-docs.mjs /absolute/path/to/core-checkout /absolute/path/to/core-checkout/bin/sl-dbg --check
node scripts/generate-site.mjs
node --test test/*.test.cjs
```

The script reads documents and the MCP generator from that checkout's exact Git commit. It invokes the generator with an isolated HOME, XDG directories, and socket; it does not install adapters or edit real MCP configuration. MCP describes the full introspected surface, which can differ from the tools visible under a client's policy. Core's generator must support isolated introspection; use the coordinated readiness commit or a later reviewed commit.

Review the resulting diff, including any roadmap/design claims in canonical documents, and update the site-owned tutorial/homepage to match the implemented contract. Do not turn design goals into support guarantees. Commit snapshots and manifest together. A changed date alone must not churn generated MCP docs.

There is deliberately **no automatic pull from mutable core `main` in a visitor's browser or deployment**. Snapshot refresh is an explicit reviewed step when core behavior changes. Regression checks ensure checked-in snapshot hashes agree with the manifest; `--check` also compares against the selected source checkout and binary.

## Preview and checks

Run a local server from this repository, then open its URL:

```bash
python3 -m http.server 8000 --bind 127.0.0.1
```

Check the homepage, `/docs/getting-started.html`, and the legacy `/docs.html?p=mcp#debug_stack` viewer on desktop and mobile. Static documents need no JavaScript. The legacy viewer still uses Marked 12.0.2 from jsDelivr; its navigation opens static documents even when JavaScript is unavailable.

After changing Markdown, the shared `docs.html` shell, or metadata/rendering in `docs.js`, run `node scripts/generate-site.mjs` and commit the generated HTML and `sitemap.xml`. Generation uses a build-only copy of the same Marked 12.0.2 parser, with the full MIT license, upstream URLs, and SHA-256 hashes in `vendor/`. The test suite checks generation freshness.

Index eligibility is an editorial decision in `docMetadata` in `docs.js`, separate from the unchanged provenance manifest. The reviewed public v0.5.5 source revision and MCP binary hash are explicitly approved; an unknown snapshot fails closed. Configuration/design notes are always `noindex,follow` and excluded from the sitemap. Review release status and site-owned guides before updating eligibility; do not infer development status from an absent manifest field.

```bash
node --check app.js
node --check docs.js
node scripts/generate-site.mjs --check
bash -n install.sh uninstall.sh
node --test test/*.test.cjs
```

The Node built-in tests need no npm dependencies. They use temporary fixtures and a fake curl to exercise the wrappers without downloading/executing upstream installers or touching a real installation. They also cover link resolution, snapshot integrity, and onboarding command regressions.

## Deployment and release ordering

GitHub Pages is currently configured to serve the **root of `main`** at `https://y0geshpatil.github.io/sl-dbg-site/` (legacy branch-based deployment). There is no site build/deploy workflow. The check workflow does not publish anything or change Pages settings.

For each release:

1. Merge the corresponding core changes first. The site documents the `~/.local/bin` default, mandatory checksums, no automatic sudo, and fail-closed uninstall.
2. Refresh the core snapshot at the final merged/released commit and review the generated diff. Ensure that provenance commit is reachable on GitHub before publishing the site.
3. If advertising new **binary** behavior, publish and verify the corresponding core release separately. Changing an installer on `main` does not change the latest released binary.
4. Check public asset URLs and the full first-session journey from a clean fixture, then merge the site through its PR checks. Confirm the Pages build succeeds and the live site serves the expected files; a successful push alone is not deployment confirmation.

The documented release is [v0.5.5](https://github.com/y0geshpatil/sl-dbg/releases/tag/v0.5.5), from public core commit `453306c16fbbb267b41be81dfe9d9dc4800036b5`. Its seven published assets comprise four platform archives, their checksum manifest, the Java adapter JAR, and the JAR's SHA-256 sidecar. MCP documentation is introspected from the checksum-verified released macOS arm64 binary.

v0.5.4's missing Java artifact and old VS Code/Copilot registration are historical migration concerns, not requirements for new users. v0.5.5 fixes the Java line-resume and immediate function-verification bugs; asynchronously bound breakpoints can still display pending. Do not generalize smoke results to every architecture or debugger feature. Homebrew remains unavailable while the core release workflow skips its tap step; Windows and configuration-file presets remain unsupported/planned respectively.

## Search discoverability after deployment

Add the URL-prefix property `https://y0geshpatil.github.io/sl-dbg-site/` in Google Search Console. Use the actual verification meta tag or HTML file Google supplies, not a placeholder. Publish that public verification artifact through the normal review process if required.

Submit `https://y0geshpatil.github.io/sl-dbg-site/sitemap.xml`. In URL Inspection, inspect the homepage and representative canonical docs, check live rendered HTML and crawl access, then compare indexing status and Google's selected canonical. Request indexing when appropriate. Search Console ownership and Google indexing/ranking status must be checked by the site owner; this repository cannot establish them.

Google can render JavaScript and index query URLs. Static HTML makes articles directly available without relying on rendering; the legacy viewer sets a per-document canonical only after a valid load and does not initially block released pages with `noindex`. Sitemaps and canonical tags are signals, not indexing, ranking, rich-result, or timing guarantees. Structured data describes visible product facts without invented ratings or prices. This project-subpath site does not manage the host-root `robots.txt`.

Official guidance: [JavaScript SEO](https://developers.google.com/search/docs/crawling-indexing/javascript/javascript-seo-basics), [canonical URLs](https://developers.google.com/search/docs/crawling-indexing/consolidate-duplicate-urls), [sitemaps](https://developers.google.com/search/docs/crawling-indexing/sitemaps/build-sitemap), and [structured-data policies](https://developers.google.com/search/docs/appearance/structured-data/sd-policies).
