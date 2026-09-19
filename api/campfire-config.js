export default function handler(req, res) {
  if (req.method !== "GET") {
    res.status(405).json({ error: "Method not allowed" });
    return;
  }
  const url = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL || "";
  const anonKey = process.env.VITE_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY || "";
  if (!url || !anonKey) {
    res.status(503).json({ error: "Campfire calling is not configured yet." });
    return;
  }
  res.setHeader("Cache-Control", "no-store");
  res.status(200).json({ url, anonKey });
}
