(function () {
  'use strict';

  var SITE_URL = 'https://y0geshpatil.github.io/sl-dbg-site/';
  var descriptions = {
    'getting-started': 'Install sl-dbg, add a Python adapter, pause your first program, and connect an MCP client. Includes setup and troubleshooting.',
    adapters: 'Set up Python debugpy, Go Delve, and the Java debug adapter for sl-dbg. Check runtime requirements and adapter-specific limitations.',
    mcp: 'Reference for sl-dbg Model Context Protocol tools, resources, and prompts, with structured arguments and debugger policy notes.',
    'agent-guide': 'Use sl-dbg from an AI coding agent: inspect runtime state, set breakpoints, and work with structured CLI and MCP debugger results.',
    commands: 'Look up sl-dbg CLI commands for sessions, breakpoints, stepping, variables, and events. Check supported flags against your installed build.',
    configuration: 'Planned sl-dbg configuration-file design. These proposals are not implemented settings; use documented CLI flags for current behavior.',
    platforms: 'Check sl-dbg platform and architecture support, runtime requirements, and debugging limitations before installing.',
    design: 'Architecture and design notes for the sl-dbg command-line client, persistent daemon, and Debug Adapter Protocol integrations.',
    security: 'Read the sl-dbg threat model, debugger access controls, and limitations. Debugger policy is not an operating-system sandbox.',
    'security-review': 'Review sl-dbg release artifacts, SHA-256 checksums, installer source, and security limitations before running a debugger.'
  };

  function docMetadata(slug, manifest) {
    if (!Object.hasOwn(manifest.pages, slug) || !Object.hasOwn(descriptions, slug)) {
      throw new Error('Missing documentation metadata: ' + slug);
    }
    // Editorial approval is separate from the original provenance format.
    var reviewed = manifest.repository === 'y0geshpatil/sl-dbg' &&
      manifest.revision === '453306c16fbbb267b41be81dfe9d9dc4800036b5' &&
      manifest.mcpBinarySha256 === 'ec30f7deed6be03a033d21ba0792df397e63b8b00aafe072955551bdd97622a7';
    return {
      title: manifest.pages[slug].title + (reviewed ? '' : ' (unreviewed snapshot)') + ' | sl-dbg docs',
      description: (reviewed ? '' : 'Unreviewed documentation snapshot. ') + descriptions[slug],
      canonical: SITE_URL + 'docs/' + slug + '.html',
      indexable: reviewed && !['configuration', 'design'].includes(slug)
    };
  }

  function slugify(text) {
    return text.toLowerCase().replace(/[^\p{L}\p{N}\s_-]/gu, '').trim().replace(/\s/g, '-');
  }

  function renderMarkdown(markdown, parser, renderer) {
    renderer = renderer || new parser.Renderer();
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
    var base = /^docs\//i.test(href) ? '/' : '/' + source;
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

  function escapeHTML(value) {
    return String(value).replace(/[&<>"']/g, function (char) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[char];
    });
  }

  function decodeEntities(text) {
    return text.replace(/&(#(?:[xX][\da-fA-F]+|\d+);?|(?:amp|lt|gt|quot|apos|colon|Tab|NewLine|nbsp);)/g, function (_, entity) {
      entity = entity.replace(/;$/, '');
      if (entity[0] !== '#') return {
        amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", colon: ':', Tab: '\t', NewLine: '\n', nbsp: '\u00a0'
      }[entity];
      var code = entity[1].toLowerCase() === 'x' ? parseInt(entity.slice(2), 16) : Number(entity.slice(1));
      return code > 0 && code <= 0x10ffff && !(code >= 0xd800 && code <= 0xdfff) ? String.fromCodePoint(code) : '\ufffd';
    });
  }

  function nextHeadingId(text, headings) {
    var slug = slugify(text) || 'section';
    var id = slug;
    var count = 0;
    while (headings.has(id)) id = slug + '-' + (++count);
    headings.add(id);
    return id;
  }

  function safeURL(value, attr) {
    try {
      var protocol = new URL(value, 'https://docs.invalid/').protocol;
      return ['http:', 'https:', 'mailto:'].includes(protocol) && !(attr === 'src' && protocol === 'mailto:');
    } catch (_) {
      return false;
    }
  }

  function resolveStaticDocLink(href, page, manifest) {
    var resolved = resolveDocLink(href, page, manifest);
    if (resolved.startsWith('?p=')) {
      var url = new URL(resolved, 'https://docs.invalid/');
      return url.searchParams.get('p') + '.html' + url.hash;
    }
    if (/^(?:[a-z][a-z0-9+.-]*:|\/\/|#)/i.test(resolved)) return resolved;
    return '../' + resolved;
  }

  function renderDocument(markdown, parser, page, manifest) {
    var renderer = new parser.Renderer();
    var headings = new Set(['content']);
    renderer.heading = function (text, level) {
      var plain = decodeEntities(text.replace(/<[^>]*>/g, ''));
      var id = nextHeadingId(plain, headings);
      return '<h' + level + ' id="' + escapeHTML(id) + '">' + text + '</h' + level + '>\n';
    };
    renderer.link = function (href, title, text) {
      href = decodeEntities(href);
      if (!safeURL(href, 'href')) return '<a>' + text + '</a>';
      href = resolveStaticDocLink(href, page, manifest);
      return '<a' + (safeURL(href, 'href') ? ' href="' + escapeHTML(href) + '"' : '') +
        (title ? ' title="' + escapeHTML(decodeEntities(title)) + '"' : '') + '>' + text + '</a>';
    };
    renderer.image = function (href, title, text) {
      href = decodeEntities(href);
      var source = safeURL(href, 'src') ? resolveStaticDocLink(href, page, manifest) : null;
      return '<img' + (source && safeURL(source, 'src') ? ' src="' + escapeHTML(source) + '"' : '') +
        ' alt="' + escapeHTML(decodeEntities(text)) + '"' +
        (title ? ' title="' + escapeHTML(decodeEntities(title)) + '"' : '') + '>';
    };
    return renderMarkdown(markdown, parser, renderer);
  }

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = {
      slugify: slugify, resolveDocLink: resolveDocLink, renderMarkdown: renderMarkdown,
      renderDocument: renderDocument, resolveStaticDocLink: resolveStaticDocLink,
      siteURL: SITE_URL, descriptions: descriptions, docMetadata: docMetadata, escapeHTML: escapeHTML
    };
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
      var headings = new Set(['content']);
      template.content.querySelectorAll('h1, h2, h3, h4, h5, h6').forEach(function (heading) {
        heading.id = nextHeadingId(heading.textContent, headings);
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
      var meta = docMetadata(name, manifest);
      document.title = meta.title;
      document.querySelector('meta[name="description"]').setAttribute('content', meta.description);
      var canonical = document.createElement('link');
      canonical.rel = 'canonical';
      canonical.href = meta.canonical;
      document.head.append(canonical);
      if (!meta.indexable) {
        var robots = document.createElement('meta');
        robots.name = 'robots';
        robots.content = 'noindex,follow';
        document.head.append(robots);
      }
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
