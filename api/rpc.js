// POST /api/rpc — JSON-RPC passthrough to Helius for the few methods the launcher needs. Env: HELIUS_API_KEY
const ALLOW = new Set(["getLatestBlockhash", "sendTransaction", "getSignatureStatuses", "simulateTransaction", "getAccountInfo", "getMultipleAccountsInfo", "getBalance", "getTokenAccountsByOwner", "getMinimumBalanceForRentExemption", "getFeeForMessage", "getBlockHeight", "getParsedTokenAccountsByOwner", "getEpochInfo", "getSlot", "isBlockhashValid"]);
export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ error: "POST only" });
  const key = process.env.HELIUS_API_KEY;
  if (!key) return res.status(503).json({ error: "HELIUS_API_KEY not set" });
  const body = typeof req.body === "string" ? JSON.parse(req.body || "{}") : req.body || {};
  const calls = Array.isArray(body) ? body : [body];
  if (calls.length > 10 || calls.some((c) => !ALLOW.has(c && c.method))) return res.status(400).json({ error: "method not allowed" });
  try {
    const r = await fetch(`https://mainnet.helius-rpc.com/?api-key=${key}`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
    res.setHeader("content-type", "application/json");
    return res.status(r.status).send(await r.text());
  } catch (e) { return res.status(502).json({ error: String(e.message || e) }); }
}
