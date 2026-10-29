// GET /api/graveyard — every custom coin StonkFun lets you pair against, ranked by how dead it is
// (24h volume ÷ market cap, from DexScreener), with how many StonkFun coins already pair against it.
// No env vars. Cached at the edge for 5 minutes.
const SF = "https://www.stonkfun.xyz/api/public/v1";
// majors / live infra that are quotes but not "dead coins"
const SKIP = new Set(["STONK", "STONKS", "JUP", "Bonk", "PUMP", "TRUMP", "cbBTC", "xBTC", "WBTC", "WETH", "WBNB", "wXRP", "ZEC", "HYPE", "NEAR", "UNI", "RAY", "MET", "META", "JTO", "PYTH", "VIRTUAL", "ai16z", "GOLD", "USDUC", "SOL", "USDC", "USDT", "PENGU", "BP", "SPX", "Fartcoin", "USELESS", "POPCAT", "$WIF", "SUI", "GRASS", "HSOL", "MNDE", "JitoSOL", "mSOL", "bSOL", "INF", "W", "ORCA", "DRIFT", "KMNO", "TNSR", "CLOUD"]);
const BAD = /nigg|fag|retard|kike|chink|nazi|hitler|rape|pedo|cp\b/i;

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
async function j(url, tries = 2) {
  for (let i = 0; i <= tries; i++) {
    try { const r = await fetch(url, { headers: { accept: "application/json" } }); if (r.ok) return await r.json(); if (r.status === 429) await sleep(800); } catch (e) { await sleep(300); }
  }
  return null;
}
async function pool(items, n, fn) { const out = new Array(items.length); let i = 0; await Promise.all(Array.from({ length: n }, async () => { while (i < items.length) { const k = i++; out[k] = await fn(items[k], k); } })); return out; }

export default async function handler(req, res) {
  try {
    const pj = await j(`${SF}/pairs?launchable=true&launchLabReady=true&category=custom`);
    if (!pj) return res.status(502).json({ error: "pairs unavailable" });
    const pairs = (pj.data?.pairs || []).filter((p) => !SKIP.has(p.symbol) && !BAD.test(p.symbol + " " + (p.name || "")));
    // DexScreener stats, 30 per call
    const stats = {};
    const chunks = []; for (let i = 0; i < pairs.length; i += 30) chunks.push(pairs.slice(i, i + 30));
    await pool(chunks, 4, async (c) => {
      const d = await j("https://api.dexscreener.com/tokens/v1/solana/" + c.map((p) => p.mint).join(","));
      if (!Array.isArray(d)) return;
      for (const p of d) {
        const m = p.baseToken?.address; if (!m) continue;
        const liq = p.liquidity?.usd || 0;
        if (stats[m] && stats[m].liq >= liq) continue;
        stats[m] = { liq, mcap: p.marketCap || p.fdv || 0, vol: p.volume?.h24 || 0, ch24: p.priceChange?.h24 ?? null, img: p.info?.imageUrl || null, name: p.baseToken.name, sym: p.baseToken.symbol, created: p.pairCreatedAt || null };
      }
    });
    let rows = pairs.map((p) => {
      const s = stats[p.mint] || {};
      return { mint: p.mint, sym: p.symbol, name: s.name || p.name || p.symbol, decimals: p.decimals, logo: p.logoUrl ? "https://www.stonkfun.xyz" + p.logoUrl : s.img, img: s.img || null,
        mcap: s.mcap || 0, vol: s.vol || 0, liq: s.liq || 0, ch24: s.ch24, born: s.created };
    }).filter((r) => r.mcap > 2000 && r.mcap < 25e6);
    // deadness: lower 24h turnover = deader. ties broken by smaller mcap.
    rows.forEach((r) => { r.turnover = r.mcap ? r.vol / r.mcap : 0; });
    rows.sort((a, b) => a.turnover - b.turnover || a.mcap - b.mcap);
    rows = rows.slice(0, 64);
    // revivals already paired against each corpse (StonkFun tokens with this quote)
    await pool(rows, 8, async (r) => {
      const t = await j(`${SF}/tokens?quoteMint=${r.mint}&sort=volume&pageSize=3`);
      const tk = t?.data?.tokens || [];
      r.revivals = t?.data?.pagination?.total ?? tk.length;
      r.revVol = tk.reduce((s, x) => s + (x.market?.volume24hUsd || 0), 0);
      r.top = tk.slice(0, 3).map((x) => ({ mint: x.mint, sym: x.symbol, name: x.name, img: x.imageUrl || null, vol: x.market?.volume24hUsd || 0, mcap: x.market?.marketCapUsd || 0 }));
    });
    res.setHeader("Cache-Control", "s-maxage=300, stale-while-revalidate=600");
    return res.status(200).json({ at: Date.now(), quotes: pairs.length, rows });
  } catch (e) {
    return res.status(502).json({ error: String(e.message || e) });
  }
}
