#!/usr/bin/env node
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { mkdtempSync, readFileSync, writeFileSync, rmSync, mkdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { resolve, join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const [sourceArg, binaryArg, mode] = process.argv.slice(2);
if (!sourceArg || !binaryArg || (mode && mode !== '--check') || process.argv.length > 5) {
  console.error('Usage: node scripts/sync-docs.mjs <core-checkout> <built-core-binary> [--check]');
  process.exit(1);
}
const source = resolve(sourceArg);
const binary = resolve(binaryArg);
const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const git = (...args) => execFileSync('git', ['-C', source, ...args], { encoding: 'utf8' });
const revision = git('rev-parse', 'HEAD').trim();
if (git('status', '--porcelain', '--untracked-files=no').trim()) {
  throw new Error('Commit the core changes first: snapshots require a clean, committed source tree.');
}
const hash = text => createHash('sha256').update(text).digest('hex');
const manifest = {
  repository: 'y0geshpatil/sl-dbg',
  revision,
  mcpBinarySha256: hash(readFileSync(binary)),
  pages: {
    'getting-started': { title: 'Installation and first session', path: 'docs/getting-started.md' },
    adapters: { title: 'Language adapters', path: 'docs/adapters.md', source: 'docs/ADAPTERS.md' },
    mcp: {
      title: 'MCP reference', path: 'docs/mcp.md',
      source: 'scripts/gen-mcp-docs.py', linkBase: 'docs/MCP.md',
      note: 'Generated with evaluation enabled for introspection. Normal safe mode denies evaluation calls; read-only registrations hide mutating tools.'
    },
    'agent-guide': { title: 'AI agent guide', path: 'docs/agent-guide.md', source: 'docs/AGENT-GUIDE.md' },
    commands: {
      title: 'CLI reference', path: 'docs/commands.md', source: 'docs/COMMANDS.md',
      note: 'Adapter capabilities vary. Use sl-dbg --help and each command’s --help for the options supported by your installed binary.'
    },
    configuration: {
      title: 'Configuration design (planned)', path: 'docs/configuration.md', source: 'docs/CONFIGURATION.md',
      note: 'Planned design, not an implemented configuration file. Use documented CLI flags and environment variables for current policy.'
    },
    platforms: { title: 'Platforms', path: 'docs/platforms.md', source: 'docs/PLATFORMS.md' },
    design: {
      title: 'Architecture and design notes', path: 'docs/design.md', source: 'docs/DESIGN.md',
      note: 'Design notes describe goals as well as implementation. They are not a current feature or platform support contract.'
    },
    security: { title: 'Threat model', path: 'docs/security.md', source: 'docs/SECURITY.md' },
    'security-review': { title: 'Reviewing releases', path: 'docs/security-review.md' }
  }
};
const files = new Map();
for (const [slug, page] of Object.entries(manifest.pages)) {
  if (!page.source || slug === 'mcp') continue;
  files.set(page.path, git('show', `${revision}:${page.source}`));
}
const scratch = mkdtempSync(join(tmpdir(), 'sl-dbg-site-docs-'));
try {
  const generator = join(scratch, 'gen-mcp-docs.py');
  writeFileSync(generator, git('show', `${revision}:scripts/gen-mcp-docs.py`));
  const home = join(scratch, 'home');
  mkdirSync(home);
  const mcp = execFileSync('python3', [generator, binary], {
    cwd: scratch,
    encoding: 'utf8',
    timeout: 30000,
    maxBuffer: 4 * 1024 * 1024,
    env: {
      ...process.env, HOME: home,
      XDG_CONFIG_HOME: join(home, '.config'),
      XDG_STATE_HOME: join(home, '.local/state'),
      XDG_CACHE_HOME: join(home, '.cache'),
      SL_DBG_SOCKET: join(scratch, 'daemon.sock')
    }
  });
  if (!mcp.includes('#### `debug_start`') || !mcp.includes('#### `debug_locals`')) {
    throw new Error('MCP generation returned an incomplete tool reference; refusing to replace the snapshot.');
  }
  // The generator date changes without a contract change. Pin provenance to
  // source revision instead so repeat sync/check runs are deterministic.
  files.set('docs/mcp.md', mcp.replace(
    /introspection on \*\*\d{4}-\d{2}-\d{2}\*\*/,
    `introspection at core commit \`${revision}\``
  ));
  for (const page of Object.values(manifest.pages)) {
    if (files.has(page.path)) page.sha256 = hash(files.get(page.path));
  }
  files.set('docs-manifest.json', JSON.stringify(manifest, null, 2) + '\n');
  for (const [path, text] of files) {
    if (mode === '--check') {
      if (readFileSync(join(root, path), 'utf8') !== text) {
        throw new Error(`${path} differs from the selected core snapshot. Run sync, review, and commit it.`);
      }
    } else {
      writeFileSync(join(root, path), text);
    }
  }
  console.log(`${mode === '--check' ? 'Verified' : 'Synced'} ${files.size - 1} documents from ${manifest.repository}@${revision}`);
} finally {
  rmSync(scratch, { recursive: true, force: true });
}
