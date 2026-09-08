const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

function element(dataset = {}, classes = []) {
  const attributes = {};
  const names = new Set(classes);
  return {
    dataset, attributes, handlers: {}, style: {}, textContent: 'Copy',
    classList: {
      add: value => names.add(value),
      remove: value => names.delete(value),
      toggle(value, enabled) { enabled ? names.add(value) : names.delete(value); }
    },
    setAttribute(name, value) { attributes[name] = value; },
    getAttribute(name) { return attributes[name]; },
    addEventListener(name, handler) { this.handlers[name] = handler; },
    focus() { this.focused = true; },
    select() {}
  };
}

function app({ clipboard, copyResult = true } = {}) {
  const tabs = [element({ tab: 'curl' }, ['active']), element({ tab: 'local' })];
  const panes = [element({ pane: 'curl' }), element({ pane: 'local' })];
  const group = {
    querySelectorAll: () => tabs,
    querySelector: () => tabs[0],
    parentElement: {
      querySelectorAll: () => panes,
      querySelector: selector => panes.find(pane => selector.includes(`"${pane.dataset.pane}"`))
    }
  };
  const copy = element();
  copy.setAttribute('data-copy', 'curl example | INSTALL_DIR="$HOME/bin" bash');
  let textarea;
  let removed = false;
  const timers = new Map();
  let timer = 0;
  const document = {
    readyState: 'complete',
    querySelectorAll(selector) {
      if (selector === '.tabs') return [group];
      if (selector === '.copy') return [copy];
      return [];
    },
    createElement() { textarea = element(); return textarea; },
    body: {
      appendChild() {},
      removeChild() { removed = true; }
    },
    execCommand() { return copyResult; }
  };
  vm.runInNewContext(fs.readFileSync(path.join(__dirname, '../app.js'), 'utf8'), {
    document, navigator: { clipboard },
    setTimeout(fn) { timers.set(++timer, fn); return timer; },
    clearTimeout(id) { timers.delete(id); }
  });
  return { tabs, panes, copy, timers, textarea: () => textarea, removed: () => removed };
}

test('tabs synchronize keyboard selection, focus, ARIA and hidden panels', () => {
  const { tabs, panes } = app();
  assert.equal(tabs[0].attributes['aria-selected'], 'true');
  assert.equal(tabs[1].attributes['aria-selected'], 'false');
  assert.equal(tabs[1].tabIndex, -1);
  assert.equal(panes[0].hidden, false);
  assert.equal(panes[1].hidden, true);
  assert.equal(tabs[1].attributes['aria-controls'], panes[1].id);
  assert.equal(panes[1].attributes['aria-labelledby'], tabs[1].id);
  let prevented = false;
  tabs[0].handlers.keydown({ key: 'ArrowRight', preventDefault() { prevented = true; } });
  assert.equal(prevented, true);
  assert.equal(tabs[1].focused, true);
  assert.equal(tabs[1].attributes['aria-selected'], 'true');
  assert.equal(panes[1].hidden, false);
  tabs[1].handlers.keydown({ key: 'Home', preventDefault() {} });
  assert.equal(tabs[0].attributes['aria-selected'], 'true');
  tabs[1].handlers.click();
  assert.equal(tabs[1].attributes['aria-selected'], 'true');
});

test('copy success copies exact command and repeated clicks restore the original label', async () => {
  let text;
  const state = app({ clipboard: { async writeText(value) { text = value; } } });
  state.copy.handlers.click();
  await new Promise(setImmediate);
  assert.equal(text, 'curl example | INSTALL_DIR="$HOME/bin" bash');
  assert.equal(state.copy.textContent, 'Copied!');
  state.copy.handlers.click();
  await new Promise(setImmediate);
  assert.equal(state.timers.size, 1);
  state.timers.values().next().value();
  assert.equal(state.copy.textContent, 'Copy');
});

test('clipboard rejection and failed fallback show actionable feedback, not false success', async () => {
  const state = app({
    clipboard: { async writeText() { throw new Error('Clipboard permission denied'); } },
    copyResult: false
  });
  state.copy.handlers.click();
  await new Promise(setImmediate);
  assert.equal(state.copy.textContent, 'Select and copy manually');
  assert.equal(state.textarea().value, 'curl example | INSTALL_DIR="$HOME/bin" bash');
  assert.equal(state.removed(), true);
  assert.equal(state.copy.focused, true);
});

test('copy works through the fallback when the Clipboard API is absent', () => {
  const state = app();
  state.copy.handlers.click();
  assert.equal(state.copy.textContent, 'Copied!');
  assert.equal(state.removed(), true);
});

async function failingDocs({ response, renderer, name = 'getting-started' }) {
  const content = element();
  content.replaceChildren = (...children) => { content.children = children; };
  vm.runInNewContext(fs.readFileSync(path.join(__dirname, '../docs.js'), 'utf8'), {
    URL, URLSearchParams,
    location: { search: '?p=' + name, href: 'https://example.test/docs.html?p=' + name },
    marked: renderer,
    fetch: async () => response,
    document: {
      getElementById: () => content,
      querySelectorAll: () => [],
      createElement: () => element(),
      createTextNode: value => ({ textContent: value })
    }
  });
  await new Promise(setImmediate);
  return content;
}

test('docs index failure clears loading and offers a reload and raw guide', async () => {
  const content = await failingDocs({ response: { ok: false, status: 503 } });
  assert.equal(content.attributes['aria-busy'], 'false');
  assert.match(content.children[0].textContent, /HTTP 503/);
  assert.equal(content.children[0].attributes.role, 'alert');
  assert.equal(content.children[1].textContent, 'Reload');
  assert.equal(content.children[3].href, 'docs/getting-started.md');
});

test('missing CDN renderer offers the requested document as raw Markdown', async () => {
  const content = await failingDocs({
    name: 'adapters',
    response: {
      ok: true,
      async json() { return { pages: { adapters: { path: 'docs/adapters.md' } } }; }
    }
  });
  assert.match(content.children[0].textContent, /Markdown renderer could not load/);
  assert.equal(content.children[3].href, 'docs/adapters.md');
});

test('unknown document routes fail explicitly instead of fetching arbitrary paths', async () => {
  const content = await failingDocs({
    name: '__proto__',
    response: { ok: true, async json() { return { pages: {} }; } }
  });
  assert.match(content.children[0].textContent, /page does not exist/);
  assert.equal(content.children[3].href, 'docs/getting-started.md');
});
