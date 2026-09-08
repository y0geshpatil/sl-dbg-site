const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const { spawnSync } = require('node:child_process');

test('snapshot sync is reproducible, detects drift, and refuses dirty core sources', () => {
  const fixture = fs.mkdtempSync(path.join(os.tmpdir(), 'sl-dbg-sync-test-'));
  try {
    const core = path.join(fixture, 'core');
    const site = path.join(fixture, 'site');
    for (const dir of [core, site]) {
      fs.mkdirSync(path.join(dir, 'docs'), { recursive: true });
      fs.mkdirSync(path.join(dir, 'scripts'));
    }
    const env = { ...process.env, HOME: fixture, TMPDIR: fixture };
    const git = (...args) => {
      const result = spawnSync('git', ['-C', core, ...args], { encoding: 'utf8', env });
      assert.equal(result.status, 0, result.stderr);
    };
    git('init', '-q');
    for (const name of ['ADAPTERS', 'AGENT-GUIDE', 'COMMANDS', 'CONFIGURATION', 'PLATFORMS', 'DESIGN', 'SECURITY']) {
      fs.writeFileSync(path.join(core, 'docs', name + '.md'), '# ' + name + '\n');
    }
    fs.writeFileSync(path.join(core, 'scripts/gen-mcp-docs.py'),
      'print("# MCP\\n\\n#### `debug_start`\\n\\n#### `debug_locals`\\n")\n');
    git('add', '.');
    git('-c', 'user.name=Fixture', '-c', 'user.email=fixture@example.invalid',
      '-c', 'core.hooksPath=/dev/null', '-c', 'commit.gpgsign=false', 'commit', '-qm', 'Fixture source');
    const binary = path.join(fixture, 'fixture-binary');
    fs.writeFileSync(binary, 'Fixture binary fingerprint; generator does not execute it.\n');
    const script = path.join(site, 'scripts/sync-docs.mjs');
    fs.copyFileSync(path.join(__dirname, '../scripts/sync-docs.mjs'), script);
    const run = (...args) => spawnSync(process.execPath, [script, core, binary, ...args], {
      env, encoding: 'utf8'
    });
    let result = run();
    assert.equal(result.status, 0, result.stderr);
    const snapshot = fs.readFileSync(path.join(site, 'docs-manifest.json'), 'utf8');
    result = run('--check');
    assert.equal(result.status, 0, result.stderr);
    assert.equal(fs.readFileSync(path.join(site, 'docs-manifest.json'), 'utf8'), snapshot);
    fs.appendFileSync(path.join(site, 'docs/adapters.md'), 'Unexpected edit\n');
    result = run('--check');
    assert.notEqual(result.status, 0);
    assert.match(result.stderr, /differs from the selected core snapshot/);
    result = run();
    assert.equal(result.status, 0, result.stderr);
    fs.appendFileSync(path.join(core, 'docs/ADAPTERS.md'), 'Uncommitted change\n');
    result = run();
    assert.notEqual(result.status, 0);
    assert.match(result.stderr, /Commit the core changes first/);
    assert.deepEqual(fs.readdirSync(fixture).filter(name => name.startsWith('sl-dbg-site-docs-')), []);
  } finally {
    fs.rmSync(fixture, { recursive: true, force: true });
  }
});
