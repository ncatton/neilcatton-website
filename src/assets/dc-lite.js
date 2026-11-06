/* A small renderer for the few sections whose content changes when a reader picks something
   (About, Books, Services, Writing). The static HTML is complete without it; with it, the same
   template and logic drive the section. No dependencies. */
(function () {
  "use strict";
  var HOLE = /\[\[\s*([^\]]+?)\s*\]\]/g;
  function DCLogic(props) { this.props = props || {}; this.state = {}; }
  DCLogic.prototype.setState = function (s) { Object.assign(this.state, s); if (this.__rr) this.__rr(); };
  window.DCLogic = DCLogic;
  function get(o, p) {
    p = p.trim();
    if (p === "true") return true;
    if (p === "false") return false;
    return p.split(".").reduce(function (a, k) { return a == null ? a : a[k]; }, o);
  }
  function key(attr) { return attr.replace(/[\[\]\s]/g, ""); }
  function on(el, type, fn) {
    el.__on = el.__on || {};
    if (!el.__on[type]) el.addEventListener(type, function (e) { el.__on[type](e); });
    el.__on[type] = fn;
  }
  function fill(n, scope) {
    if (n.nodeType === 3) {
      n.nodeValue = n.nodeValue.replace(HOLE, function (_, p) { var v = get(scope, p); return v == null ? "" : v; });
      return;
    }
    if (n.nodeType !== 1) return;
    var tag = n.tagName.toLowerCase();
    if (tag === "sc-for") {
      var list = get(scope, key(n.getAttribute("list"))) || [], as = n.getAttribute("as");
      var f = document.createDocumentFragment();
      list.forEach(function (item) {
        [].slice.call(n.children).forEach(function (c) {
          var k = c.cloneNode(true), sc = Object.assign({}, scope); sc[as] = item;
          fill(k, sc); f.appendChild(k);
        });
      });
      n.replaceWith(f);
      return;
    }
    if (tag === "sc-if") {
      if (!get(scope, key(n.getAttribute("value")))) { n.remove(); return; }
      [].slice.call(n.childNodes).forEach(function (c) { fill(c, scope); });
      var g = document.createDocumentFragment();
      [].slice.call(n.childNodes).forEach(function (c) { g.appendChild(c); });
      n.replaceWith(g);
      return;
    }
    [].slice.call(n.attributes).forEach(function (a) {
      if (a.value.indexOf("[[") === -1) return;
      if (/^on/.test(a.name)) {
        var fn = get(scope, key(a.value));
        n.removeAttribute(a.name);
        var ev = a.name.slice(2);
        if (fn) on(n, ev === "change" ? "input" : ev, fn);
        return;
      }
      var v = a.value.replace(HOLE, function (_, p) { return String(get(scope, p)); });
      if (a.name === "data-dc-style") { n.removeAttribute(a.name); n.style.cssText = v; }
      else n.setAttribute(a.name, v);
    });
    [].slice.call(n.childNodes).forEach(function (c) { fill(c, scope); });
  }
  /* Update in place rather than replacing, so focus, open details and live regions survive. */
  function morph(a, b) {
    if (a.nodeType !== b.nodeType || a.nodeName !== b.nodeName) { a.replaceWith(b); return; }
    if (a.nodeType === 3) { if (a.nodeValue !== b.nodeValue) a.nodeValue = b.nodeValue; return; }
    if (a.nodeType !== 1) return;
    [].slice.call(a.attributes).forEach(function (x) {
      if (x.name !== "open" && x.name !== "style" && !b.hasAttribute(x.name)) a.removeAttribute(x.name);
    });
    [].slice.call(b.attributes).forEach(function (x) {
      if (x.name !== "open" && x.name !== "style" && a.getAttribute(x.name) !== x.value) a.setAttribute(x.name, x.value);
    });
    if (b.style && b.style.cssText && a.style.cssText !== b.style.cssText) a.style.cssText = b.style.cssText;
    if (b.__on) Object.keys(b.__on).forEach(function (t) { on(a, t, b.__on[t]); });
    var ac = [].slice.call(a.childNodes), bc = [].slice.call(b.childNodes);
    bc.forEach(function (c, i) { if (ac[i]) morph(ac[i], c); else a.appendChild(c); });
    ac.slice(bc.length).forEach(function (c) { c.remove(); });
  }
  window.dcMount = function (Component, sections) {
    var comp = new Component({});
    var holders = {};
    Object.keys(sections).forEach(function (i) {
      var t = document.createElement("template");
      t.innerHTML = sections[i];
      holders[i] = t;
    });
    function make(i, vals) {
      var d = holders[i].content.cloneNode(true);
      [].slice.call(d.childNodes).forEach(function (c) { fill(c, vals); });
      var el = d.querySelector("section");
      el.setAttribute("data-dc", i);
      return el;
    }
    function draw(first) {
      var vals = comp.renderVals();
      Object.keys(holders).forEach(function (i) {
        var live = document.querySelector('[data-dc="' + i + '"]');
        if (!live) return;
        var next = make(i, vals);
        if (first) live.replaceWith(next); else morph(live, next);
      });
    }
    comp.__rr = function () { draw(false); };
    draw(true);
  };
})();
