// GET /api/grave?m=<quote mint> — one dead coin + every StonkFun coin paired against it (top 25 by volume)
const SF = "https://www.stonkfun.xyz/api/public/v1";
const B58 = /^[1-9A-HJ-NP-Za-km-z]{32,44}$/;
export default async function handler(req, res) {
  const m = String(req.query.m || "");
  if (!B58.test(m)) return res.status(400).json({ error: "bad mint" });
  try {
    const [t, d] = await Promise.all([
      fetch(`${SF}/tokens?quoteMint=${m}&sort=volume&pageSize=25`).then((r) => (r.ok ? r.json() : null)).catch(() => null),
      fetch(`https://api.dexscreener.com/tokens/v1/solana/${m}`).then((r) => (r.ok ? r.json() : null)).catch(() => null),
    ]);
    const best = Array.isArray(d) ? d.sort((a, b) => (b.liquidity?.usd || 0) - (a.liquidity?.usd || 0))[0] : null;
    const kids = (t?.data?.tokens || []).map((x) => ({ mint: x.mint, sym: x.symbol, name: x.name, img: x.imageUrl || null, vol: x.market?.volume24hUsd || 0, mcap: x.market?.marketCapUsd || 0, status: x.status, created: x.createdAt }));
    res.setHeader("Cache-Control", "s-maxage=30, stale-while-revalidate=60");
    return res.status(200).json({
      mint: m,
      coin: best ? { name: best.baseToken?.name, sym: best.baseToken?.symbol, mcap: best.marketCap || best.fdv || 0, vol: best.volume?.h24 || 0, ch24: best.priceChange?.h24 ?? null, liq: best.liquidity?.usd || 0, img: best.info?.imageUrl || null, url: best.url } : null,
      revivals: t?.data?.pagination?.total ?? kids.length,
      kids,
    });
  } catch (e) { return res.status(502).json({ error: String(e.message || e) }); }
}
