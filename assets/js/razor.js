/* Razor — shared site script: config, layout chrome, helpers. No dependencies. */
(function () {
  "use strict";

  document.documentElement.classList.add("js");

  const config = {
    discord: "https://discord.gg/XMzm26Z9SV",
    ltcWallet: "LVmgZH3wJ94UqpR4yAHdeMUmKi544oR1mQ",
    // Codes are checked here, then the discount is applied by staff when the order is verified.
    coupons: ["RAZOR10", "FREEUD", "SUMMER25", "GODMODE", "ULTRA2025"],
    orderKey: "razorOrder",
  };

  /* ───── Icons (inline, stroke-based) ───── */
  const ICONS = {
    arrow: '<path d="M5 12h14M13 6l6 6-6 6"/>',
    left: '<path d="M15 6l-6 6 6 6"/>',
    right: '<path d="M9 6l6 6-6 6"/>',
    close: '<path d="M6 6l12 12M18 6L6 18"/>',
    check: '<path d="M5 12.5l4.2 4.2L19 7"/>',
    copy: '<rect x="9" y="9" width="11" height="11" rx="2.5"/><path d="M5 15V6.5A2.5 2.5 0 0 1 7.5 4H15"/>',
    bolt: '<path d="M13 3L5 13.5h6L10 21l8-10.5h-6z"/>',
    shield: '<path d="M12 3l7.5 3v5.5c0 4.6-3.2 8.2-7.5 9.5-4.3-1.3-7.5-4.9-7.5-9.5V6z"/><path d="M8.8 12l2.3 2.3 4.2-4.6"/>',
    refresh: '<path d="M20 11a8 8 0 0 0-14.6-4.5L4 8M4 4v4h4M4 13a8 8 0 0 0 14.6 4.5L20 16m0 4v-4h-4"/>',
    chat: '<path d="M20 12.5a7.5 7.5 0 0 1-11 6.6L4 20l1-4.3A7.5 7.5 0 1 1 20 12.5z"/>',
    tag: '<path d="M3.5 12.3V4.5a1 1 0 0 1 1-1h7.8l8.2 8.2a1.5 1.5 0 0 1 0 2.1l-5.8 5.8a1.5 1.5 0 0 1-2.1 0z"/><circle cx="8.2" cy="8.2" r="1.4"/>',
    search: '<circle cx="11" cy="11" r="6.5"/><path d="M20 20l-4.3-4.3"/>',
    star: '<path d="M12 3.6l2.6 5.3 5.8.8-4.2 4.1 1 5.8L12 16.9l-5.2 2.7 1-5.8-4.2-4.1 5.8-.8z" fill="currentColor" stroke="none"/>',
    info: '<circle cx="12" cy="12" r="8.5"/><path d="M12 11v5M12 7.6v.1"/>',
    alert: '<path d="M12 4l9 16H3z"/><path d="M12 10v4.5M12 17.4v.1"/>',
    clock: '<circle cx="12" cy="12" r="8.5"/><path d="M12 7.5V12l3 2"/>',
    play: '<path d="M8 5.5v13l10.5-6.5z" fill="currentColor" stroke="none"/>',
    plus: '<path d="M12 5v14M5 12h14"/>',
    expand: '<path d="M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5"/>',
    cpu: '<rect x="6" y="6" width="12" height="12" rx="2"/><path d="M9.5 9.5h5v5h-5zM9 2.5V6M15 2.5V6M9 18v3.5M15 18v3.5M2.5 9H6M2.5 15H6M18 9h3.5M18 15h3.5"/>',
    discord: '<path fill="currentColor" stroke="none" d="M19.3 5.4A16.6 16.6 0 0 0 15.2 4l-.5 1.1a15.4 15.4 0 0 0-5.4 0L8.8 4a16.5 16.5 0 0 0-4.1 1.4C2.1 9.3 1.4 13.1 1.7 16.8a16.7 16.7 0 0 0 5.1 2.6l1.1-1.8c-.6-.2-1.2-.5-1.7-.9l.4-.3a11.9 11.9 0 0 0 10.2 0l.4.3c-.5.4-1.1.7-1.7.9l1.1 1.8a16.6 16.6 0 0 0 5.1-2.6c.4-4.3-.7-8.1-2.6-11.4zM8.7 14.5c-1 0-1.8-.9-1.8-2s.8-2 1.8-2 1.8.9 1.8 2-.8 2-1.8 2zm6.6 0c-1 0-1.8-.9-1.8-2s.8-2 1.8-2 1.8.9 1.8 2-.8 2-1.8 2z"/>',
  };

  function icon(name, cls) {
    return '<svg class="' + (cls || "") + '" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' + (ICONS[name] || "") + "</svg>";
  }

  /* ───── Small utilities ───── */
  const ESC = { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" };
  const esc = (v) => String(v == null ? "" : v).replace(/[&<>"']/g, (c) => ESC[c]);

  const money = (n) => {
    const v = Number(n);
    if (!Number.isFinite(v)) return "—";
    return "$" + v.toFixed(2);
  };

  // Data paths are site-relative ("images/x.webp" or "/images/x.webp"); make them root-absolute.
  const asset = (p) => (/^https?:\/\//.test(p) ? p : "/" + String(p || "").replace(/^\/+/, ""));
  const thumb = (p) => {
    const a = asset(p);
    return /\/images\/opt\/.+\.webp$/.test(a) && !/-640\.webp$/.test(a) ? a.replace(/\.webp$/, "-640.webp") : a;
  };

  const jsonCache = new Map();
  function getJSON(url) {
    if (!jsonCache.has(url)) {
      jsonCache.set(url, fetch(url, { cache: "no-cache" }).then((r) => {
        if (!r.ok) throw new Error(url + " responded " + r.status);
        return r.json();
      }).catch((e) => { jsonCache.delete(url); throw e; }));
    }
    return jsonCache.get(url);
  }
  const products = () => getJSON("/purchase/products.json");

  const minPrice = (p) => {
    const prices = (p.variants || []).map((v) => Number(v.price)).filter(Number.isFinite);
    return prices.length ? Math.min.apply(null, prices) : Number(p.startingPrice) || 0;
  };

  const store = {
    get(key) {
      try { return JSON.parse(localStorage.getItem(key)); } catch (e) { return null; }
    },
    set(key, value) {
      try { localStorage.setItem(key, JSON.stringify(value)); return true; } catch (e) { return false; }
    },
  };

  /* ───── Product card (used by home + shop + related) ───── */
  function productCard(p, opts) {
    opts = opts || {};
    const from = minPrice(p);
    const priceHTML = from === 0
      ? '<span class="price-tag">Free <small>with boosts</small></span>'
      : '<span class="price-tag"><small>from</small>' + money(from) + "</span>";
    const img = p.images && p.images[0];
    return (
      '<a class="p-card" href="/purchase/product.html?id=' + encodeURIComponent(p.id) + '">' +
        '<div class="p-card__media">' +
          (img ? '<img src="' + esc(thumb(img)) + '" alt="" loading="' + (opts.eager ? "eager" : "lazy") + '" decoding="async" width="640" height="360">' : "") +
          (p.category ? '<span class="chip">' + esc(p.category) + "</span>" : "") +
        "</div>" +
        '<div class="p-card__body">' +
          '<h3 class="p-card__title">' + esc(p.title) + "</h3>" +
          '<p class="p-card__desc">' + esc(p.description) + "</p>" +
          '<div class="p-card__foot">' + priceHTML + '<span class="p-card__go">' + icon("arrow") + "</span></div>" +
        "</div>" +
      "</a>"
    );
  }

  /* ───── Toast + clipboard ───── */
  let toastHost;
  function toast(message, type) {
    if (!toastHost) {
      toastHost = document.createElement("div");
      toastHost.className = "toast-host";
      toastHost.setAttribute("role", "status");
      toastHost.setAttribute("aria-live", "polite");
      document.body.appendChild(toastHost);
    }
    const el = document.createElement("div");
    el.className = "toast" + (type === "error" ? " is-error" : "");
    el.innerHTML = icon(type === "error" ? "alert" : "check") + "<span></span>";
    el.lastChild.textContent = message;
    toastHost.appendChild(el);
    setTimeout(() => { el.classList.add("is-leaving"); setTimeout(() => el.remove(), 320); }, 2600);
  }

  async function copy(text, label) {
    try {
      if (navigator.clipboard && window.isSecureContext) {
        await navigator.clipboard.writeText(text);
      } else {
        const ta = document.createElement("textarea");
        ta.value = text;
        ta.setAttribute("readonly", "");
        ta.style.cssText = "position:fixed;opacity:0;top:0;left:0";
        document.body.appendChild(ta);
        ta.select();
        const ok = document.execCommand("copy");
        ta.remove();
        if (!ok) throw new Error("copy failed");
      }
      toast((label || "Text") + " copied");
      return true;
    } catch (e) {
      toast("Couldn't copy. Select and copy it manually.", "error");
      return false;
    }
  }

  /* ───── Lightbox (native <dialog>) ───── */
  let lb;
  function lightbox(sources, start) {
    if (!sources || !sources.length) return;
    if (!lb) {
      lb = document.createElement("dialog");
      lb.className = "lightbox";
      lb.setAttribute("aria-label", "Image viewer");
      lb.innerHTML =
        '<img alt="">' +
        '<button class="lightbox__close" type="button" aria-label="Close">' + icon("close") + "</button>" +
        '<button class="lightbox__nav lightbox__nav--prev" type="button" aria-label="Previous image">' + icon("left") + "</button>" +
        '<button class="lightbox__nav lightbox__nav--next" type="button" aria-label="Next image">' + icon("right") + "</button>" +
        '<div class="lightbox__count"></div>';
      document.body.appendChild(lb);
      lb.addEventListener("click", (e) => {
        if (e.target === lb || e.target.closest(".lightbox__close")) lb.close();
        else if (e.target.closest(".lightbox__nav--prev")) lb._go(-1);
        else if (e.target.closest(".lightbox__nav--next")) lb._go(1);
      });
      lb.addEventListener("keydown", (e) => {
        if (e.key === "ArrowLeft") lb._go(-1);
        if (e.key === "ArrowRight") lb._go(1);
      });
      let sx = null;
      lb.addEventListener("touchstart", (e) => { sx = e.touches[0].clientX; }, { passive: true });
      lb.addEventListener("touchend", (e) => {
        if (sx == null) return;
        const dx = e.changedTouches[0].clientX - sx;
        if (Math.abs(dx) > 40) lb._go(dx < 0 ? 1 : -1);
        sx = null;
      });
      lb.addEventListener("close", () => { document.documentElement.style.overflow = ""; });
    }
    let i = start || 0;
    const multi = sources.length > 1;
    lb.querySelectorAll(".lightbox__nav").forEach((b) => { b.hidden = !multi; });
    lb._go = (d) => {
      i = (i + d + sources.length) % sources.length;
      lb.querySelector("img").src = sources[i];
      lb.querySelector(".lightbox__count").textContent = multi ? i + 1 + " / " + sources.length : "";
    };
    lb._go(0);
    document.documentElement.style.overflow = "hidden";
    lb.showModal();
  }

  /* ───── Layout chrome ───── */
  const NAV = [
    { href: "/explore.html", label: "Shop", match: ["/explore.html", "/purchase/"] },
    { href: "/vouches.html", label: "Vouches" },
    { href: "/status.html", label: "Status" },
    { href: "/faq.html", label: "FAQ" },
    { href: "/contact.html", label: "Contact" },
  ];

  function isCurrent(item) {
    const path = location.pathname.replace(/\/index\.html$/, "/");
    return (item.match || [item.href]).some((m) => (m.endsWith("/") ? path.startsWith(m) : path === m || path === m.replace(/\.html$/, "")));
  }

  function renderNav(host) {
    host.outerHTML =
      '<header class="nav" id="site-nav"><div class="wrap"><nav class="nav__bar" aria-label="Main">' +
        '<a class="brand" href="/"><img src="/images/opt/razor.webp" alt="" width="30" height="30">RAZOR</a>' +
        '<ul class="nav__links" id="nav-links">' +
          NAV.map((n) => '<li><a href="' + n.href + '"' + (isCurrent(n) ? ' aria-current="page"' : "") + ">" + n.label + "</a></li>").join("") +
          '<li class="nav__mobile-cta"><a class="btn btn--discord btn--block" href="' + config.discord + '" target="_blank" rel="noopener">' + icon("discord") + "Join Discord</a></li>" +
        "</ul>" +
        '<a class="btn btn--discord btn--sm nav__cta" href="' + config.discord + '" target="_blank" rel="noopener">' + icon("discord") + "Discord</a>" +
        '<button class="nav__toggle" type="button" aria-label="Open menu" aria-expanded="false" aria-controls="nav-links"><span></span></button>' +
      "</nav></div></header>";

    const nav = document.getElementById("site-nav");
    const toggle = nav.querySelector(".nav__toggle");
    const setOpen = (open) => {
      nav.classList.toggle("is-open", open);
      toggle.setAttribute("aria-expanded", String(open));
      toggle.setAttribute("aria-label", open ? "Close menu" : "Open menu");
    };
    toggle.addEventListener("click", () => setOpen(!nav.classList.contains("is-open")));
    document.addEventListener("click", (e) => { if (!nav.contains(e.target)) setOpen(false); });
    document.addEventListener("keydown", (e) => { if (e.key === "Escape" && nav.classList.contains("is-open")) { setOpen(false); toggle.focus(); } });
    matchMedia("(min-width: 901px)").addEventListener("change", (e) => { if (e.matches) setOpen(false); });

    let ticking = false;
    const onScroll = () => {
      if (ticking) return;
      ticking = true;
      requestAnimationFrame(() => { nav.classList.toggle("is-scrolled", scrollY > 8); ticking = false; });
    };
    addEventListener("scroll", onScroll, { passive: true });
    onScroll();
  }

  function renderFooter(host) {
    host.outerHTML =
      '<footer class="footer"><div class="wrap">' +
        '<div class="footer__inner">' +
          '<div class="footer__brand"><a class="brand" href="/"><img src="/images/opt/razor.webp" alt="" width="30" height="30" loading="lazy">RAZOR</a>' +
          "<p>Spoofers, unban methods and AI aim, delivered and supported through Discord.</p></div>" +
          '<div><h3>Shop</h3><ul><li><a href="/explore.html">All products</a></li><li><a href="/vouches.html">Vouches</a></li><li><a href="/status.html">Status</a></li></ul></div>' +
          '<div><h3>Help</h3><ul><li><a href="/faq.html">FAQ</a></li><li><a href="/contact.html">Contact</a></li><li><a href="/terms.html">Terms of service</a></li><li><a href="' + config.discord + '" target="_blank" rel="noopener">Discord</a></li></ul></div>' +
        "</div>" +
        '<div class="footer__base"><span>© ' + new Date().getFullYear() + " Razor</span><span>Payments in Litecoin, verified by staff in Discord.</span></div>" +
      "</div></footer>";
  }

  function chrome() {
    const skip = document.createElement("a");
    skip.className = "skip-link";
    skip.href = "#main";
    skip.textContent = "Skip to content";
    document.body.prepend(skip);
    const navHost = document.querySelector("[data-site-nav]");
    if (navHost) renderNav(navHost);
    const footHost = document.querySelector("[data-site-footer]");
    if (footHost) renderFooter(footHost);
    document.querySelectorAll("[data-discord]").forEach((a) => { a.href = config.discord; a.target = "_blank"; a.rel = "noopener"; });
  }

  window.Razor = { config, icon, esc, money, asset, thumb, getJSON, products, minPrice, store, productCard, toast, copy, lightbox };

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", chrome);
  else chrome();
})();
