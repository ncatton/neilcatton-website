/* ═══════════════════════════════════════════════════════════════════
   neilcatton.com — shared behaviour

   Loaded with `defer` on every page. Everything here is progressive
   enhancement: with JavaScript off the site still navigates, still
   reads, and still submits its forms.

   Contents
     1  Nav — scroll shadow, mobile panel, dropdown disclosures
     2  Announcements
     3  Substack feed
     4  Contact forms
     5  Lazy third-party embeds
   ═══════════════════════════════════════════════════════════════════ */
(function () {
  "use strict";

  /* ── helpers ──────────────────────────────────────────────────── */

  /* Escape before interpolating anything that came off the network.
     The old card renderers dropped feed titles and excerpts straight
     into innerHTML. The content is Neil's own, but two of the four
     fallback fetches routed it through third-party proxies, and the CSP
     allowed 'unsafe-inline' at the time — so injected markup would have
     run. Those fallbacks and that CSP allowance are both gone; the
     escaping stays, because the next feed source will not be. */
  function esc(str) {
    var d = document.createElement("div");
    d.textContent = str == null ? "" : String(str);
    return d.innerHTML;
  }

  function stripHTML(str) {
    var d = document.createElement("div");
    d.innerHTML = str || "";
    return (d.textContent || "").replace(/\s+/g, " ").trim();
  }

  function fmtDate(str) {
    try {
      var d = new Date(str);
      if (isNaN(d.getTime())) return "";
      return d.toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" });
    } catch (e) { return ""; }
  }

  /* ── 1. NAV ───────────────────────────────────────────────────── */

  var nav = document.getElementById("site-nav");

  if (nav) {
    window.addEventListener("scroll", function () {
      nav.classList.toggle("scrolled", window.scrollY > 40);
    }, { passive: true });
  }

  /* Mobile panel.
     Before this existed, `.nav-links { display: none }` fired below
     580px and nothing replaced it — no hamburger anywhere on the site.
     On a phone the only visible destinations were the four footer
     links that happened to fit. Contact was not among them. */
  var navToggle = document.getElementById("nav-toggle");

  /* The panel sits below the bar, and the bar's height changes with the
     viewport. Measure it rather than guessing. */
  function syncNavHeight() {
    if (nav) nav.style.setProperty("--nav-h", nav.offsetHeight + "px");
  }
  syncNavHeight();
  window.addEventListener("resize", syncNavHeight, { passive: true });

  function setNavOpen(open) {
    if (!nav || !navToggle) return;
    if (open) syncNavHeight();
    nav.setAttribute("data-nav-open", open ? "true" : "false");
    navToggle.setAttribute("aria-expanded", open ? "true" : "false");
    navToggle.querySelector(".nav-toggle-text").textContent = open ? "Close" : "Menu";
    document.body.setAttribute("data-nav-open", open ? "true" : "false");
  }

  function navIsOpen() {
    return !!nav && nav.getAttribute("data-nav-open") === "true";
  }

  if (navToggle) {
    navToggle.addEventListener("click", function () {
      var open = !navIsOpen();
      setNavOpen(open);
      if (open) {
        var first = nav.querySelector(".nav-panel a, .nav-panel button");
        if (first) first.focus();
      }
    });
  }

  /* Dropdown disclosures. Click rather than hover: a hover-only menu
     cannot be opened on a touch device (tapping the parent navigates
     instead) and reports no state to assistive technology. */
  var dropdownToggles = [].slice.call(document.querySelectorAll(".nav-dropdown-toggle"));

  function closeAllDropdowns(except) {
    dropdownToggles.forEach(function (t) {
      if (t !== except) t.setAttribute("aria-expanded", "false");
    });
  }

  dropdownToggles.forEach(function (toggle) {
    toggle.addEventListener("click", function (e) {
      e.stopPropagation();
      var open = toggle.getAttribute("aria-expanded") === "true";
      closeAllDropdowns(toggle);
      toggle.setAttribute("aria-expanded", open ? "false" : "true");
    });

    /* Left/right arrows move between items inside an open menu. */
    var menu = toggle.nextElementSibling;
    if (menu && menu.classList.contains("dropdown-menu")) {
      menu.addEventListener("keydown", function (e) {
        var items = [].slice.call(menu.querySelectorAll("a"));
        var i = items.indexOf(document.activeElement);
        if (e.key === "ArrowDown" && i > -1) { e.preventDefault(); items[Math.min(i + 1, items.length - 1)].focus(); }
        else if (e.key === "ArrowUp" && i > -1) { e.preventDefault(); if (i === 0) toggle.focus(); else items[i - 1].focus(); }
      });
    }

    toggle.addEventListener("keydown", function (e) {
      if (e.key === "ArrowDown") {
        e.preventDefault();
        toggle.setAttribute("aria-expanded", "true");
        var first = toggle.nextElementSibling && toggle.nextElementSibling.querySelector("a");
        if (first) first.focus();
      }
    });
  });

  /* Escape closes the innermost thing that is open. Click outside
     closes any open dropdown. */
  document.addEventListener("keydown", function (e) {
    if (e.key !== "Escape") return;
    var openToggle = dropdownToggles.filter(function (t) { return t.getAttribute("aria-expanded") === "true"; })[0];
    if (openToggle) {
      openToggle.setAttribute("aria-expanded", "false");
      openToggle.focus();
      return;
    }
    if (navIsOpen()) {
      setNavOpen(false);
      if (navToggle) navToggle.focus();
    }
  });

  document.addEventListener("click", function (e) {
    if (!e.target.closest || !e.target.closest(".nav-dropdown")) closeAllDropdowns(null);
  });

  /* Keep state honest when the viewport crosses the breakpoint. */
  if (window.matchMedia) {
    var mq = window.matchMedia("(min-width: 1080px)");
    var onChange = function (ev) { if (ev.matches) setNavOpen(false); };
    if (mq.addEventListener) mq.addEventListener("change", onChange);
    else if (mq.addListener) mq.addListener(onChange);
  }

  /* ── 2. ANNOUNCEMENTS ─────────────────────────────────────────── */
  /* Reads data/announcements.json. Shows up to three current entries,
     newest first. No current announcements, no bar. */

  (function loadAnnouncements() {
    var bar = document.getElementById("announce-bar");
    if (!bar) return;
    fetch("/data/announcements.json").then(function (r) {
      if (!r.ok) throw new Error("HTTP " + r.status);
      return r.json();
    }).then(function (data) {
      var items = Array.isArray(data.announcements) ? data.announcements : [];
      var today = new Date().toISOString().slice(0, 10);
      var active = items
        .filter(function (a) { return !a.expires || a.expires >= today; })
        .sort(function (a, b) { return new Date(b.date) - new Date(a.date); })
        .slice(0, 3);
      if (!active.length) return;

      bar.innerHTML = active.map(function (a) {
        var link = String(a.link || "#");
        var external = /^https?:\/\//i.test(link);
        /* href is escaped too — a stray quote in the JSON would
           otherwise break out of the attribute. */
        return '<div class="announce-item">' +
                 '<span class="announce-tag">Announcement</span>' +
                 '<span class="announce-text">' + esc(a.text || "") + "</span>" +
                 '<a class="announce-cta" href="' + esc(link) + '"' +
                    (external ? ' target="_blank" rel="noopener noreferrer"' : "") + ">" +
                    esc(a.linkText || "Read more") + " &rarr;</a>" +
               "</div>";
      }).join("");
      bar.hidden = false;
    }).catch(function () { /* bar simply stays hidden */ });
  })();

  /* ── 3. SUBSTACK FEED ─────────────────────────────────────────── */
  /* Two sources, in order: the site's own Netlify function, then the
     Substack API direct. The corsproxy.io and rss2json.com fallbacks
     that used to sit behind these were removed — they put reader
     traffic and Neil's content through two third parties in a
     position to modify it, for a failure case the first two cover. */

  var PUB = "writing.neilcatton.com";

  window.SubstackFeed = {
    pubUrl: "https://" + PUB,
    fetch: function () {
      return fetch("/.netlify/functions/substack-feed")
        .then(function (r) { return r.ok ? r.json() : null; })
        .then(function (data) {
          if (!data || !data.items || !data.items.length) throw new Error("empty");
          return data.items.map(function (i) {
            return {
              title:   i.title || "Untitled",
              excerpt: stripHTML(i.excerpt || ""),
              link:    i.link || "https://" + PUB,
              date:    fmtDate(i.pubDate)
            };
          });
        })
        .catch(function () {
          return fetch("https://" + PUB + "/api/v1/posts?limit=12&offset=0", { headers: { Accept: "application/json" } })
            .then(function (r) { return r.ok ? r.json() : null; })
            .then(function (posts) {
              if (!Array.isArray(posts) || !posts.length) return null;
              return posts.map(function (p) {
                return {
                  title:   p.title || "Untitled",
                  excerpt: stripHTML(p.subtitle || p.body_html || ""),
                  link:    p.canonical_url || "https://" + PUB + "/p/" + p.slug,
                  date:    fmtDate(p.post_date || p.published_at)
                };
              });
            })
            .catch(function () { return null; });
        });
    }
  };

  /* Renders into any element with [data-substack-feed]. The element's
     server-rendered contents are the no-JS fallback and stay in place
     unless a live fetch succeeds. */
  (function renderFeeds() {
    var mounts = [].slice.call(document.querySelectorAll("[data-substack-feed]"));
    if (!mounts.length) return;

    window.SubstackFeed.fetch().then(function (items) {
      if (!items || !items.length) {
        mounts.forEach(function (el) {
          var stale = el.querySelector("[data-feed-stale-notice]");
          if (stale) stale.hidden = false;
        });
        return;
      }
      mounts.forEach(function (el) {
        var limit = parseInt(el.getAttribute("data-substack-feed"), 10) || 3;
        var grid = document.createElement("div");
        grid.className = el.getAttribute("data-feed-grid-class") || "articles-grid";
        items.slice(0, limit).forEach(function (item) {
          var card = document.createElement("article");
          card.className = "article-card";
          card.innerHTML =
            '<p class="article-pub">The Next Evolution</p>' +
            '<h3 class="article-title"><a href="' + esc(item.link) + '" target="_blank" rel="noopener noreferrer">' +
              esc(item.title) + "</a></h3>" +
            '<p class="article-excerpt">' + esc(item.excerpt.slice(0, 160)) + (item.excerpt.length > 160 ? "…" : "") + "</p>" +
            '<p class="article-meta">' + esc(item.date) + "</p>";
          grid.appendChild(card);
        });
        el.innerHTML = "";
        el.appendChild(grid);
      });
    });
  })();

  /* ── 4. CONTACT FORMS ─────────────────────────────────────────── */
  /* Any <form data-contact-form> with a sibling .form-success and
     .form-error panel. Errors are announced in the page rather than
     thrown through alert(). */

  [].slice.call(document.querySelectorAll("form[data-contact-form]")).forEach(function (form) {
    var successEl = document.getElementById(form.getAttribute("data-success"));
    var errorEl   = document.getElementById(form.getAttribute("data-error"));

    form.addEventListener("submit", function (e) {
      e.preventDefault();
      if (errorEl) errorEl.hidden = true;

      if (!form.checkValidity()) { form.reportValidity(); return; }

      var btn = form.querySelector("button[type=submit]");
      var original = btn ? btn.textContent : "";
      if (btn) { btn.textContent = "Sending…"; btn.disabled = true; }

      function fail(message) {
        if (btn) { btn.textContent = original; btn.disabled = false; }
        if (errorEl) {
          errorEl.innerHTML = esc(message) +
            ' Please email <a href="mailto:nc@neilcatton.com">nc@neilcatton.com</a> directly if the problem persists.';
          errorEl.hidden = false;
          errorEl.focus();
          errorEl.scrollIntoView({ behavior: "smooth", block: "center" });
        }
      }

      // Cloudflare Turnstile solves in the background as soon as the
      // widget script loads — normally well before a human finishes
      // filling the form — but on a very fast submit or a slow network
      // it can still be unset. Server-side rejects a missing/invalid
      // token anyway; this just avoids a doomed round-trip and gives a
      // clearer message than the generic failure.
      var tsField = form.querySelector('[name="cf-turnstile-response"]');
      if (!tsField || !tsField.value) {
        fail("Verification is still loading \u2014 please wait a moment and press Send again.");
        return;
      }

      var payload = {};
      new FormData(form).forEach(function (value, key) { payload[key] = value; });

      fetch(form.action, {
        method: "POST",
        headers: { "Content-Type": "application/json", Accept: "application/json" },
        body: JSON.stringify(payload)
      })
        .then(function (res) {
          if (res.ok) {
            form.hidden = true;
            if (successEl) {
              successEl.hidden = false;
              successEl.focus();
              successEl.scrollIntoView({ behavior: "smooth", block: "center" });
            }
            return;
          }
          if (res.status === 429) {
            fail("This form has had a lot of submissions just now — please wait a minute and try again.");
            return;
          }
          return res.json().then(function (json) {
            fail(json && json.errors ? json.errors.map(function (x) { return x.message; }).join(", ") + "." : "Something went wrong sending that.");
          }, function () { fail("Something went wrong sending that."); });
        })
        .catch(function () { fail("Could not reach the form service."); });
    });
  });

  /* ── 5. LAZY THIRD-PARTY EMBEDS ───────────────────────────────── */
  /* Native loading="lazy" preloads a long way ahead of the viewport,
     which was enough to keep the Substack iframe (and its cookies)
     loading on every visit. Hold the src until the element is
     genuinely in view. */

  var lazyEmbeds = [].slice.call(document.querySelectorAll("iframe.lazy-embed[data-src]"));
  if (lazyEmbeds.length) {
    if ("IntersectionObserver" in window) {
      var obs = new IntersectionObserver(function (entries, o) {
        entries.forEach(function (entry) {
          if (!entry.isIntersecting) return;
          entry.target.src = entry.target.dataset.src;
          entry.target.removeAttribute("data-src");
          o.unobserve(entry.target);
        });
      }, { rootMargin: "0px" });
      lazyEmbeds.forEach(function (el) { obs.observe(el); });
    } else {
      lazyEmbeds.forEach(function (el) { el.src = el.dataset.src; });
    }
  }
})();
