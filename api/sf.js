// GET /api/sf?p=pairs|pricing&quoteMint=... — thin proxy to StonkFun's public launch reads (avoids CORS)
const SF = "https://www.stonkfun.xyz/api/public/v1";
const B58 = /^[1-9A-HJ-NP-Za-km-z]{32,44}$/;
export default async function handler(req, res) {
  const p = String(req.query.p || "");
  let url;
  if (p === "pairs") url = `${SF}/pairs?launchable=true&launchLabReady=true`;
  else if (p === "pricing" && B58.test(String(req.query.quoteMint || ""))) url = `${SF}/launchlab/pricing?quoteMint=${req.query.quoteMint}`;
  else if (p === "token" && B58.test(String(req.query.mint || ""))) url = `${SF}/tokens/${req.query.mint}`;
  else return res.status(400).json({ error: "bad request" });
  try {
    const r = await fetch(url); const body = await r.text();
    res.setHeader("Cache-Control", p === "pairs" ? "s-maxage=120" : "no-store");
    res.setHeader("content-type", "application/json");
    return res.status(r.status).send(body);
  } catch (e) { return res.status(502).json({ error: String(e.message || e) }); }
}
