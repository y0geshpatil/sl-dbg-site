// sl-dbg site — minimal vanilla JS for tabs + copy buttons + smooth scroll

(function () {
  'use strict';

  // ---------- Tabs ----------
  function initTabs() {
    var tabGroups = document.querySelectorAll('.tabs');
    tabGroups.forEach(function (group) {
      var tabs = group.querySelectorAll('.tab');
      // Tab panes are siblings of .tabs inside their parent
      var container = group.parentElement;
      var panes = container.querySelectorAll('.tab-pane');

      tabs.forEach(function (tab) {
        tab.addEventListener('click', function () {
          var target = tab.getAttribute('data-tab');
          tabs.forEach(function (t) { t.classList.remove('active'); });
          panes.forEach(function (p) { p.classList.remove('active'); });
          tab.classList.add('active');
          var pane = container.querySelector('.tab-pane[data-pane="' + target + '"]');
          if (pane) pane.classList.add('active');
        });
      });
    });
  }

  // ---------- Copy buttons ----------
  function initCopy() {
    document.querySelectorAll('.copy').forEach(function (btn) {
      btn.addEventListener('click', function () {
        var text = btn.getAttribute('data-copy');
        if (!text) {
          // Fallback: copy the text of the sibling <pre>
          var snippet = btn.closest('.snippet');
          if (snippet) {
            var pre = snippet.querySelector('pre');
            if (pre) text = pre.innerText;
          }
        }
        if (!text) return;

        var done = function () {
          var original = btn.textContent;
          btn.textContent = 'Copied!';
          btn.classList.add('copied');
          setTimeout(function () {
            btn.textContent = original;
            btn.classList.remove('copied');
          }, 1400);
        };

        if (navigator.clipboard && navigator.clipboard.writeText) {
          navigator.clipboard.writeText(text).then(done).catch(fallbackCopy);
        } else {
          fallbackCopy();
        }

        function fallbackCopy() {
          var ta = document.createElement('textarea');
          ta.value = text;
          ta.style.position = 'fixed';
          ta.style.opacity = '0';
          document.body.appendChild(ta);
          ta.select();
          try { document.execCommand('copy'); done(); } catch (e) {}
          document.body.removeChild(ta);
        }
      });
    });
  }

  // ---------- Smooth scroll for in-page anchors ----------
  function initSmoothScroll() {
    document.querySelectorAll('a[href^="#"]').forEach(function (a) {
      a.addEventListener('click', function (e) {
        var id = a.getAttribute('href');
        if (id.length <= 1) return;
        var target = document.querySelector(id);
        if (!target) return;
        e.preventDefault();
        var top = target.getBoundingClientRect().top + window.pageYOffset - 70;
        window.scrollTo({ top: top, behavior: 'smooth' });
        history.replaceState(null, '', id);
      });
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', function () {
      initTabs(); initCopy(); initSmoothScroll();
    });
  } else {
    initTabs(); initCopy(); initSmoothScroll();
  }
})();
