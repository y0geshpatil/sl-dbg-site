// sl-dbg site — minimal vanilla JS for tabs + copy buttons + smooth scroll

(function () {
  'use strict';

  // ---------- Tabs ----------
  function initTabs() {
    var tabGroups = document.querySelectorAll('.tabs');
    tabGroups.forEach(function (group, groupIndex) {
      var tabs = group.querySelectorAll('.tab');
      // Tab panes are siblings of .tabs inside their parent
      var container = group.parentElement;
      var panes = container.querySelectorAll('.tab-pane');

      function select(tab) {
        tabs.forEach(function (t) {
          var selected = t === tab;
          t.classList.toggle('active', selected);
          t.setAttribute('aria-selected', String(selected));
          t.tabIndex = selected ? 0 : -1;
        });
        panes.forEach(function (pane) {
          var selected = pane.dataset.pane === tab.dataset.tab;
          pane.classList.toggle('active', selected);
          pane.hidden = !selected;
        });
      }

      tabs.forEach(function (tab, index) {
        var pane = container.querySelector('.tab-pane[data-pane="' + tab.dataset.tab + '"]');
        tab.id = 'tab-' + groupIndex + '-' + index;
        if (pane) {
          pane.id = 'pane-' + groupIndex + '-' + index;
          pane.setAttribute('role', 'tabpanel');
          pane.setAttribute('aria-labelledby', tab.id);
          pane.tabIndex = 0;
          tab.setAttribute('aria-controls', pane.id);
        }
        tab.addEventListener('click', function () { select(tab); });
        tab.addEventListener('keydown', function (event) {
          var next;
          if (event.key === 'ArrowRight') next = (index + 1) % tabs.length;
          if (event.key === 'ArrowLeft') next = (index + tabs.length - 1) % tabs.length;
          if (event.key === 'Home') next = 0;
          if (event.key === 'End') next = tabs.length - 1;
          if (next === undefined) return;
          event.preventDefault();
          select(tabs[next]);
          tabs[next].focus();
        });
      });
      select(group.querySelector('.tab.active') || tabs[0]);
    });
  }

  // ---------- Copy buttons ----------
  function initCopy() {
    document.querySelectorAll('.copy').forEach(function (btn) {
      var original = btn.textContent;
      var reset;
      btn.setAttribute('aria-live', 'polite');
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

        var feedback = function (success) {
          clearTimeout(reset);
          btn.textContent = success ? 'Copied!' : 'Select and copy manually';
          btn.classList.toggle('copied', success);
          reset = setTimeout(function () {
            btn.textContent = original;
            btn.classList.remove('copied');
          }, success ? 1400 : 4000);
        };

        if (navigator.clipboard && navigator.clipboard.writeText) {
          navigator.clipboard.writeText(text).then(function () { feedback(true); }).catch(fallbackCopy);
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
          var copied = false;
          try { copied = document.execCommand('copy'); } catch (e) { copied = false; }
          document.body.removeChild(ta);
          btn.focus();
          feedback(copied);
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
        var target = document.getElementById(id.slice(1));
        if (!target) return;
        e.preventDefault();
        var top = target.getBoundingClientRect().top + window.pageYOffset - 70;
        var reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
        window.scrollTo({ top: top, behavior: reducedMotion ? 'auto' : 'smooth' });
        target.setAttribute('tabindex', '-1');
        target.focus({ preventScroll: true });
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
