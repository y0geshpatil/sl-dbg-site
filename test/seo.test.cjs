const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { spawnSync } = require('node:child_process');
const { createHash } = require('node:crypto');
const { renderDocument, resolveStaticDocLink, siteURL, docMetadata, escapeHTML } = require('../docs.js');
const marked = require('../vendor/marked-12.0.2.min.js');

const root = path.resolve(__dirname, '..');
const read = file => fs.readFileSync(path.join(root, file), 'utf8');
const manifest = JSON.parse(read('docs-manifest.json'));
const decode = value => value.replaceAll('&amp;', '&').replaceAll('&quot;', '"')
  .replaceAll('&#39;', "'").replaceAll('&lt;', '<').replaceAll('&gt;', '>');
const ids = html => [...html.matchAll(/\bid="([^"]+)"/g)].map(match => decode(match[1]));
const sha256 = text => createHash('sha256').update(text).digest('hex');

test('checked-in HTML and sitemap match deterministic generation', () => {
  const result = spawnSync(process.execPath, ['scripts/generate-site.mjs', '--check'], { cwd: root, encoding: 'utf8' });
  assert.equal(result.status, 0, result.stdout + result.stderr);
});

test('static pages contain the full article, unique metadata and self canonicals without JavaScript', () => {
  const titles = new Set();
  const descriptions = new Set();
  const canonicals = new Set();
  for (const [slug, page] of Object.entries(manifest.pages)) {
    const html = read(`docs/${slug}.html`);
    const meta = docMetadata(slug, manifest);
    const title = decode(html.match(/<title>([^<]+)<\/title>/)[1]);
    const description = decode(html.match(/<meta name="description" content="([^"]+)"/)[1]);
    const canonical = decode(html.match(/<link rel="canonical" href="([^"]+)"/)[1]);
    assert.equal(title, meta.title);
    assert.equal(description, meta.description);
    assert.equal(canonical, meta.canonical);
    assert.ok(!titles.has(title) && !descriptions.has(description) && !canonicals.has(canonical));
    titles.add(title); descriptions.add(description); canonicals.add(canonical);
    assert.doesNotMatch(html, /<script\b|Loading documentation|aria-busy="true"|legacy viewer needs/);
    assert.match(html, /\.docs-shell \{[^}]*padding: 40px 28px 80px/);
    const article = html.match(/<article[^>]+>([\s\S]*?)<\/article>/)[1];
    assert.ok(article.length > 1500, slug);
    assert.ok(article.includes(renderDocument(read(page.path), marked, page, manifest)), slug);
    assert.match(article, /<h1 id="[^"]+">/);
    assert.match(article, /<h2 id="[^"]+">/);
    assert.match(article, /docs-provenance/);
    assert.ok(html.includes(`data-doc="${slug}" class="active" aria-current="page"`));
    if (page.note) assert.ok(article.includes(escapeHTML(page.note)));
    if (page.source) assert.ok(article.includes(`/blob/${manifest.revision}/${page.source}`));
    assert.equal(/name="robots" content="noindex,follow"/.test(html), !meta.indexable);
  }
});

test('sitemap contains exactly the homepage and eight eligible released routes with real files', () => {
  const xml = read('sitemap.xml');
  const urls = [...xml.matchAll(/<loc>([^<]+)<\/loc>/g)].map(match => decode(match[1]));
  const slugs = ['getting-started', 'adapters', 'mcp', 'agent-guide', 'commands', 'platforms', 'security', 'security-review'];
  assert.deepEqual(urls, [siteURL, ...slugs.map(slug => `${siteURL}docs/${slug}.html`)]);
  assert.doesNotMatch(xml, /lastmod|changefreq|priority|localhost|127\.0\.0\.1|example\.|docs\.html\?/);
  for (const value of urls) {
    assert.ok(fs.existsSync(path.join(root, value.slice(siteURL.length) || 'index.html')));
  }
  assert.equal(fs.existsSync(path.join(root, 'robots.txt')), false);
});

test('release eligibility approves the original public manifest, never infers development from missing channel', () => {
  assert.equal(manifest.binary, undefined);
  for (const slug of Object.keys(manifest.pages)) {
    assert.equal(docMetadata(slug, manifest).indexable, !['configuration', 'design'].includes(slug), slug);
    assert.doesNotMatch(docMetadata(slug, manifest).title, /development|unreviewed/);
    for (const changed of [{ revision: '0'.repeat(40) }, { mcpBinarySha256: '0'.repeat(64) }, { repository: 'unknown/core' }]) {
      assert.equal(docMetadata(slug, { ...manifest, ...changed }).indexable, false);
    }
  }
  assert.throws(() => docMetadata('__proto__', manifest), /Missing documentation metadata/);
});

