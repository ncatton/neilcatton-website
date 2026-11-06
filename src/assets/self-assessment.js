/* The Predictive Purpose self-assessment (/self-assessment.html).
   The page already holds every statement as a plain form. This adds: one step at a time, running totals,
   the profile chart, the band, notes, saving in this browser only (localStorage), print, and start again.
   Nothing is sent anywhere. Scores keep the saved shape the tool used at tool.neilcatton.com. */
(function () {
  "use strict";
  var root = document.getElementById("tool");
  if (!root) return;
  var KEY = "predictivePurposeSelfAssessment.v1";
  var panels = [].slice.call(root.querySelectorAll(".sa-panel"));
  var dims = [].slice.call(root.querySelectorAll(".sa-dim"));
  var N = dims.length, LAST = N + 1;
  var counts = dims.map(function (d) { return d.querySelectorAll(".sa-st").length; });
  var TOTAL = counts.reduce(function (a, b) { return a + b; }, 0);
  var MAX = N * 10;
  var fields = [].slice.call(root.querySelectorAll("[data-fm]"));
  var $ = function (s) { return root.querySelector(s); };
  var $$ = function (s) { return [].slice.call(root.querySelectorAll(s)); };

  function blank() {
    var fm = {};
    fields.forEach(function (f) { fm[f.getAttribute("data-fm")] = ""; });
    return {
      frontMatter: fm,
      scores: counts.map(function (n) { return new Array(n).fill(null); }),
      notes: counts.map(function (n) { return new Array(n).fill(""); }),
      generalNotes: "",
      step: 0
    };
  }
  function load() {
    var s = blank(), p = null;
    try { p = JSON.parse(localStorage.getItem(KEY) || "null"); } catch (e) { p = null; }
    if (!p || typeof p !== "object") return s;
    if (p.frontMatter) Object.keys(s.frontMatter).forEach(function (k) { if (typeof p.frontMatter[k] === "string") s.frontMatter[k] = p.frontMatter[k]; });
    counts.forEach(function (n, i) {
      for (var j = 0; j < n; j++) {
        var v = p.scores && p.scores[i] ? p.scores[i][j] : null;
        s.scores[i][j] = v === 0 || v === 1 || v === 2 ? v : null;
        var t = p.notes && p.notes[i] ? p.notes[i][j] : "";
        s.notes[i][j] = typeof t === "string" ? t : "";
      }
    });
    if (typeof p.generalNotes === "string") s.generalNotes = p.generalNotes;
    if (typeof p.step === "number" && p.step >= 0 && p.step <= LAST) s.step = p.step;
    return s;
  }
  var state = load(), timer = null;
  function save() {
    clearTimeout(timer);
    timer = setTimeout(function () { try { localStorage.setItem(KEY, JSON.stringify(state)); } catch (e) { /* private window: nothing kept */ } }, 150);
  }

  var sub = function (i) { return state.scores[i].reduce(function (a, v) { return a + (v || 0); }, 0); };
  var scoredIn = function (i) { return state.scores[i].filter(function (v) { return v !== null; }).length; };
  var scored = function () { return counts.reduce(function (a, n, i) { return a + scoredIn(i); }, 0); };
  var total = function () { return counts.reduce(function (a, n, i) { return a + sub(i); }, 0); };
  function text(el, t) { if (el && el.textContent !== String(t)) el.textContent = t; }

  /* Fill the form from the saved state. */
  function fill() {
    fields.forEach(function (f) { f.value = state.frontMatter[f.getAttribute("data-fm")] || ""; });
    counts.forEach(function (n, i) {
      for (var j = 0; j < n; j++) {
        $$('input[name="d' + i + "s" + j + '"]').forEach(function (r) { r.checked = state.scores[i][j] === Number(r.value); });
        var note = $('[data-note="' + i + "-" + j + '"]');
        if (note) { note.value = state.notes[i][j]; note.closest(".sa-note").classList.toggle("has-note", !!state.notes[i][j].trim()); }
      }
    });
    $("[data-general]").value = state.generalNotes;
  }

  /* The profile: an octagon, dimension 1 at the top, clockwise, scored 0 to 10 from the centre. */
  var NS = "http://www.w3.org/2000/svg", R = 112;
  function pt(i, v) { var a = -Math.PI / 2 + (2 * Math.PI * i) / N; return [Math.cos(a) * R * v / 10, Math.sin(a) * R * v / 10]; }
  function el(name, attrs) { var e = document.createElementNS(NS, name); for (var k in attrs) e.setAttribute(k, attrs[k]); return e; }
  var radar = $("[data-radar]"), area, dots = [];
  function drawFrame() {
    var arcs = [[0, 3, 0], [3, 7, 1], [7, 8, 2]];
    arcs.forEach(function (g) {
      var a0 = -Math.PI / 2 + (2 * Math.PI * (g[0] - 0.42)) / N, a1 = -Math.PI / 2 + (2 * Math.PI * (g[1] - 0.58)) / N, r = R + 34;
      var big = a1 - a0 > Math.PI ? 1 : 0;
      radar.appendChild(el("path", { "class": "sa-r-arc sa-r-arc-" + g[2], d: "M" + (Math.cos(a0) * r).toFixed(1) + " " + (Math.sin(a0) * r).toFixed(1) + " A" + r + " " + r + " 0 " + big + " 1 " + (Math.cos(a1) * r).toFixed(1) + " " + (Math.sin(a1) * r).toFixed(1) }));
    });
    [2, 4, 6, 8, 10].forEach(function (v) {
      var pts = []; for (var i = 0; i < N; i++) pts.push(pt(i, v).map(function (x) { return x.toFixed(1); }).join(","));
      radar.appendChild(el("polygon", { "class": "sa-r-ring" + (v === 10 ? " sa-r-ring-out" : ""), points: pts.join(" ") }));
    });
    for (var i = 0; i < N; i++) {
      var e = pt(i, 10);
      radar.appendChild(el("line", { "class": "sa-r-axis", x1: 0, y1: 0, x2: e[0].toFixed(1), y2: e[1].toFixed(1) }));
      var l = pt(i, 12.1);
      var t = el("text", { "class": "sa-r-num", x: l[0].toFixed(1), y: l[1].toFixed(1) }); t.textContent = String(i + 1);
      radar.appendChild(t);
    }
    area = el("polygon", { "class": "sa-r-area", points: "0,0" });
    radar.appendChild(area);
    for (var k = 0; k < N; k++) { var c = el("circle", { "class": "sa-r-dot", r: 5, cx: 0, cy: 0 }); dots.push(c); radar.appendChild(c); }
  }

  function update() {
    var subs = counts.map(function (n, i) { return sub(i); });
    var t = total(), done = scored();
    var low = Math.min.apply(null, subs);
    var lows = subs.map(function (v, i) { return v === low ? i : -1; }).filter(function (i) { return i >= 0; });
    $$("[data-sub]").forEach(function (e) { text(e, subs[+e.getAttribute("data-sub")]); });
    $$(".sa-step-v[data-sub]").forEach(function (e) { var i = +e.getAttribute("data-sub"); text(e, scoredIn(i) ? subs[i] + "/10" : ""); });
    $$("[data-total]").forEach(function (e) { text(e, t); });
    $$("[data-go]").forEach(function (a) {
      if (a.tagName !== "A") return;
      var s = +a.getAttribute("data-go"), i = s - 1;
      if (s >= 1 && s <= N) {
        var full = scoredIn(i) === counts[i];
        a.classList.toggle("is-done", full);
        a.setAttribute("aria-label", "Dimension " + s + ", " + dims[i].getAttribute("data-short").replace(/^\d+ – /, "") + ": " + (scoredIn(i) ? subs[i] + " of 10" + (full ? ", complete" : ", " + scoredIn(i) + " of " + counts[i] + " scored") : "not started"));
      }
    });
    text($("[data-done]"), done === TOTAL ? "All " + TOTAL + " statements scored. This is your full profile." : done + " of " + TOTAL + " statements scored so far. The figures update as you go and show your full profile once every statement is scored.");
    /* chart and bars */
    var pts = subs.map(function (v, i) { return pt(i, v); });
    area.setAttribute("points", pts.map(function (p) { return p[0].toFixed(1) + "," + p[1].toFixed(1); }).join(" "));
    dots.forEach(function (c, i) { c.setAttribute("cx", pts[i][0].toFixed(1)); c.setAttribute("cy", pts[i][1].toFixed(1)); var lo = done && lows.indexOf(i) >= 0; c.setAttribute("class", "sa-r-dot" + (lo ? " sa-r-dot-low" : "")); c.setAttribute("r", lo ? 7 : 5); });
    $$("[data-bar]").forEach(function (b) { var i = +b.getAttribute("data-bar"); b.style.width = subs[i] * 10 + "%"; b.closest(".sa-bar").classList.toggle("is-low", !!done && lows.indexOf(i) >= 0); });
    $("[data-marker]").style.left = (t / MAX) * 100 + "%";
    $$(".sa-band").forEach(function (b) { var on = t >= +b.getAttribute("data-min") && t <= +b.getAttribute("data-max"); b.classList.toggle("is-on", on); b.querySelector(".sa-band-y").hidden = !on; });
    var names = lows.map(function (i) { return dims[i].getAttribute("data-title"); }).join("; ");
    text($("[data-low]"), done ? "Lowest-scoring dimension" + (lows.length > 1 ? "s" : "") + ": " + names + ", " + low + " / 10." : "");
    /* details recap */
    var recap = $("[data-recap]"), rows = "";
    fields.forEach(function (f) {
      var v = state.frontMatter[f.getAttribute("data-fm")];
      rows += "<div><dt>" + esc(root.querySelector('label[for="' + f.id + '"]').textContent) + "</dt><dd>" + (v ? esc(f.type === "date" ? nice(v) : v) : "Not given") + "</dd></div>";
    });
    if (recap.innerHTML !== rows) recap.innerHTML = rows;
    /* recorded notes */
    var notes = [];
    counts.forEach(function (n, i) { for (var j = 0; j < n; j++) if (state.notes[i][j].trim()) notes.push([i, j]); });
    var box = $("[data-notes]"), html = notes.length ? '<h3 class="sa-h3">Recorded notes</h3><ul>' + notes.map(function (x) {
      var i = x[0], j = x[1], s = state.scores[i][j];
      return '<li><span class="sa-n-k">' + (i + 1) + "." + (j + 1) + " · " + esc(dims[i].getAttribute("data-short").replace(/^\d+ – /, "")) + (s === null ? "" : " · scored " + s + " of 2") + '</span><span class="sa-n-s">' + esc(dims[i].querySelectorAll(".sa-st-t")[j].textContent.replace(/^\s*\d+\.\d+\s*/, "")) + '</span><br><span class="sa-n-n">' + esc(state.notes[i][j]) + "</span></li>";
    }).join("") + "</ul>" : "";
    if (box.innerHTML !== html) box.innerHTML = html;
    box.hidden = !notes.length;
    var res = $("[data-resume]");
    res.hidden = !done;
    if (done) text(res, done + " of " + TOTAL + " statements already scored in this browser.");
    var start = $('.sa-start .sa-pager [data-go="1"]');
    if (start) text(start, done ? "Carry on" : "Start with dimension 1");
  }
  function esc(s) { return String(s).replace(/[&<>"']/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]; }); }
  function nice(v) { var d = new Date(v + "T12:00:00"); return isNaN(d) ? v : d.toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" }); }

  /* One step at a time. */
  function show(step, focus) {
    step = Math.max(0, Math.min(LAST, step));
    state.step = step;
    panels.forEach(function (p) { p.classList.toggle("is-on", +p.getAttribute("data-step") === step); });
    $$(".sa-step").forEach(function (a) { if (+a.getAttribute("data-go") === step) a.setAttribute("aria-current", "step"); else a.removeAttribute("aria-current"); });
    save();
    if (focus) {
      var top = root.getBoundingClientRect().top + window.pageYOffset;
      window.scrollTo(0, top);
      var hd = document.getElementById("sa-h-" + step);
      if (hd) hd.focus({ preventScroll: true });
      if (history.replaceState) history.replaceState(null, "", "#sa-" + step);
    }
  }

  root.addEventListener("click", function (e) {
    var go = e.target.closest("[data-go]");
    if (go) { e.preventDefault(); show(+go.getAttribute("data-go"), true); return; }
    if (e.target.closest("[data-print]")) { window.print(); return; }
    if (e.target.closest("[data-reset]")) { $("[data-confirm]").hidden = false; $("[data-reset-no]").focus(); return; }
    if (e.target.closest("[data-reset-no]")) { $("[data-confirm]").hidden = true; $("[data-reset]").focus(); return; }
    if (e.target.closest("[data-reset-yes]")) {
      state = blank();
      try { localStorage.removeItem(KEY); } catch (err) { /* nothing kept anyway */ }
      fill(); update(); $("[data-confirm]").hidden = true; show(0, true);
    }
  });
  root.addEventListener("change", function (e) {
    var r = e.target;
    var m = r.name && /^d(\d+)s(\d+)$/.exec(r.name);
    if (m) { state.scores[+m[1]][+m[2]] = Number(r.value); save(); update(); }
  });
  root.addEventListener("input", function (e) {
    var t = e.target;
    if (t.hasAttribute("data-fm")) state.frontMatter[t.getAttribute("data-fm")] = t.value;
    else if (t.hasAttribute("data-note")) {
      var p = t.getAttribute("data-note").split("-");
      state.notes[+p[0]][+p[1]] = t.value;
      t.closest(".sa-note").classList.toggle("has-note", !!t.value.trim());
    } else if (t.hasAttribute("data-general")) state.generalNotes = t.value;
    else return;
    save(); update();
  });

  drawFrame();
  root.classList.add("sa-on");
  $$(".sa-progress, .sa-pager, .sa-sub, .sa-recap, .sa-prof, .sa-score, .sa-acts").forEach(function (e) { e.hidden = false; });
  fill(); update();
  var m = /^#sa-(\d+)$/.exec(location.hash);
  show(m ? +m[1] : state.step, !!m);
  window.addEventListener("hashchange", function () { var h = /^#sa-(\d+)$/.exec(location.hash); if (h) show(+h[1], true); });
})();
