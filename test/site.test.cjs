const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const { spawnSync } = require('node:child_process');
const { createHash } = require('node:crypto');
const { resolveDocLink, slugify } = require('../docs.js');

const root = path.resolve(__dirname, '..');
const read = file => fs.readFileSync(path.join(root, file), 'utf8');
const manifest = JSON.parse(read('docs-manifest.json'));

test('uppercase, nested and generated-document links resolve against their source root', () => {
  const page = manifest.pages.commands;
  for (const href of ['SECURITY.md', './security.md', 'docs/SECURITY.md', '../docs/SECURITY.md']) {
    assert.equal(resolveDocLink(href + '#threat-model', page, manifest), '?p=security#threat-model');
  }
  assert.equal(resolveDocLink('../SECURITY.md', page, manifest),
    `https://github.com/${manifest.repository}/blob/${manifest.revision}/SECURITY.md`);
  assert.equal(resolveDocLink('ROADMAP.md#next', page, manifest),
    `https://github.com/${manifest.repository}/blob/${manifest.revision}/docs/ROADMAP.md#next`);
  assert.equal(resolveDocLink('SECURITY.md', manifest.pages.mcp, manifest), '?p=security');
  assert.equal(resolveDocLink('mcp.md', manifest.pages['getting-started'], manifest), '?p=mcp');
  assert.equal(resolveDocLink('../install.sh', manifest.pages['security-review'], manifest), 'install.sh');
  for (const href of ['#local', 'https://example.com/README.md', 'mailto:example@example.com']) {
    assert.equal(resolveDocLink(href, page, manifest), href);
  }
});

test('heading anchors preserve words, underscores and Unicode', () => {
  assert.equal(slugify('First debug session'), 'first-debug-session');
  assert.equal(slugify('`debug_start`'), 'debug_start');
  assert.equal(slugify('Étape 1: Python'), 'étape-1-python');
});

test('documentation snapshot has exact provenance and matching hashes', () => {
  assert.equal(manifest.repository, 'y0geshpatil/sl-dbg');
  assert.match(manifest.revision, /^[a-f0-9]{40}$/);
  assert.match(manifest.mcpBinarySha256, /^[a-f0-9]{64}$/);
  for (const page of Object.values(manifest.pages)) {
    const content = read(page.path);
    assert.ok(content.startsWith('# '), page.path);
    if (page.source) {
      assert.equal(createHash('sha256').update(content).digest('hex'), page.sha256, page.path);
    }
  }
});

test('HTML links point at known pages, files and anchors', () => {
  for (const file of ['index.html', 'docs.html']) {
    const html = read(file);
    const ids = [...html.matchAll(/\bid="([^"]+)"/g)].map(match => match[1]);
    assert.equal(ids.length, new Set(ids).size, 'duplicate IDs in ' + file);
    for (const [, href] of html.matchAll(/\bhref="([^"]+)"/g)) {
      if (/^(https?:|mailto:|data:)/.test(href)) continue;
      if (href.startsWith('#')) {
        assert.ok(ids.includes(href.slice(1)), `${file}: ${href}`);
        continue;
      }
      const url = new URL(href, 'https://example.test/' + file);
      const requested = url.searchParams.get('p');
      if (requested) assert.ok(Object.hasOwn(manifest.pages, requested), `${file}: ${href}`);
      const localPath = url.pathname === '/' ? 'index.html' : url.pathname.slice(1);
      assert.ok(fs.existsSync(path.join(root, localPath)), `${file}: ${href}`);
    }
  }
});

test('installation and first-session commands do not regress', () => {
  const html = read('index.html');
  const guide = read('docs/getting-started.md');
  assert.doesNotMatch(html + guide, /INSTALL_DIR=[^\n|]*\bcurl\b/);
  assert.doesNotMatch(html, /v0\.1\.0|--sess\b|step-in|step-out|watch add|watch eval|watch list|signed release binaries|Install in 30 seconds/);
  assert.match(html, /curl[^"]+ \| INSTALL_DIR=&quot;\$HOME\/\.local\/bin&quot; bash/);
  assert.match(guide, /sl-dbg break sl-dbg-demo\.py:4/);
  assert.match(guide, /total = 55/);
  assert.match(guide, /v0\.5\.4 release has no Java adapter JAR/);
  assert.match(guide, /--dry-run/);
  assert.match(guide, /--keep-mcp/);
  assert.match(guide, /sl-dbg mcp install claude --allow-program "\$PWD\/sl-dbg-demo\.py" --dry-run/);
});

for (const wrapper of ['install.sh', 'uninstall.sh']) {
  for (const scenario of ['success', 'download-failure', 'upstream-failure']) {
    test(`${wrapper}: ${scenario} preserves the upstream contract without a real install`, () => {
      const fixture = fs.mkdtempSync(path.join(os.tmpdir(), 'sl-dbg-wrapper-'));
      try {
        const bin = path.join(fixture, 'bin');
        const tmp = path.join(fixture, 'tmp');
        fs.mkdirSync(bin);
        fs.mkdirSync(tmp);
        fs.writeFileSync(path.join(bin, 'curl'), `#!/usr/bin/env bash
set -eu
printf '%s\\n' "$@" > "$CURL_ARGS"
while [ "$#" -gt 0 ]; do
  if [ "$1" = "-o" ]; then shift; output="$1"; fi
  shift
done
cp "$UPSTREAM" "$output"
exit "$CURL_STATUS"
`, { mode: 0o755 });
        fs.writeFileSync(path.join(fixture, 'upstream.sh'), `#!/usr/bin/env bash
printf '%s\\n' "$@" > "$RESULT"
printf '%s\\n' "$INSTALL_DIR" >> "$RESULT"
exit "$UPSTREAM_STATUS"
`);
        const result = path.join(fixture, 'result');
        const curlArgs = path.join(fixture, 'curl-args');
        const child = spawnSync('bash', [path.join(root, wrapper), '--flag', 'value with spaces', ''], {
          encoding: 'utf8',
          env: {
            ...process.env, HOME: fixture, TMPDIR: tmp,
            PATH: bin + path.delimiter + process.env.PATH,
            INSTALL_DIR: path.join(fixture, 'install with spaces'),
            UPSTREAM: path.join(fixture, 'upstream.sh'), RESULT: result,
            CURL_ARGS: curlArgs,
            CURL_STATUS: scenario === 'download-failure' ? '22' : '0',
            UPSTREAM_STATUS: scenario === 'upstream-failure' ? '17' : '0'
          }
        });
        const expected = scenario === 'download-failure' ? 22 : scenario === 'upstream-failure' ? 17 : 0;
        assert.equal(child.status, expected, child.stderr);
        assert.match(fs.readFileSync(curlArgs, 'utf8'),
          new RegExp(`https://raw.githubusercontent.com/y0geshpatil/sl-dbg/main/scripts/${wrapper.replace('.', '\\.')}`));
        if (scenario === 'download-failure') {
          assert.equal(fs.existsSync(result), false, 'partially downloaded script must never run');
        } else {
          assert.equal(fs.readFileSync(result, 'utf8'),
            `--flag\nvalue with spaces\n\n${path.join(fixture, 'install with spaces')}\n`);
        }
        assert.deepEqual(fs.readdirSync(tmp), [], 'downloaded temporary script must be removed');
      } finally {
        fs.rmSync(fixture, { recursive: true, force: true });
      }
    });
  }
}
