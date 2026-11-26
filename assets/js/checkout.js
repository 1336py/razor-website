/* Razor — order state shared by checkout, payment and order pages.
   The order lives in localStorage ("razorOrder", same key as before) and is mirrored
   in the URL so the flow still works in private windows or after storage is cleared. */
(function () {
  "use strict";
  const R = window.Razor;
  const ALPHABET = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";
  const MAX_AGE = 24 * 60 * 60 * 1000;
  const HISTORY_KEY = "razorOrders";
  const HISTORY_MAX = 25;

  function newOrderId() {
    const bytes = new Uint8Array(6);
    (window.crypto || window.msCrypto).getRandomValues(bytes);
    return "RZR-" + Array.from(bytes, (b) => ALPHABET[b % ALPHABET.length]).join("");
  }

  const validId = (s) => /^RZR-[A-Z0-9]{5,8}$/.test(String(s || ""));
  const cleanCoupon = (c) => {
    const code = String(c || "").trim().toUpperCase();
    return R.config.coupons.includes(code) ? code : "";
  };

  function pickVariant(product, raw) {
    const list = product.variants || [];
    if (!list.length) return { index: -1, name: "Default", price: Number(product.startingPrice) || 0 };
    let i = /^\d+$/.test(String(raw)) ? parseInt(raw, 10) : list.findIndex((v) => v.name === raw); // index, or legacy name
    if (!(i >= 0 && i < list.length)) i = 0;
    return { index: i, name: list[i].name, price: Number(list[i].price) };
  }

  function build(product, variantRaw, couponRaw, id) {
    const v = pickVariant(product, variantRaw);
    return {
      id: validId(id) ? id : newOrderId(),
      productId: product.id,
      product: product.title,
      variant: v.name,
      variantIndex: v.index,
      price: v.price,
      coupon: cleanCoupon(couponRaw),
      createdAt: Date.now(),
    };
  }

  /* ───── Order history (this device only) ───── */
  function history() {
    const list = R.store.get(HISTORY_KEY);
    return Array.isArray(list) ? list.filter((o) => o && validId(o.id)).sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0)) : [];
  }

  // Insert or merge an order into history and make it the current order.
  function save(order) {
    const list = history();
    const i = list.findIndex((o) => o.id === order.id);
    const merged = i >= 0 ? Object.assign({}, list[i], order) : order;
    if (i >= 0) list[i] = merged; else list.unshift(merged);
    R.store.set(HISTORY_KEY, list.slice(0, HISTORY_MAX));
    R.store.set(R.config.orderKey, merged);
    return merged;
  }

  // Merge fields into a saved order (e.g. txid, payment check, LTC quote).
  function patch(id, fields) {
    const found = history().find((o) => o.id === id) || (R.store.get(R.config.orderKey) || {});
    if (found.id !== id) return null;
    return save(Object.assign({}, found, fields, { updatedAt: Date.now() }));
  }

  function remove(id) {
    R.store.set(HISTORY_KEY, history().filter((o) => o.id !== id));
    const cur = R.store.get(R.config.orderKey);
    if (cur && cur.id === id) { try { localStorage.removeItem(R.config.orderKey); } catch (e) {} }
  }

  function query(order) {
    const q = new URLSearchParams({ order: order.id, p: order.productId, v: String(order.variantIndex) });
    if (order.coupon) q.set("c", order.coupon);
    return q.toString();
  }

  // checkout.html: create (or reuse) an order from ?id=&variant=&coupon=
  async function createFromURL() {
    const q = new URLSearchParams(location.search);
    const all = await R.products();
    const product = all.find((p) => p.id === q.get("id"));
    if (!product) return null;
    const draft = build(product, q.get("variant"), q.get("coupon"));
    const prev = R.store.get(R.config.orderKey);
    const reuse = prev && validId(prev.id) && prev.productId === draft.productId &&
      prev.variantIndex === draft.variantIndex && (prev.coupon || "") === draft.coupon &&
      Date.now() - (prev.createdAt || 0) < MAX_AGE && !prev.txid; // a paid order is never reused
    const order = reuse ? Object.assign({}, prev, draft, { id: prev.id, createdAt: prev.createdAt }) : draft;
    return save(order);
  }

  // payment.html / order.html: read the order back
  async function current() {
    const q = new URLSearchParams(location.search);
    const urlId = q.get("order");
    const saved = R.store.get(R.config.orderKey);
    if (saved && validId(saved.id) && (!urlId || urlId === saved.id) && saved.product) return saved;
    const past = validId(urlId) && history().find((o) => o.id === urlId);
    if (past) return save(past);
    if (validId(urlId) && q.get("p")) {
      const all = await R.products();
      const product = all.find((p) => p.id === q.get("p"));
      if (product) {
        return save(build(product, q.get("v"), q.get("c"), urlId));
      }
    }
    return null;
  }

  function steps(currentStep) {
    const names = ["Review", "Pay", "Confirm"];
    return '<ol class="steps-bar" aria-label="Checkout progress">' + names.map((n, i) => {
      const cls = i < currentStep ? "is-done" : i === currentStep ? "is-current" : "";
      return '<li class="' + cls + '"' + (i === currentStep ? ' aria-current="step"' : "") + ">" + n + "</li>";
    }).join("") + "</ol>";
  }

  function summary(order, opts) {
    opts = opts || {};
    const row = (k, v, cls) => '<div class="summary__row ' + (cls || "") + '"><dt>' + k + "</dt><dd>" + v + "</dd></div>";
    return '<dl class="summary">' +
      row("Order ID", '<span class="mono">' + R.esc(order.id) + "</span>") +
      row("Product", R.esc(order.product)) +
      row("Plan", R.esc(order.variant || "Default")) +
      (order.coupon ? row("Discount code", R.esc(order.coupon) + ' <small style="color:var(--muted);font-weight:600">applied at verification</small>') : "") +
      (opts.noTotal ? "" : row("Amount", order.price === 0 ? "Free" : R.money(order.price), "summary__row--total")) +
      "</dl>";
  }

  function missing() {
    return '<div class="panel empty-state"><h2>No active order found</h2><p>Your order details weren\'t found on this device. Start again from the shop. It only takes a minute.</p><a class="btn btn--primary" href="/explore.html">Go to the shop</a></div>';
  }

  window.RazorCheckout = { createFromURL, current, query, steps, summary, missing, history, save, patch, remove };
})();
