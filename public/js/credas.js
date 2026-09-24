(function () {
  "use strict";

  var root = document.documentElement;
  var body = document.body;
  var reduced = matchMedia("(prefers-reduced-motion: reduce)").matches;
  var $ = function (s, c) { return (c || document).querySelector(s); };
  var $$ = function (s, c) { return Array.prototype.slice.call((c || document).querySelectorAll(s)); };

  function toRgb(hex) {
    var h = String(hex || "").replace("#", "").trim();
    if (h.length === 3) h = h[0] + h[0] + h[1] + h[1] + h[2] + h[2];
    if (h.length !== 6 || /[^0-9a-f]/i.test(h)) return "123, 104, 238";
    return [parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16)].join(", ");
  }
  root.style.setProperty("--accent-rgb", toRgb(getComputedStyle(root).getPropertyValue("--accent")));

  var LEGACY = {
    "fa-star": "star", "fa-headset": "headset", "fa-bolt": "zap", "fa-gem": "gem",
    "fa-cogs": "settings", "fa-sliders-h": "sliders-horizontal", "fa-shield-alt": "shield",
    "fa-shield-halved": "shield-half", "fa-user-friends": "users", "fa-check": "check",
    "fa-shopping-cart": "shopping-cart", "fa-shopping-bag": "shopping-bag", "fa-box-open": "package-open",
    "fa-box": "package", "fa-chart-line": "chart-line", "fa-heart": "heart", "fa-link": "link",
    "fa-bars": "menu", "fa-times": "x", "fa-download": "download", "fa-cart-plus": "cart-plus",
    "fa-eye": "eye", "fa-user": "user", "fa-cog": "settings", "fa-sign-in-alt": "log-in",
    "fa-arrow-right-from-bracket": "log-out", "fa-external-link-alt": "external-link",
    "fa-arrow-right": "arrow-right", "fa-chevron-down": "chevron-down", "fa-search": "search",
    "fa-th": "grid-2x2", "fa-tag": "tag", "fa-clock": "clock", "fa-key": "key", "fa-trash-alt": "trash-2"
  };

  function renderIcons() {
    if (!window.lucide || !lucide.createIcons) return;
    try { lucide.createIcons(); } catch (e) {}
  }
  function upgradeLegacy() {
    $$("i[data-fa]").forEach(function (el) {
      // The Font Awesome class may arrive either as class="fas fa-bolt" or as
      // the data-fa="fas fa-bolt" attribute; read whichever is present.
      var raw = el.getAttribute("data-fa") || el.className || "";
      var parts = String(raw).split(/\s+/).filter(Boolean);
      var name = LEGACY[parts[parts.length - 1]];
      if (!name) return;
      var s = document.createElementNS("http://www.w3.org/2000/svg", "svg");
      s.setAttribute("data-lucide", name);
      s.setAttribute("aria-hidden", "true");
      el.parentNode.replaceChild(s, el);
    });
    renderIcons();
  }

  function toast(msg) {
    var wrap = $(".toasts");
    if (!wrap) { wrap = document.createElement("div"); wrap.className = "toasts"; body.appendChild(wrap); }
    var t = document.createElement("div");
    t.className = "toast";
    t.setAttribute("role", "status");
    t.innerHTML = '<i data-lucide="check"></i><span></span>';
    $("span", t).textContent = msg;
    wrap.appendChild(t);
    renderIcons();
    setTimeout(function () {
      t.style.transition = "opacity 180ms linear";
      t.style.opacity = "0";
      setTimeout(function () { if (t.parentNode) t.remove(); }, 200);
    }, 2600);
  }
  window.credasToast = toast;

  function run() {
    upgradeLegacy();

    $$("[data-stagger]").forEach(function (g) {
      Array.prototype.forEach.call(g.children, function (c, i) {
        c.classList.add("enter");
        c.style.setProperty("--i", Math.min(i, 6));
      });
    });
    body.classList.add("loaded");

    var nav = $(".nav");
    if (nav) {
      var last = 0;
      window.addEventListener("scroll", function () {
        var y = window.scrollY;
        if ((y > 40) !== (last > 40)) nav.setAttribute("data-condensed", String(y > 40));
        last = y;
      }, { passive: true });
    }

    var headerSearch = $("[data-header-search]");
    if (headerSearch) {
      headerSearch.addEventListener("keydown", function (e) {
        if (e.key !== "Enter") return;
        e.preventDefault();
        window.location.href = "/products?q=" + encodeURIComponent(headerSearch.value.trim());
      });
    }

    var burger = $("[data-burger]");
    var drawer = $("[data-drawer]");
    if (burger && drawer) {
      var setDrawer = function (open) {
        drawer.setAttribute("data-open", String(open));
        burger.setAttribute("aria-expanded", String(open));
        body.setAttribute("data-lock", open ? "1" : "0");
        if (open) { var f = $("a", drawer); if (f) f.focus(); }
      };
      burger.addEventListener("click", function () { setDrawer(drawer.getAttribute("data-open") !== "true"); });
      drawer.addEventListener("click", function (e) { if (e.target === drawer || e.target.closest("[data-drawer-close]")) setDrawer(false); });
      document.addEventListener("keydown", function (e) { if (e.key === "Escape") setDrawer(false); });
    }

    var menu = $("[data-menu]");
    if (menu) {
      var mb = $("[data-menu-btn]", menu);
      mb.addEventListener("click", function (e) {
        e.stopPropagation();
        var open = menu.classList.toggle("open");
        mb.setAttribute("aria-expanded", String(open));
      });
      document.addEventListener("click", function () { menu.classList.remove("open"); mb.setAttribute("aria-expanded", "false"); });
      $(".menu-pop", menu).addEventListener("click", function (e) { e.stopPropagation(); });
    }

    function closeDialogs() {
      $$(".dialog-wrap[data-open='true']").forEach(function (d) { d.setAttribute("data-open", "false"); });
      if (!$(".drawer[data-open='true']")) body.setAttribute("data-lock", "0");
    }
    function openDialog(d, origin) {
      if (origin) {
        var r = origin.getBoundingClientRect();
        d.style.setProperty("--ox", (r.left + r.width / 2) + "px");
        d.style.setProperty("--oy", (r.top + r.height / 2) + "px");
      }
      d.setAttribute("data-open", "true");
      body.setAttribute("data-lock", "1");
      var f = $("[data-autofocus]", d) || $("input, select, textarea, button", d);
      if (f) f.focus();
    }
    document.addEventListener("click", function (e) {
      var o = e.target.closest("[data-dialog-open]");
      if (o) {
        e.preventDefault();
        var id = o.getAttribute("data-dialog-open");
        var dlg = document.getElementById(id);
        if (!dlg) return;
        var card = o.closest("[data-qv]");
        if (card) {
          var d = JSON.parse(card.dataset.qv);
          var set = function (sel, val) { var n = $(sel, dlg); if (n) val ? (n.textContent = val) : (n.innerHTML = val); };
          set("[data-qv-name]", d.name); set("[data-qv-cat]", d.cat);
          set("[data-qv-desc]", d.desc); set("[data-qv-price]", d.priceHtml);
          var img = $("[data-qv-img]", dlg); if (img) img.src = d.img;
          var link = $("[data-qv-link]", dlg); if (link) link.href = d.url;
        }
        openDialog(dlg, o);
        return;
      }
      if (e.target.closest("[data-dialog-close]") || e.target.classList.contains("dialog-wrap")) closeDialogs();
    });
    document.addEventListener("keydown", function (e) { if (e.key === "Escape") closeDialogs(); });

    $$(".faq-q").forEach(function (q) {
      q.addEventListener("click", function () {
        var item = q.closest(".faq-item");
        var was = item.getAttribute("data-open") === "true";
        $$(".faq-item").forEach(function (o) { o.setAttribute("data-open", "false"); $(".faq-q", o).setAttribute("aria-expanded", "false"); });
        item.setAttribute("data-open", was ? "false" : "true");
        q.setAttribute("aria-expanded", was ? "false" : "true");
      });
    });

    var grid = $("[data-grid]");
    var params = new URLSearchParams(window.location.search);
    if (grid) {
      var cards = $$("[data-name]", grid);
      var search = $("[data-search]");
      var sort = $("[data-sort]");
      var count = $("[data-count]");
      var empty = $("[data-empty]");
      var term = $("[data-term]");
      if (search && params.get("q")) search.value = params.get("q");
      function apply(animate) {
        var q = (search && search.value || "").trim().toLowerCase();
        var shown = [];
        cards.forEach(function (c) {
          var hay = ((c.dataset.name || "") + " " + (c.dataset.cat || "")).toLowerCase();
          var ok = !q || hay.indexOf(q) > -1;
          if (animate) {
            c.style.transition = "opacity 140ms linear, transform 140ms cubic-bezier(0.22,1,0.36,1)";
            c.style.opacity = ok ? "1" : "0";
            c.style.transform = ok ? "none" : "scale(0.97)";
            setTimeout(function () { if (!ok) c.hidden = true; }, 150);
          } else {
            c.hidden = !ok;
          }
          if (ok) shown.push(c);
        });
        if (sort) {
          var m = sort.value;
          shown.sort(function (a, b) {
            var pa = parseFloat(a.dataset.price || "0"), pb = parseFloat(b.dataset.price || "0");
            if (m === "price-asc") return pa - pb;
            if (m === "price-desc") return pb - pa;
            if (m === "name") return (a.dataset.name || "").localeCompare(b.dataset.name || "");
            if (m === "new") return (b.dataset.created || "") < (a.dataset.created || "") ? -1 : 1;
            return (a.dataset.pos || "0") - (b.dataset.pos || "0");
          });
          shown.forEach(function (c) { grid.appendChild(c); });
        }
        if (count) count.textContent = String(shown.length);
        if (term) term.textContent = search ? search.value : "";
        if (empty) empty.hidden = shown.length > 0;
      }
      if (search) {
        var t;
        search.addEventListener("input", function () {
          clearTimeout(t);
          cards.forEach(function (c) { if (c.hidden) { c.hidden = false; } });
          t = setTimeout(function () { apply(true); }, 90);
        });
        document.addEventListener("keydown", function (e) {
          var tag = (document.activeElement && document.activeElement.tagName) || "";
          if (e.key === "/" && document.activeElement !== search && !/input|textarea|select/i.test(tag)) { e.preventDefault(); search.focus(); }
        });
      }
      if (sort) sort.addEventListener("change", function () { apply(false); });
      $$("[data-view]").forEach(function (b) {
        b.addEventListener("click", function () {
          $$("[data-view]").forEach(function (x) { x.setAttribute("aria-pressed", "false"); });
          b.setAttribute("aria-pressed", "true");
          grid.classList.toggle("dense", b.dataset.view === "compact");
        });
      });
      apply(false);
    }

    var WKEY = "credas.saved.v1";
    function saved() { try { return JSON.parse(localStorage.getItem(WKEY) || "[]"); } catch (e) { return []; } }
    function saveSaved(v) { try { localStorage.setItem(WKEY, JSON.stringify(v)); } catch (e) {} }
    function paintSaved() {
      var ids = saved();
      $$("[data-save]").forEach(function (b) { b.setAttribute("aria-pressed", String(ids.indexOf(b.dataset.save) > -1)); });
    }
    document.addEventListener("click", function (e) {
      var b = e.target.closest("[data-save]");
      if (!b) return;
      e.preventDefault();
      var ids = saved(), i = ids.indexOf(b.dataset.save);
      if (i > -1) { ids.splice(i, 1); toast("Removed from saved products"); }
      else { ids.push(b.dataset.save); toast("Saved for later"); }
      saveSaved(ids);
      paintSaved();
    });
    paintSaved();

    var addBtn = $("[data-add]");
    if (addBtn) {
      addBtn.addEventListener("click", function () {
        addBtn.classList.add("is-done");
        $("[data-add-label]", addBtn).textContent = "Added to cart";
        toast("Added to cart");
        setTimeout(function () {
          addBtn.classList.remove("is-done");
          $("[data-add-label]", addBtn).textContent = "Add to cart";
        }, 1800);
      });
    }

    fetch("/api/cart/count").then(function (r) { return r.json(); }).then(function (d) {
      $$("[data-cart]").forEach(function (el) {
        if (d.count == null) return;
        if (el.textContent !== String(d.count)) {
          el.textContent = d.count;
          el.setAttribute("data-bump", "1");
          if (d.count === 0) el.setAttribute("data-empty", "1");
          setTimeout(function () { el.removeAttribute("data-bump"); }, 400);
        }
      });
    }).catch(function () {});

    $$("[data-countdown]").forEach(function (el) {
      var to = new Date(el.dataset.countdown).getTime();
      if (isNaN(to)) return;
      function tick() {
        var ms = to - Date.now();
        if (ms <= 0) { el.textContent = "Sale ended"; return; }
        var d = Math.floor(ms / 864e5), h = Math.floor(ms / 36e5) % 24, m = Math.floor(ms / 6e4) % 60;
        el.textContent = (d > 0 ? d + "d " : "") + String(h).padStart(2, "0") + ":" + String(m).padStart(2, "0") + " left";
      }
      tick();
      setInterval(tick, 30000);
    });

    var bars = $$("[data-bar]");
    if (bars.length && !reduced) {
      requestAnimationFrame(function () {
        bars.forEach(function (b) { b.style.transform = "scaleX(" + (parseFloat(b.dataset.bar) || 0) + ")"; });
      });
    }

    var recent = $("[data-recent]");
    if (recent) {
      try {
        var seen = JSON.parse(localStorage.getItem("credas.recent") || "[]");
        if (seen.length) {
          recent.innerHTML = seen.map(function (r) {
            return '<a class="plate-card" href="' + r.u + '"><div class="plate-media"><img src="' + r.i + '" alt="" loading="lazy"></div><div class="plate-body"><h3>' + r.n + "</h3></div></a>";
          }).join("");
        } else {
          var w = recent.closest("[data-recent-wrap]");
          if (w) w.hidden = true;
        }
      } catch (e) {}
    }

    if (!reduced) {
      document.addEventListener("click", function (e) {
        var a = e.target.closest("a[href]");
        if (!a || e.defaultPrevented || e.metaKey || e.ctrlKey || e.shiftKey || e.button !== 0) return;
        var href = a.getAttribute("href");
        if (!href || href.charAt(0) === "#" || /^(https?:)?\/\//.test(href) || a.target === "_blank") return;
        e.preventDefault();
        body.setAttribute("data-leaving", "1");
        setTimeout(function () { window.location.href = href; }, 140);
      });
    }
  }

  function boot() {
    if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", run);
    else run();
  }

  if (window.lucide) boot();
  else {
    var s = document.createElement("script");
    s.src = "https://unpkg.com/lucide@0.460.0/dist/umd/lucide.min.js";
    s.onload = boot;
    s.onerror = boot;
    document.head.appendChild(s);
  }
})();
