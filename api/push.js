// Sends real push notifications — used for admin broadcasts and coordinator
// (Juan) replies. Requires web-push as a dependency (see package.json) and
// three env vars in Vercel: VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY,
// SUPABASE_SERVICE_ROLE_KEY (plus the existing VITE_SUPABASE_URL).
//
// The service role key is required here — it's the only way to read EVERY
// member's push subscriptions at once for a broadcast, bypassing the
// own-row-only RLS policy that (correctly) applies to normal user requests.
// It must never be exposed to the browser — used server-side only, exactly
// like ANTHROPIC_API_KEY and the other secret keys.

import webpush from "web-push";
import { createClient } from "@supabase/supabase-js";

export default async function handler(req, res) {
  if (req.method !== "POST") {
    res.status(405).json({ error: "Method not allowed" });
    return;
  }

  const { VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY, SUPABASE_SERVICE_ROLE_KEY, VITE_SUPABASE_URL } = process.env;
  if (!VAPID_PUBLIC_KEY || !VAPID_PRIVATE_KEY || !SUPABASE_SERVICE_ROLE_KEY || !VITE_SUPABASE_URL) {
    res.status(500).json({ error: "Push isn't fully configured yet — missing env vars." });
    return;
  }

  webpush.setVapidDetails("mailto:sloanefox.official@gmail.com", VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY);
  const supabase = createClient(VITE_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

  try {
    const body = typeof req.body === "string" ? JSON.parse(req.body || "{}") : req.body || {};
    const { userId, broadcast, title, body: message, url } = body;
    if (!title) { res.status(400).json({ error: "Missing title" }); return; }

    // Either every subscribed member (broadcast) or one specific person (a coordinator reply)
    let query = supabase.from("push_subscriptions").select("id,endpoint,p256dh,auth,user_id");
    if (!broadcast) {
      if (!userId) { res.status(400).json({ error: "Missing userId" }); return; }
      query = query.eq("user_id", userId);
    }
    const { data: subs, error } = await query;
    if (error) throw error;

    const payload = JSON.stringify({ title, body: message || "", url: url || "/" });
    let sent = 0, removed = 0;

    await Promise.all((subs || []).map(async (s) => {
      try {
        await webpush.sendNotification(
          { endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } },
          payload
        );
        sent++;
      } catch (e) {
        // 404/410 = the subscription is dead (uninstalled, permission revoked,
        // etc.) — clean it up so it stops being retried forever.
        if (e && (e.statusCode === 404 || e.statusCode === 410)) {
          try { await supabase.from("push_subscriptions").delete().eq("id", s.id); removed++; } catch {}
        }
      }
    }));

    res.status(200).json({ sent, removed, total: (subs || []).length });
  } catch (e) {
    res.status(500).json({ error: (e && e.message) ? e.message : "Failed to send push notifications." });
  }
}