test('original released provenance and site-owned guides remain byte-identical', () => {
  assert.equal(sha256(read('docs-manifest.json')), '6bbb23d03cacccdbd896342a0eb5d196bf76028e72204815b045544b8299beed');
  assert.equal(sha256(read('scripts/sync-docs.mjs')), 'd263ba9b068555a393b21fa80f7e394a16495ab4f091929b7dae841e97642913');
  assert.equal(sha256(read('docs/getting-started.md')), '6e308cacc8964a4e5e0c483d1f25e05bdcdce5979ff4950101c346d3b9bb1f87');
  assert.equal(sha256(read('docs/security-review.md')), 'f303edc205636c107b25fdad23447029c197d6bba10d7e736510306384f10bff');
  for (const page of Object.values(manifest.pages)) {
    if (page.source) assert.equal(sha256(read(page.path)), page.sha256, page.path);
  }
});

test('build-only parser matches the legacy CDN version with full license and pinned hashes', () => {
  const metadata = JSON.parse(read('vendor/marked-metadata.json'));
  assert.equal(metadata.version, '12.0.2');
  assert.equal(metadata.license, 'MIT');
  assert.match(read('vendor/marked-LICENSE.md'), /Permission is hereby granted/);
  assert.match(read('vendor/marked-LICENSE.md'), /THE SOFTWARE IS PROVIDED "AS IS"/);
  for (const file of metadata.files) {
    assert.equal(sha256(read(file.path)), file.sha256);
    assert.match(file.url, /^https:\/\/cdn\.jsdelivr\.net\/npm\/marked@12\.0\.2\//);
  }
  assert.ok(read('docs.html').includes(metadata.files[0].url));
});

test('all local links and fragments resolve, including uppercase and nested Markdown source links', () => {
  for (const href of ['SECURITY.md', './security.md', 'docs/SECURITY.md', 'DOCS/SECURITY.md', '../docs/SECURITY.md', '%53ECURITY.md']) {
    assert.equal(resolveStaticDocLink(href + '#threat-model', manifest.pages.commands, manifest), 'security.html#threat-model');
  }
  assert.equal(resolveStaticDocLink('SECURITY.md', manifest.pages.mcp, manifest), 'security.html');
  assert.equal(resolveStaticDocLink('../install.sh', manifest.pages['security-review'], manifest), '../install.sh');
  assert.equal(resolveStaticDocLink('ROADMAP.md#next', manifest.pages.commands, manifest),
    `https://github.com/${manifest.repository}/blob/${manifest.revision}/docs/ROADMAP.md#next`);
  for (const file of ['index.html', 'docs.html', ...Object.keys(manifest.pages).map(slug => `docs/${slug}.html`)]) {
    const html = read(file);
    assert.equal(ids(html).length, new Set(ids(html)).size, file);
    for (const [, encoded] of html.matchAll(/\b(?:href|src)="([^"]+)"/g)) {
      const href = decode(encoded);
      if (/^(?:https?:|mailto:|data:|\/\/)/.test(href)) continue;
      const url = new URL(href, 'https://local.test/' + file);
      const target = url.pathname.endsWith('/') ? url.pathname + 'index.html' : url.pathname;
      assert.ok(fs.existsSync(path.join(root, target)), `${file}: ${href}`);
      if (url.hash && target.endsWith('.html') && !url.searchParams.has('p')) {
        assert.ok(ids(read(target.slice(1))).includes(decodeURIComponent(url.hash.slice(1))), `${file}: missing ${href}`);
      }
    }
  }
});

test('static rendering escapes raw HTML and unsafe URLs with readable GFM and stable anchors', () => {
  const markdown = [
    '# Étape 1', '## Repeat', '## Repeat', '## Repeat-1', '## Content', '## 🧭',
    '## `debug_start` &amp; state', '<script>alert(1)</script>',
    '[script](javascript:alert%281%29)', '[entity](jav&#x61;script:alert%281%29)',
    '[control](java&#x09;script:alert%281%29)', '[named](java&Tab;script:alert%281%29)',
    '[host](http://[)', '![data](data:image/svg+xml,boom)', '![mail](mailto:a@example.com)',
    '[source](DOCS/SECURITY.md#threat-model)', '[web](https://example.com/?a=1&b=2)',
    '| A | B |\n| - | - |\n| x | y |', '- [x] Done', '```sh\n<safe>\n```'
  ].join('\n\n');
  const html = renderDocument(markdown, marked, manifest.pages.commands, manifest);
  assert.deepEqual(ids(html), ['étape-1', 'repeat', 'repeat-1', 'repeat-1-1', 'content-1', 'section', 'debug_start--state']);
  assert.doesNotMatch(html, /<script|href="(?:javascript:|java|http:\/\/\[)|src="(?:data:|mailto:)/);
  assert.match(html, /&lt;script&gt;alert\(1\)&lt;\/script&gt;/);
  assert.match(html, /href="security.html#threat-model"/);
  assert.match(html, /href="https:\/\/example.com\/\?a=1&amp;b=2"/);
  assert.match(html, /<table>/);
  assert.match(html, /<input[^>]+disabled[^>]*>/);
  assert.match(html, /<code class="language-sh">&lt;safe&gt;/);
});

