/**
 * CheatsheetCore — Shared foundation for cheatsheet modules.
 * Provides: nav generation, live search, print toggle, cross-linking.
 * Used by diffeq-tutor, circuits-tutor, etc.
 */

const CheatsheetCore = (() => {
  let currentTheme = localStorage.getItem('cs-theme') || 'dark';

  /**
   * buildNav(titleEl) — extract h2 headings, build sticky nav with anchor links
   */
  function buildNav(titleEl) {
    const headings = document.querySelectorAll('h2');
    if (headings.length === 0) return;

    const nav = document.createElement('div');
    nav.id = 'cs-nav';
    nav.innerHTML = `
      <div class="cs-nav-title">${titleEl ? titleEl.textContent : 'Cheatsheet'}</div>
      <div class="cs-nav-links"></div>
    `;

    const links = nav.querySelector('.cs-nav-links');
    headings.forEach((h, idx) => {
      const id = h.id || `cs-h2-${idx}`;
      h.id = id;
      const a = document.createElement('a');
      a.href = `#${id}`;
      a.textContent = h.textContent;
      links.appendChild(a);
    });

    document.body.insertBefore(nav, document.body.firstChild);
  }

  /**
   * initSearch(inputEl) — live search: highlight matches, hide non-matching sections
   */
  function initSearch(inputEl) {
    inputEl.addEventListener('input', (e) => {
      const query = e.target.value.toLowerCase();
      const sections = document.querySelectorAll('h2');

      sections.forEach((section) => {
        const container = section.parentElement;
        if (!query) {
          container.style.display = 'block';
          container.querySelectorAll('mark.hl').forEach((m) => {
            const parent = m.parentNode;
            parent.replaceChild(document.createTextNode(m.textContent), m);
            parent.normalize();
          });
        } else {
          const text = container.textContent.toLowerCase();
          const matches = text.includes(query);
          container.style.display = matches ? 'block' : 'none';

          if (matches) {
            highlightText(container, query);
          }
        }
      });
    });
  }

  /**
   * Private: highlight matching text with mark.hl class
   */
  function highlightText(el, query) {
    const walker = document.createTreeWalker(
      el,
      NodeFilter.SHOW_TEXT,
      null,
      false
    );

    const nodesToReplace = [];
    let node;
    while ((node = walker.nextNode())) {
      const text = node.nodeValue.toLowerCase();
      if (text.includes(query)) {
        nodesToReplace.push(node);
      }
    }

    nodesToReplace.forEach((textNode) => {
      const span = document.createElement('span');
      const text = textNode.nodeValue;
      const regex = new RegExp(`(${query})`, 'gi');
      const parts = text.split(regex);

      parts.forEach((part) => {
        if (regex.test(part)) {
          const mark = document.createElement('mark');
          mark.className = 'hl';
          mark.textContent = part;
          span.appendChild(mark);
        } else {
          span.appendChild(document.createTextNode(part));
        }
      });

      textNode.parentNode.replaceChild(span, textNode);
    });
  }

  /**
   * initPrintToggle(btnEl) — toggle between dark and print themes
   */
  function initPrintToggle(btnEl) {
    btnEl.addEventListener('click', () => {
      const newTheme = currentTheme === 'dark' ? 'print' : 'dark';
      setTheme(newTheme);
      btnEl.textContent = newTheme === 'dark' ? 'Print mode' : 'Study mode';
    });
  }

  /**
   * setTheme(theme) — set data-theme and persist to localStorage
   */
  function setTheme(theme) {
    currentTheme = theme;
    document.body.setAttribute('data-theme', theme);
    localStorage.setItem('cs-theme', theme);
  }

  /**
   * getTheme() — retrieve current theme
   */
  function getTheme() {
    return currentTheme;
  }

  /**
   * addCompanionLink(options) — insert banner linking to paired tutor or cheatsheet
   * options: { label, href, position: 'top' | 'bottom' }
   */
  function addCompanionLink(options) {
    const { label, href, position = 'bottom' } = options;
    const link = document.createElement('div');
    link.className = 'cs-companion-link';
    link.innerHTML = `<span>${label}</span> <a href="${href}">→ Open →</a>`;

    if (position === 'top') {
      document.body.insertBefore(link, document.body.firstChild);
    } else {
      document.body.appendChild(link);
    }
  }

  // Public API
  return {
    buildNav,
    initSearch,
    initPrintToggle,
    addCompanionLink,
    setTheme,
    getTheme,
  };
})();

// Export for use in modules
if (typeof module !== 'undefined' && module.exports) {
  module.exports = CheatsheetCore;
}
