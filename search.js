/*
 * Site-wide search — neilcatton.com
 *
 * Self-contained: injects its own styles, nav trigger, and overlay markup.
 * Every page includes it with a single tag:
 *   <script src="/search.js" defer></script>
 *
 * Data sources:
 *   /data/search-pages.json          — hand-maintained index of static site pages
 *   /.netlify/functions/search-feed  — full Substack archive (all sections)
 *
 * Open:  click the search icon in the nav, press "/" or Cmd+K / Ctrl+K anywhere
 * Close: Escape, click the backdrop, or click the close button
 * Nav:   Arrow Up/Down to move between results, Enter to go to the highlighted one
 */
(function () {
  "use strict";

  var STATIC_INDEX_URL = "/data/search-pages.json";
  var ARTICLES_URL = "/.netlify/functions/search-feed";
  var CACHE_KEY = "nc-search-articles-v1";
  var CACHE_TTL = 30 * 60 * 1000; // 30 minutes

  var allItems = [];
  var dataPromise = null;
  var activeIndex = -1;
  var lastTrigger = null;

  // ---------- styles ----------

  var css = "\
    .search-trigger-btn {\
      display: inline-flex; align-items: center; justify-content: center;\
      width: 32px; height: 32px; background: none; border: none; cursor: pointer;\
      color: var(--ink-mid, #3d3935); padding: 0; margin: 0; transition: color 0.2s;\
    }\
    .search-trigger-btn:hover { color: var(--accent, #2b4a6f); }\
    .search-trigger-btn svg { width: 18px; height: 18px; display: block; }\
    li.nav-search-item { display: flex; align-items: center; }\
    li.nav-search-item a::after { display: none !important; }\
    \
    .search-overlay {\
      position: fixed; inset: 0; z-index: 1000;\
      background: rgba(26,23,20,0.92);\
      display: none; align-items: flex-start; justify-content: center;\
      padding: 8vh 1.5rem 2rem;\
      overflow-y: auto;\
    }\
    .search-overlay.open { display: flex; }\
    \
    .search-panel {\
      width: 100%; max-width: 640px;\
      background: var(--paper, #f5f2ee);\
      border: 1px solid var(--rule, #d4cfc9);\
      box-shadow: 0 24px 60px rgba(0,0,0,0.35);\
    }\
    \
    .search-input-row {\
      display: flex; align-items: center; gap: 0.75rem;\
      padding: 1rem 1.25rem;\
      border-bottom: 1px solid var(--rule, #d4cfc9);\
    }\
    .search-input-row svg { width: 18px; height: 18px; flex-shrink: 0; color: var(--ink-light, #5c5652); }\
    .search-input {\
      flex: 1; border: none; background: transparent; outline: none;\
      font-family: var(--sans, sans-serif); font-size: 1.05rem; color: var(--ink, #1a1714);\
    }\
    .search-input::placeholder { color: var(--ink-light, #5c5652); }\
    .search-close-btn {\
      border: none; background: none; cursor: pointer; color: var(--ink-light, #5c5652);\
      font-family: var(--sans, sans-serif); font-size: 0.68rem; font-weight: 600;\
      letter-spacing: 0.08em; text-transform: uppercase; padding: 0.35rem 0.6rem;\
    }\
    .search-close-btn:hover { color: var(--ink, #1a1714); }\
    \
    .search-results { max-height: 60vh; overflow-y: auto; }\
    .search-section-label {\
      font-family: var(--sans, sans-serif); font-size: 0.65rem; font-weight: 600;\
      letter-spacing: 0.14em; text-transform: uppercase; color: var(--ink-light, #5c5652);\
      padding: 0.9rem 1.25rem 0.4rem;\
    }\
    .search-result {\
      display: block; padding: 0.75rem 1.25rem;\
      text-decoration: none; border-left: 3px solid transparent;\
    }\
    .search-result:hover, .search-result.active {\
      background: var(--paper-mid, #ede9e3); border-left-color: var(--accent, #2b4a6f);\
    }\
    .search-result-title {\
      font-family: var(--serif, serif); font-size: 1rem; font-weight: 400;\
      color: var(--ink, #1a1714); margin-bottom: 0.2rem;\
    }\
    .search-result-excerpt {\
      font-family: var(--sans, sans-serif); font-size: 0.85rem; color: var(--ink-light, #5c5652);\
      line-height: 1.5;\
    }\
    .search-empty, .search-hint, .search-loading {\
      padding: 2rem 1.25rem; text-align: center;\
      font-family: var(--sans, sans-serif); font-size: 0.9rem; color: var(--ink-light, #5c5652);\
    }\
    .search-kbd {\
      display: inline-block; border: 1px solid var(--rule, #d4cfc9); border-bottom-width: 2px;\
      border-radius: 3px; padding: 0.05rem 0.4rem; font-size: 0.75rem; font-family: monospace;\
      margin: 0 0.15rem;\
    }\
  ";

  var styleEl = document.createElement("style");
  styleEl.id = "search-widget-styles";
  styleEl.textContent = css;
  document.head.appendChild(styleEl);

  // ---------- markup ----------

  var SEARCH_ICON_SVG =
    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" ' +
    'stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' +
    '<circle cx="11" cy="11" r="7"></circle><line x1="21" y1="21" x2="16.65" y2="16.65"></line></svg>';

  function injectTrigger() {
    var navLinks = document.querySelector(".nav-links");
    if (!navLinks) return;

    var li = document.createElement("li");
    li.className = "nav-search-item";
    li.innerHTML =
      '<button type="button" class="search-trigger-btn" id="search-trigger" aria-label="Search site">' +
      SEARCH_ICON_SVG + "</button>";

    var ctaItem = navLinks.querySelector(".nav-cta");
    if (ctaItem) {
      navLinks.insertBefore(li, ctaItem);
    } else {
      navLinks.appendChild(li);
    }

    document.getElementById("search-trigger").addEventListener("click", function (e) {
      lastTrigger = e.currentTarget;
      openOverlay();
    });
  }

  function injectOverlay() {
    var overlay = document.createElement("div");
    overlay.className = "search-overlay";
    overlay.id = "search-overlay";
    overlay.setAttribute("role", "dialog");
    overlay.setAttribute("aria-modal", "true");
    overlay.setAttribute("aria-label", "Site search");

    overlay.innerHTML =
      '<div class="search-panel">' +
      '<div class="search-input-row">' +
      SEARCH_ICON_SVG +
      '<input type="text" class="search-input" id="search-input" ' +
      'placeholder="Search pages and writing…" autocomplete="off" ' +
      'aria-label="Search this site">' +
      '<button type="button" class="search-close-btn" id="search-close">Esc</button>' +
      "</div>" +
      '<div class="search-results" id="search-results">' +
      '<div class="search-hint">Start typing to search across every page and essay.</div>' +
      "</div>" +
      "</div>";

    document.body.appendChild(overlay);

    overlay.addEventListener("click", function (e) {
      if (e.target === overlay) closeOverlay();
    });
    document.getElementById("search-close").addEventListener("click", closeOverlay);

    var input = document.getElementById("search-input");
    var debounceTimer = null;
    input.addEventListener("input", function () {
      clearTimeout(debounceTimer);
      debounceTimer = setTimeout(function () {
        renderResults(input.value);
      }, 120);
    });

    input.addEventListener("keydown", function (e) {
      var resultsEl = document.getElementById("search-results");
      var items = resultsEl.querySelectorAll(".search-result");
      if (e.key === "ArrowDown") {
        e.preventDefault();
        if (items.length) {
          activeIndex = Math.min(activeIndex + 1, items.length - 1);
          highlight(items);
        }
      } else if (e.key === "ArrowUp") {
        e.preventDefault();
        if (items.length) {
          activeIndex = Math.max(activeIndex - 1, 0);
          highlight(items);
        }
      } else if (e.key === "Enter") {
        if (activeIndex >= 0 && items[activeIndex]) {
          e.preventDefault();
          window.location.href = items[activeIndex].getAttribute("href");
        }
      }
    });
  }

  function highlight(items) {
    items.forEach(function (el, i) {
      if (i === activeIndex) {
        el.classList.add("active");
        el.scrollIntoView({ block: "nearest" });
      } else {
        el.classList.remove("active");
      }
    });
  }

  // ---------- data ----------

  function loadData() {
    if (dataPromise) return dataPromise;

    dataPromise = (function () {
      var cachedArticles = null;
      try {
        var raw = sessionStorage.getItem(CACHE_KEY);
        if (raw) {
          var parsed = JSON.parse(raw);
          if (Date.now() - parsed.ts < CACHE_TTL) cachedArticles = parsed.articles;
        }
      } catch (e) {}

      var pagesFetch = fetch(STATIC_INDEX_URL)
        .then(function (r) { return r.ok ? r.json() : { pages: [] }; })
        .catch(function () { return { pages: [] }; });

      var articlesFetch = cachedArticles
        ? Promise.resolve({ items: cachedArticles })
        : fetch(ARTICLES_URL)
            .then(function (r) { return r.ok ? r.json() : { items: [] }; })
            .catch(function () { return { items: [] }; });

      return Promise.all([pagesFetch, articlesFetch]).then(function (results) {
        var pagesRes = results[0];
        var articlesRes = results[1];

        var pages = (pagesRes.pages || []).map(function (p) {
          return {
            type: "Pages",
            title: p.title,
            url: p.url,
            excerpt: p.description || ""
          };
        });

        var articles = (articlesRes.items || []).map(function (i) {
          return {
            type: "Writing",
            title: i.title,
            url: i.link,
            excerpt: i.excerpt || ""
          };
        });

        if (!cachedArticles && articles.length) {
          try {
            sessionStorage.setItem(
              CACHE_KEY,
              JSON.stringify({ ts: Date.now(), articles: articlesRes.items || [] })
            );
          } catch (e) {}
        }

        allItems = pages.concat(articles);
        return allItems;
      });
    })();

    return dataPromise;
  }

  // ---------- search ----------

  function scoreItem(item, q) {
    var title = (item.title || "").toLowerCase();
    var excerpt = (item.excerpt || "").toLowerCase();
    if (title === q) return 100;
    if (title.indexOf(q) === 0) return 90;
    if (title.indexOf(q) !== -1) return 70;
    if (excerpt.indexOf(q) !== -1) return 40;
    return 0;
  }

  function runSearch(query) {
    var q = query.trim().toLowerCase();
    if (!q) return [];
    return allItems
      .map(function (item) { return { item: item, s: scoreItem(item, q) }; })
      .filter(function (x) { return x.s > 0; })
      .sort(function (a, b) { return b.s - a.s; })
      .slice(0, 10)
      .map(function (x) { return x.item; });
  }

  function escapeHTML(str) {
    var div = document.createElement("div");
    div.textContent = str || "";
    return div.innerHTML;
  }

  function renderResults(query) {
    var resultsEl = document.getElementById("search-results");
    activeIndex = -1;

    if (!query.trim()) {
      resultsEl.innerHTML = '<div class="search-hint">Start typing to search across every page and essay.</div>';
      return;
    }

    loadData().then(function () {
      var matches = runSearch(query);

      if (!matches.length) {
        resultsEl.innerHTML = '<div class="search-empty">No results for “' + escapeHTML(query) + '”.</div>';
        return;
      }

      var html = "";
      var currentType = null;
      matches.forEach(function (item) {
        if (item.type !== currentType) {
          currentType = item.type;
          html += '<div class="search-section-label">' + escapeHTML(currentType) + "</div>";
        }
        html +=
          '<a class="search-result" href="' + escapeHTML(item.url) + '">' +
          '<div class="search-result-title">' + escapeHTML(item.title) + "</div>" +
          (item.excerpt
            ? '<div class="search-result-excerpt">' + escapeHTML(item.excerpt) + "</div>"
            : "") +
          "</a>";
      });
      resultsEl.innerHTML = html;
    });
  }

  // ---------- open / close ----------

  function openOverlay() {
    var overlay = document.getElementById("search-overlay");
    overlay.classList.add("open");
    document.body.style.overflow = "hidden";
    loadData(); // warm the cache as soon as the box opens
    var input = document.getElementById("search-input");
    input.value = "";
    renderResults("");
    setTimeout(function () { input.focus(); }, 30);
  }

  function closeOverlay() {
    var overlay = document.getElementById("search-overlay");
    overlay.classList.remove("open");
    document.body.style.overflow = "";
    if (lastTrigger) lastTrigger.focus();
  }

  function isOpen() {
    var overlay = document.getElementById("search-overlay");
    return overlay && overlay.classList.contains("open");
  }

  // ---------- global keyboard shortcuts ----------

  document.addEventListener("keydown", function (e) {
    if (isOpen()) {
      if (e.key === "Escape") closeOverlay();
      return;
    }
    var tag = (e.target.tagName || "").toLowerCase();
    var typing = tag === "input" || tag === "textarea" || e.target.isContentEditable;

    if ((e.key === "k" || e.key === "K") && (e.metaKey || e.ctrlKey)) {
      e.preventDefault();
      lastTrigger = document.getElementById("search-trigger");
      openOverlay();
    } else if (e.key === "/" && !typing) {
      e.preventDefault();
      lastTrigger = document.getElementById("search-trigger");
      openOverlay();
    }
  });

  // ---------- init ----------

  function init() {
    injectTrigger();
    injectOverlay();
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
