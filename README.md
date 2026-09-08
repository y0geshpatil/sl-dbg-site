# sl-dbg website

Static HTML, CSS, JavaScript, and Markdown. No application build or package install is needed. The novice journey starts at `docs.html?p=getting-started`.

## Source of truth

The **core repository** (`y0geshpatil/sl-dbg`) owns installer/uninstaller behavior, CLI and MCP APIs, adapters, platform support, configuration, and security policy. Fix those documents in core first.

This repository owns the homepage, viewer, `docs/getting-started.md`, and `docs/security-review.md`. Other `docs/*.md` files are committed snapshots, not separately maintained references. `docs-manifest.json` records the exact source commit, source paths, snapshot hashes, and the binary hash used for MCP introspection. The viewer displays source provenance and treats embedded HTML as text rather than executable content.

`install.sh` and `uninstall.sh` are compatibility wrappers: they download the canonical `main/scripts/` script into a temporary file, fail if the download fails, and forward arguments/environment/exit status. Do not duplicate installer logic here.

## Refresh the documentation snapshot

Use an isolated, clean **committed** core checkout at a reviewed release or commit. Build the binary in that checkout according to core's instructions. Never generate from an unrelated installed binary.

```bash
node scripts/sync-docs.mjs /absolute/path/to/core-checkout /absolute/path/to/core-checkout/bin/sl-dbg
node scripts/sync-docs.mjs /absolute/path/to/core-checkout /absolute/path/to/core-checkout/bin/sl-dbg --check
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

Check the homepage and `http://127.0.0.1:8000/docs.html` on desktop and mobile. The Markdown renderer is pinned to Marked 12.0.2 from jsDelivr; if it cannot load, the viewer offers raw Markdown links. JavaScript-disabled readers also get a raw setup-guide link.

```bash
node --check app.js
node --check docs.js
bash -n install.sh uninstall.sh
node --test test/*.test.cjs
```

The Node built-in tests need no npm dependencies. They use temporary fixtures and a fake curl to exercise the wrappers without downloading/executing upstream installers or touching a real installation. They also cover link resolution, snapshot integrity, and onboarding command regressions.

## Deployment and release ordering

GitHub Pages is currently configured to serve the **root of `main`** at `https://y0geshpatil.github.io/sl-dbg-site/` (legacy branch-based deployment). There is no site build/deploy workflow. The check workflow does not publish anything or change Pages settings.

Before merging this readiness pass:

1. Merge the coordinated core installer changes first: the site documents the new `~/.local/bin` default, mandatory checksums, no automatic sudo, and fail-closed uninstall.
2. Refresh the core snapshot at the final merged/released commit and review the generated diff. Ensure that provenance commit is reachable on GitHub before publishing the site.
3. If advertising new **binary** behavior, publish and verify the corresponding core release separately. Changing an installer on `main` does not change the latest released binary.
4. Check public asset URLs and the full first-session journey from a clean fixture, then merge the site. Normal Pages branch deployment follows that merge; this work does not trigger it itself.

The verified v0.5.4 release has four platform archives and their checksum manifest but no Java adapter JAR. It also predates the corrected VS Code/Copilot registration behavior. Keep the documented source-build and manual-client-configuration workarounds until a later release includes the fixes and assets. Do not imply that a pipeline configuration change retroactively fixes existing assets. Homebrew remains unavailable while the core release workflow skips its tap step.
