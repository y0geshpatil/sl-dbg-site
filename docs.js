(function () {
  'use strict';

  function slugify(text) {
    return text.toLowerCase().replace(/[^\p{L}\p{N}\s_-]/gu, '').trim().replace(/\s/g, '-');
  }

  function renderMarkdown(markdown, parser) {
    var renderer = new parser.Renderer();
    // Snapshots are prose, not executable HTML.
    renderer.html = function (html) {
      return html.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
    };
    return parser.parse(markdown, { gfm: true, renderer: renderer });
  }

  function resolveDocLink(href, page, manifest) {
    if (/^(?:[a-z][a-z0-9+.-]*:|\/\/|#)/i.test(href)) return href;
    var source = page.linkBase || page.source || page.path;
    // Core documents sometimes use repo-root "docs/" links from inside docs/.
    var base = href.startsWith('docs/') ? '/' : '/' + source;
    var url = new URL(href, 'https://docs.invalid' + base);
    var path = decodeURIComponent(url.pathname.slice(1));
    var slug = Object.keys(manifest.pages).find(function (key) {
      var candidate = manifest.pages[key];
      return (candidate.linkBase || candidate.source || candidate.path).toLowerCase() === path.toLowerCase();
    });
    if (slug) return '?p=' + slug + url.hash;
    if (page.source) {
      return 'https://github.com/' + manifest.repository + '/blob/' +
        manifest.revision + '/' + path + url.search + url.hash;
    }
    return path + url.search + url.hash;
  }

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = { slugify: slugify, resolveDocLink: resolveDocLink, renderMarkdown: renderMarkdown };
    return;
  }

  var content = document.getElementById('content');
  var name = new URLSearchParams(location.search).get('p') || 'getting-started';
  var rawPath = 'docs/getting-started.md';

  async function load() {
    try {
      var response = await fetch('docs-manifest.json');
      if (!response.ok) throw new Error('Documentation index returned HTTP ' + response.status);
      var manifest = await response.json();
      if (!Object.hasOwn(manifest.pages, name)) throw new Error('This documentation page does not exist');
      var page = manifest.pages[name];
      rawPath = page.path;
      document.querySelectorAll('.docs-side a[data-doc]').forEach(function (link) {
        var selected = link.dataset.doc === name;
        link.classList.toggle('active', selected);
        if (selected) link.setAttribute('aria-current', 'page');
      });
      if (typeof marked === 'undefined') throw new Error('The Markdown renderer could not load');
      response = await fetch(page.path);
      if (!response.ok) throw new Error('The document returned HTTP ' + response.status);
      var markdown = await response.text();
      var template = document.createElement('template');
      template.innerHTML = renderMarkdown(markdown, marked);
      template.content.querySelectorAll('*').forEach(function (el) {
        Array.from(el.attributes).forEach(function (attr) {
          if (!['href', 'src', 'alt', 'title', 'class', 'colspan', 'rowspan'].includes(attr.name)) {
            el.removeAttribute(attr.name);
          }
        });
        ['href', 'src'].forEach(function (attr) {
          if (!el.hasAttribute(attr)) return;
          var value = el.getAttribute(attr);
          var protocol = new URL(value, location.href).protocol;
          if (!['http:', 'https:', 'mailto:'].includes(protocol) || (attr === 'src' && protocol === 'mailto:')) {
            el.removeAttribute(attr);
          }
        });
      });
      template.content.querySelectorAll('a[href]').forEach(function (link) {
        link.setAttribute('href', resolveDocLink(link.getAttribute('href'), page, manifest));
      });
      var headings = new Map();
      template.content.querySelectorAll('h1, h2, h3, h4, h5, h6').forEach(function (heading) {
        var slug = slugify(heading.textContent);
        var count = headings.get(slug) || 0;
        headings.set(slug, count + 1);
        heading.id = slug + (count ? '-' + count : '');
      });
      content.replaceChildren(template.content);
      var provenance = document.createElement('p');
      provenance.className = 'docs-provenance';
      var sourceLink = document.createElement('a');
      sourceLink.href = page.source
        ? 'https://github.com/' + manifest.repository + '/blob/' + manifest.revision + '/' + page.source
        : page.path;
      sourceLink.textContent = page.source ? 'Core source at ' + manifest.revision.slice(0, 12) : 'Read Markdown source';
      provenance.append(sourceLink);
      if (page.source) provenance.append(' · Snapshot documentation; check sl-dbg version and --help for your installed release.');
      if (page.note) {
        var note = document.createElement('p');
        note.textContent = page.note;
        content.prepend(note);
      }
      content.prepend(provenance);
      document.title = 'sl-dbg docs — ' + page.title;
      if (location.hash) {
        var target = document.getElementById(decodeURIComponent(location.hash.slice(1)));
        if (target) target.scrollIntoView();
      }
    } catch (error) {
      var message = document.createElement('p');
      message.setAttribute('role', 'alert');
      message.textContent = 'Could not show this page. ' + error.message + '.';
      var retry = document.createElement('a');
      retry.href = location.href;
      retry.textContent = 'Reload';
      var raw = document.createElement('a');
      raw.href = rawPath;
      raw.textContent = 'Read Markdown instead';
      var guide = document.createElement('a');
      guide.href = '?p=getting-started';
      guide.textContent = 'Back to setup guide';
      content.replaceChildren(message, retry, document.createTextNode(' · '), raw, document.createTextNode(' · '), guide);
    } finally {
      content.setAttribute('aria-busy', 'false');
    }
  }

  load();
})();