test('homepage schema describes visible facts without invented ratings, prices, versions or images', () => {
  const html = read('index.html');
  assert.equal(html.match(/rel="canonical" href="([^"]+)"/)[1], siteURL);
  const entries = [...html.matchAll(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/g)];
  assert.equal(entries.length, 1);
  const data = JSON.parse(entries[0][1]);
  assert.deepEqual(Object.keys(data).sort(), [
    '@context', '@type', '@id', 'name', 'url', 'description', 'applicationCategory',
    'operatingSystem', 'license', 'downloadUrl', 'sameAs'
  ].sort());
  assert.equal(data['@type'], 'SoftwareApplication');
  assert.equal(data.name, 'sl-dbg');
  assert.equal(data.url, siteURL);
  assert.equal(data.operatingSystem, 'macOS, Linux');
  assert.equal(data.license, 'https://www.apache.org/licenses/LICENSE-2.0');
  assert.equal(data.sameAs, 'https://github.com/y0geshpatil/sl-dbg');
  assert.equal(data.downloadUrl, data.sameAs + '/releases');
  for (const text of ['Python', 'Go', 'Java', 'macOS', 'Linux', 'Apache-2.0', 'Model Context Protocol', 'debug_stack', 'debug_locals', 'sl-dbg stack', 'sl-dbg locals']) {
    assert.ok(html.replace(/<script[\s\S]*?<\/script>/g, '').includes(text), text);
  }
  assert.match(html, /Stateless commands do not mean stateless execution/);
  assert.match(html, /name="twitter:card" content="summary"/);
  assert.doesNotMatch(html, /og:image|twitter:image|assets\/demo|demo\.js|<video|<audio|id="demo"/);
});

async function loadViewer(search, hash = '', snapshot = manifest) {
  function element(tag) {
    return {
      tag, attributes: {}, children: [], textContent: '',
      setAttribute(key, value) { this.attributes[key] = value; },
      append(...children) { this.children.push(...children); },
      prepend(child) { this.children.unshift(child); },
      replaceChildren(...children) { this.children = children; }
    };
  }
  const content = element('article');
  const description = element('meta');
  const head = element('head');
  let scrolled = false;
  const requests = [];
  const document = {
    head,
    querySelector: () => description,
    querySelectorAll: () => [],
    getElementById: id => id === 'content' ? content : { scrollIntoView() { scrolled = true; } },
    createTextNode: text => text,
    createElement(tag) {
      const el = element(tag);
      if (tag === 'template') el.content = { querySelectorAll: () => [] };
      return el;
    }
  };
  vm.runInNewContext(read('docs.js'), {
    document, marked, URL, URLSearchParams,
    location: { search, hash, href: siteURL + 'docs.html' + search + hash },
    async fetch(file) {
      requests.push(file);
      return { ok: true, json: async () => snapshot, text: async () => read(file) };
    }
  });
  await new Promise(setImmediate);
  return { document, content, head, description, requests, scrolled };
}

test('legacy routes load correct metadata for missing, valid, planned and unknown p without blanket noindex', async () => {
  const html = read('docs.html');
  assert.doesNotMatch(html, /name="robots"|rel="canonical"/);
  assert.match(html, /<noscript>[\s\S]*full HTML documents/);
  for (const slug of Object.keys(manifest.pages)) assert.ok(html.includes(`href="docs/${slug}.html"`));
  for (const slug of ['', 'mcp', 'configuration', 'getting-started', 'security']) {
    const selected = slug || 'getting-started';
    const state = await loadViewer(slug ? '?p=' + slug : '', '#debug_stack');
    assert.equal(state.document.title, docMetadata(selected, manifest).title);
    assert.equal(state.description.attributes.content, docMetadata(selected, manifest).description);
    assert.deepEqual(state.requests, ['docs-manifest.json', manifest.pages[selected].path]);
    assert.equal(state.head.children.find(el => el.rel === 'canonical').href, docMetadata(selected, manifest).canonical);
    assert.equal(state.head.children.some(el => el.name === 'robots'), !docMetadata(selected, manifest).indexable);
    assert.equal(state.content.attributes['aria-busy'], 'false');
    assert.equal(state.scrolled, true);
  }
  const unknown = await loadViewer('?p=unknown');
  assert.equal(unknown.head.children.length, 0);
  assert.match(unknown.content.children[0].textContent, /does not exist/);
  assert.equal(unknown.content.children.at(-1).href, '?p=getting-started');
  const unreviewed = await loadViewer('?p=mcp', '', { ...manifest, revision: '0'.repeat(40) });
  assert.equal(unreviewed.head.children.find(el => el.name === 'robots').content, 'noindex,follow');
});
