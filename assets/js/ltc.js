/* Razor — Litecoin helpers: live USD→LTC rate, payment URI, on-chain transaction check.
   Runs in the browser against public APIs (GitHub Pages has no server).
   Price:  CoinGecko /simple/price, falling back to Coinbase /v2/prices/LTC-USD/spot.
   Chain:  litecoinspace.org Esplora-style API (/api/tx/:txid, /api/blocks/tip/height); amounts in litoshis. */
(function () {
  "use strict";

  const LITOSHI = 1e8;
  const RATE_TTL = 60 * 1000;
  const EXPLORER = "https://litecoinspace.org";
  const RATE_KEY = "razorLtcRate";

  /* ───── Pure helpers (no network) ───── */

  const isTxid = (s) => /^[a-fA-F0-9]{64}$/.test(String(s || "").trim());

  // USD → LTC, rounded UP to 5 decimals so the customer never underpays by rounding.
  function usdToLtc(usd, rate) {
    const u = Number(usd), r = Number(rate);
    if (!(u > 0) || !(r > 0) || !Number.isFinite(u) || !Number.isFinite(r)) return null;
    return Math.ceil((u / r) * 1e5) / 1e5;
  }

  const fmtLtc = (ltc) => (ltc == null ? "—" : Number(ltc).toFixed(5).replace(/0+$/, "").replace(/\.$/, ""));

  function paymentUri(address, ltc) {
    return "litecoin:" + address + (ltc ? "?amount=" + fmtLtc(ltc) : "");
  }

  // Sum of outputs in an Esplora-format tx that pay `address`, in litoshis.
  function litoshisTo(tx, address) {
    if (!tx || !Array.isArray(tx.vout)) return 0;
    return tx.vout.reduce((sum, o) => {
      const v = Number(o && o.value);
      return o && o.scriptpubkey_address === address && Number.isFinite(v) && v > 0 ? sum + v : sum;
    }, 0);
  }

  // Compare what arrived with what was quoted. 2% tolerance covers rate movement between quote and send.
  function judge(paidLtc, expectedLtc) {
    if (!(paidLtc > 0)) return "none";
    if (!(expectedLtc > 0)) return "unknown";
    return paidLtc >= expectedLtc * 0.98 ? "ok" : "short";
  }

  /* ───── Network ───── */

  async function getJSON(url, ms) {
    const ctl = new AbortController();
    const t = setTimeout(() => ctl.abort(), ms || 8000);
    try {
      const r = await fetch(url, { signal: ctl.signal, headers: { Accept: "application/json" } });
      if (r.status === 404) { const e = new Error("not found"); e.code = 404; throw e; }
      if (!r.ok) throw new Error(url + " responded " + r.status);
      const type = r.headers.get("content-type") || "";
      return type.includes("json") ? r.json() : r.text();
    } finally {
      clearTimeout(t);
    }
  }

  function cachedRate() {
    try {
      const c = JSON.parse(sessionStorage.getItem(RATE_KEY));
      return c && c.usd > 0 && Date.now() - c.at < RATE_TTL ? c : null;
    } catch (e) { return null; }
  }

  // Resolves to { usd: number, at: ms, source: string }. Rejects if every source fails.
  async function rate(force) {
    if (!force) { const c = cachedRate(); if (c) return c; }
    const sources = [
      ["CoinGecko", "https://api.coingecko.com/api/v3/simple/price?ids=litecoin&vs_currencies=usd", (j) => j && j.litecoin && j.litecoin.usd],
      ["Coinbase", "https://api.coinbase.com/v2/prices/LTC-USD/spot", (j) => j && j.data && j.data.amount],
    ];
    for (const [source, url, pick] of sources) {
      try {
        const usd = Number(pick(await getJSON(url, 6000)));
        if (usd > 0 && Number.isFinite(usd) && usd < 1e6) {
          const out = { usd, at: Date.now(), source };
          try { sessionStorage.setItem(RATE_KEY, JSON.stringify(out)); } catch (e) {}
          return out;
        }
      } catch (e) { /* try next source */ }
    }
    throw new Error("No price source reachable");
  }

  // Resolves to { status: "notfound" } or
  // { status: "found", toWallet, paidLtc, confirmed, confirmations, blockTime }.
  async function checkTx(txid, address) {
    const id = String(txid || "").trim().toLowerCase();
    if (!isTxid(id)) throw new Error("bad txid");
    let tx;
    try {
      tx = await getJSON(EXPLORER + "/api/tx/" + id);
    } catch (e) {
      if (e.code === 404) return { status: "notfound" };
      throw e;
    }
    if (!tx || typeof tx !== "object" || !Array.isArray(tx.vout)) throw new Error("unexpected response");
    const lits = litoshisTo(tx, address);
    const st = tx.status || {};
    let confirmations = 0;
    if (st.confirmed && Number.isFinite(Number(st.block_height))) {
      try {
        const tip = Number(await getJSON(EXPLORER + "/api/blocks/tip/height", 5000));
        if (Number.isFinite(tip) && tip >= st.block_height) confirmations = tip - st.block_height + 1;
      } catch (e) { confirmations = 1; }
    }
    return {
      status: "found",
      toWallet: lits > 0,
      paidLtc: lits / LITOSHI,
      confirmed: !!st.confirmed,
      confirmations,
      blockTime: st.block_time ? st.block_time * 1000 : null,
    };
  }

  const txUrl = (txid) => EXPLORER + "/tx/" + encodeURIComponent(String(txid || "").trim());

  window.RazorLTC = { isTxid, usdToLtc, fmtLtc, paymentUri, litoshisTo, judge, rate, checkTx, txUrl };
})();
