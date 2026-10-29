// GET /api/recent — newest StonkFun coins paired against a custom (non-major) coin = the latest revivals
const SF = "https://www.stonkfun.xyz/api/public/v1";
const MAJOR = new Set(["STONK", "SOL", "USDC", "USDT", "WBTC", "WETH", "cbBTC", "xBTC", "JUP", "Bonk", "PUMP", "TRUMP", "HYPE", "ZEC", "NEAR", "UNI", "RAY", "WBNB", "wXRP"]);
const BAD = /nigg|fag|retard|kike|chink|nazi|hitler|rape|pedo/i;
export default async function handler(req, res) {
  try {
    const pages = await Promise.all([1, 2, 3].map((p) => fetch(`${SF}/tokens?category=custom&sort=newest&pageSize=100&page=${p}`).then((r) => (r.ok ? r.json() : null)).catch(() => null)));
    const all = pages.flatMap((x) => x?.data?.tokens || []);
    const rows = all.filter((x) => x.quote && !MAJOR.has(x.quote.symbol) && !BAD.test(`${x.name} ${x.symbol} ${x.quote.symbol}`))
      .slice(0, 40)
      .map((x) => ({ mint: x.mint, sym: x.symbol, name: x.name, img: x.imageUrl || null, quote: { mint: x.quote.mint, sym: x.quote.symbol }, vol: x.market?.volume24hUsd || 0, mcap: x.market?.marketCapUsd || 0, created: x.createdAt }));
    res.setHeader("Cache-Control", "s-maxage=20, stale-while-revalidate=40");
    return res.status(200).json({ at: Date.now(), rows });
  } catch (e) { return res.status(502).json({ error: String(e.message || e) }); }
}
