/* ==========================================================================
   forged-kit — step-player.js
   Reference implementation of the Forged Tools step-player contract
   (see PLAYER.md). Vanilla JS, no dependencies, no build step. Vendored
   as-is into static Pages sites alongside forged.css + step-player.css.

   API:
     FkStepPlayer.mount(containerEl, script, {
       render: (step, index, prevIndex) => void,   // required
       onConcept: (key, concept, event) => void    // optional
     }) -> controller { goTo, next, prev, index(), step(), destroy }

     FkStepPlayer.applyHighlights(rootEl, highlights)  // optional helper

   Ownership: the player owns navigation, narration, progress, concept
   chips, and the data-fk-step-active attribute on the container. It never
   touches the domain canvas — all canvas drawing happens inside the
   render callback supplied by the domain.
   ========================================================================== */
(function (global) {
  "use strict";

  var HL_KINDS = ["focus", "pulse", "dim", "reveal"];
  var HL_SELECTOR = HL_KINDS.map(function (k) { return ".fk-hl-" + k; }).join(",");

  var KATEX_OPTS = {
    delimiters: [
      { left: "$$", right: "$$", display: true },
      { left: "\\[", right: "\\]", display: true },
      { left: "\\(", right: "\\)", display: false }
    ],
    throwOnError: false
  };

  /* ---------------------------------------------------------------- utils */

  function el(tag, className, parent) {
    var node = document.createElement(tag);
    if (className) node.className = className;
    if (parent) parent.appendChild(node);
    return node;
  }

  function validateScript(script) {
    if (!script || typeof script !== "object") {
      throw new Error("FkStepPlayer: script must be an object");
    }
    if (!Array.isArray(script.steps) || script.steps.length === 0) {
      throw new Error("FkStepPlayer: script.steps must be a non-empty array");
    }
    var seen = {};
    script.steps.forEach(function (step, i) {
      if (!step || typeof step !== "object") {
        throw new Error("FkStepPlayer: steps[" + i + "] is not an object");
      }
      if (step.id != null) {
        if (seen[step.id]) {
          throw new Error("FkStepPlayer: duplicate step id '" + step.id + "'");
        }
        seen[step.id] = true;
      }
    });
  }

  /* --------------------------------------------------------- highlights */

  /* Resolve a highlight target within rootEl. Resolution order:
     1. elements whose data-fk-target attribute equals the target string;
     2. failing that, the target string used as a raw CSS selector.
     Invalid selectors resolve to no elements (never throw). */
  function resolveTargets(rootEl, target) {
    var found = [];
    try {
      var esc = (global.CSS && CSS.escape)
        ? CSS.escape(target)
        : String(target).replace(/["\\]/g, "\\$&");
      found = rootEl.querySelectorAll('[data-fk-target="' + esc + '"]');
    } catch (e) { /* fall through */ }
    if (found.length) return Array.prototype.slice.call(found);
    try {
      return Array.prototype.slice.call(rootEl.querySelectorAll(target));
    } catch (e) {
      return [];
    }
  }

  /* Clear all four fk-hl-* classes under (and on) rootEl, then apply the
     given highlight list. Unknown kinds default to "focus". Domains may
     call this from their render callback, or ignore it entirely and do
     their own highlighting. */
  function applyHighlights(rootEl, highlights) {
    if (!rootEl || !rootEl.querySelectorAll) return;
    var stale = Array.prototype.slice.call(rootEl.querySelectorAll(HL_SELECTOR));
    if (rootEl.classList) stale.push(rootEl);
    stale.forEach(function (node) {
      HL_KINDS.forEach(function (k) { node.classList.remove("fk-hl-" + k); });
    });
    if (!Array.isArray(highlights)) return;
    highlights.forEach(function (hl) {
      if (!hl || typeof hl.target !== "string") return;
      var kind = HL_KINDS.indexOf(hl.kind) >= 0 ? hl.kind : "focus";
      var cls = "fk-hl-" + kind;
      resolveTargets(rootEl, hl.target).forEach(function (node) {
        if (kind === "pulse" || kind === "reveal") {
          /* force reflow so re-applied animations restart */
          node.classList.remove(cls);
          void node.offsetWidth;
        }
        node.classList.add(cls);
      });
    });
  }

  /* --------------------------------------------------- keyboard routing */

  /* One document-level keydown listener is shared by all mounted players,
     so a page with several players never advances more than one per
     keypress. Routing order for ArrowLeft/ArrowRight:
       1. the player whose container contains the event target;
       2. the "active" player — the last one whose container received a
          pointerdown or focusin;
       3. the first-mounted player.
     The listener attaches when the first player registers and detaches
     when the last one deregisters, so single-player pages keep today's
     document-wide arrow behavior. */

  var registry = [];      /* mounted player entries, in mount order */
  var activeEntry = null; /* last entry activated by pointerdown/focusin */

  /* An entry is stale when its container has left the document — torn out
     externally (e.g. a parent's innerHTML was replaced) without destroy().
     Stale entries are evicted on every mount and on every routed keydown,
     so a leaked entry can never shadow or keyboard-deaden live players.
     destroy() remains the correct teardown (see PLAYER.md); the sweep is a
     safety net, not an alternative. */
  function isDisconnected(node) {
    if (typeof node.isConnected === "boolean") return !node.isConnected;
    var root = document.documentElement;
    if (root && typeof root.contains === "function") return !root.contains(node);
    return false; /* connectivity undeterminable: never evict a maybe-live player */
  }

  /* Evict stale entries, plus any entry mounted on replacedContainer —
     a second mount into the same container supersedes the first for
     keyboard routing (the first mount's chrome is gone either way). */
  function sweepRegistry(replacedContainer) {
    for (var i = registry.length - 1; i >= 0; i--) {
      var e = registry[i];
      if (e.containerEl === replacedContainer || isDisconnected(e.containerEl)) {
        deregisterEntry(e);
      }
    }
  }

  function sharedOnKey(ev) {
    if (ev.defaultPrevented || ev.altKey || ev.ctrlKey || ev.metaKey) return;
    var t = ev.target;
    if (t && (/^(input|textarea|select)$/i.test(t.tagName) || t.isContentEditable)) return;
    if (ev.key !== "ArrowLeft" && ev.key !== "ArrowRight") return;
    sweepRegistry(null);
    /* never route to an entry that is no longer registered (evicted above,
       or a mount that failed mid-way and never registered) */
    if (activeEntry && registry.indexOf(activeEntry) < 0) activeEntry = null;
    var entry = null;
    for (var i = 0; i < registry.length; i++) {
      if (t && registry[i].containerEl.contains(t)) { entry = registry[i]; break; }
    }
    if (!entry) entry = activeEntry || registry[0];
    if (!entry) return;
    if (ev.key === "ArrowLeft") { entry.prev(); ev.preventDefault(); }
    else { entry.next(); ev.preventDefault(); }
  }

  function registerEntry(entry) {
    if (registry.length === 0) {
      document.addEventListener("keydown", sharedOnKey);
    }
    registry.push(entry);
  }

  function deregisterEntry(entry) {
    var i = registry.indexOf(entry);
    if (i < 0) return;
    registry.splice(i, 1);
    if (activeEntry === entry) {
      activeEntry = registry.length ? registry[0] : null;
    }
    if (registry.length === 0) {
      document.removeEventListener("keydown", sharedOnKey);
    }
  }

  /* -------------------------------------------------------------- mount */

  function mount(containerEl, script, options) {
    if (!containerEl || containerEl.nodeType !== 1) {
      throw new Error("FkStepPlayer.mount: containerEl must be a DOM element");
    }
    validateScript(script);
    options = options || {};
    if (typeof options.render !== "function") {
      throw new Error("FkStepPlayer.mount: options.render callback is required");
    }

    /* --- build player chrome (container content is replaced) --- */
    containerEl.innerHTML = "";
    containerEl.classList.add("fk-step-player");

    var progress = el("div", "fk-sp-progress", containerEl);
    progress.setAttribute("role", "progressbar");
    progress.setAttribute("aria-label", "Step progress");
    var progressFill = el("div", "fk-sp-progress-fill", progress);

    var head = el("div", "fk-sp-head", containerEl);
    var titleNode = el("h3", "fk-sp-title", head);
    var counter = el("span", "fk-sp-counter", head);

    var narration = el("div", "fk-card fk-sp-narration", containerEl);
    narration.setAttribute("aria-live", "polite");

    var conceptsRow = el("div", "fk-sp-concepts", containerEl);

    var nav = el("div", "fk-sp-nav", containerEl);
    var prevBtn = el("button", "fk-btn fk-sp-btn fk-sp-prev", nav);
    prevBtn.type = "button";
    prevBtn.innerHTML = "&larr; Prev";
    var nextBtn = el("button", "fk-btn fk-sp-btn fk-sp-next", nav);
    nextBtn.type = "button";
    nextBtn.innerHTML = "Next &rarr;";

    var total = script.steps.length;
    var index = -1;
    var destroyed = false;

    /* --- per-step chrome updates (player-owned surfaces only) --- */

    function renderConcepts(step) {
      conceptsRow.innerHTML = "";
      var keys = Array.isArray(step.concepts) ? step.concepts : [];
      var defs = script.concepts || {};
      keys.forEach(function (key) {
        var def = defs[key];
        if (!def || !def.url) return;
        var chip = el("a", "fk-chip fk-sp-concept", conceptsRow);
        chip.href = def.url;
        chip.target = "_blank";
        chip.rel = "noopener";
        chip.textContent = def.label || key;
        if (typeof options.onConcept === "function") {
          chip.addEventListener("click", function (ev) {
            options.onConcept(key, def, ev);
          });
        }
      });
      conceptsRow.hidden = conceptsRow.children.length === 0;
    }

    function goTo(target) {
      if (destroyed) return;
      if (typeof target !== "number" || target < 0 || target >= total) return;
      if (target === index) return;
      var prevIndex = index;
      index = target;
      var step = script.steps[index];

      /* bookkeeping attribute — the only DOM state the player writes
         outside its own chrome */
      containerEl.setAttribute("data-fk-step-active",
        step.id != null ? String(step.id) : String(index));

      titleNode.textContent = step.title || "";
      counter.textContent = "Step " + (index + 1) + " / " + total;
      progressFill.style.width = (((index + 1) / total) * 100) + "%";
      progress.setAttribute("aria-valuenow", String(index + 1));
      progress.setAttribute("aria-valuemin", "1");
      progress.setAttribute("aria-valuemax", String(total));

      narration.innerHTML = step.narration || "";
      /* KaTeX auto-render, if the host page loaded it */
      if (typeof global.renderMathInElement === "function") {
        try { global.renderMathInElement(narration, KATEX_OPTS); }
        catch (e) { /* narration stays as raw delimiters */ }
      }

      renderConcepts(step);
      prevBtn.disabled = (index === 0);
      nextBtn.disabled = (index === total - 1);

      /* the domain draws its canvas; player passes payload through opaque */
      options.render(step, index, prevIndex);
    }

    function next() { goTo(index + 1); }
    function prev() { goTo(index - 1); }

    /* --- events --- */

    prevBtn.addEventListener("click", prev);
    nextBtn.addEventListener("click", next);

    /* keyboard: register with the shared router; pointerdown/focusin on
       the container marks this player as the active arrow-key recipient */
    var entry = { containerEl: containerEl, next: next, prev: prev };

    function onActivate() {
      activeEntry = entry;
    }
    containerEl.addEventListener("pointerdown", onActivate);
    containerEl.addEventListener("focusin", onActivate);
    sweepRegistry(containerEl);
    registerEntry(entry);

    function destroy() {
      if (destroyed) return;
      destroyed = true;
      containerEl.removeEventListener("pointerdown", onActivate);
      containerEl.removeEventListener("focusin", onActivate);
      deregisterEntry(entry);
      containerEl.removeAttribute("data-fk-step-active");
      containerEl.classList.remove("fk-step-player");
      containerEl.innerHTML = "";
    }

    /* initial render: prevIndex is -1 by contract */
    goTo(0);

    return {
      goTo: goTo,
      next: next,
      prev: prev,
      index: function () { return index; },
      step: function () { return script.steps[index]; },
      destroy: destroy
    };
  }

  /* -------------------------------------------------------------- export */

  var FkStepPlayer = { mount: mount, applyHighlights: applyHighlights };

  if (typeof module === "object" && module.exports) {
    module.exports = FkStepPlayer;
  }
  global.FkStepPlayer = FkStepPlayer;

})(typeof window !== "undefined" ? window : this);
