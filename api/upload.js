// POST /api/upload  { name, symbol, description, image (data URL), twitter?, website? }
// Pins the image and the token metadata JSON to IPFS via Filebase. Env: FILEBASE_IPFS_TOKEN
export const config = { api: { bodyParser: { sizeLimit: "4mb" } } };
async function add(token, filename, buf, type) {
  const fd = new FormData();
  fd.append("file", new Blob([buf], { type }), filename);
  const r = await fetch("https://rpc.filebase.io/api/v0/add?cid-version=1", { method: "POST", headers: { Authorization: `Bearer ${token}` }, body: fd });
  if (!r.ok) throw new Error("ipfs " + r.status);
  const t = await r.text(); const last = t.trim().split("\n").pop();
  return JSON.parse(last).Hash;
}
export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ error: "POST only" });
  const token = process.env.FILEBASE_IPFS_TOKEN;
  if (!token) return res.status(503).json({ error: "FILEBASE_IPFS_TOKEN not set" });
  try {
    const b = typeof req.body === "string" ? JSON.parse(req.body) : req.body || {};
    const name = String(b.name || "").trim().slice(0, 32), symbol = String(b.symbol || "").trim().slice(0, 10);
    if (!name || !symbol) return res.status(400).json({ error: "name and symbol required" });
    const m = /^data:(image\/(png|jpeg|gif|webp));base64,(.+)$/.exec(String(b.image || ""));
    if (!m) return res.status(400).json({ error: "image required (png/jpg/gif/webp)" });
    const buf = Buffer.from(m[3], "base64");
    if (buf.length > 3 * 1024 * 1024) return res.status(400).json({ error: "image over 3 MB" });
    const imgCid = await add(token, "image." + m[2].replace("jpeg", "jpg"), buf, m[1]);
    const image = `https://ipfs.filebase.io/ipfs/${imgCid}`;
    const meta = { name, symbol, description: String(b.description || "").slice(0, 500), image };
    if (b.twitter) meta.twitter = String(b.twitter).slice(0, 200);
    if (b.website) meta.website = String(b.website).slice(0, 200);
    const metaCid = await add(token, "metadata.json", Buffer.from(JSON.stringify(meta)), "application/json");
    return res.status(200).json({ uri: `https://ipfs.filebase.io/ipfs/${metaCid}`, image });
  } catch (e) { return res.status(502).json({ error: String(e.message || e) }); }
}
