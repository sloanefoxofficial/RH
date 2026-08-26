// Sends real push notifications — used for admin broadcasts, coordinator
// (Juan) replies, and alerting admins when a member sends a new message.
// Requires web-push as a dependency (see package.json) and three env vars in
// Vercel: VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY, SUPABASE_SERVICE_ROLE_KEY
// (plus the existing VITE_SUPABASE_URL).
//
// The service role key is required here — it's the only way to read EVERY
// member's push subscriptions at once for a broadcast, bypassing the
// own-row-only RLS policy that (correctly) applies to normal user requests.
// It must never be exposed to the browser — used server-side only, exactly
// like ANTHROPIC_API_KEY and the other secret keys.

import webpush from "web-push";
import { createClient } from "@supabase/supabase-js";

// Keep this in sync with ADMIN_EMAILS in App.jsx — it's the same list, just
// needed here too so a member's message can be pushed to whoever's an admin.
const ADMIN_EMAILS = ["sloanefox.official@gmail.com", "lisamaree1663@gmail.com"];

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
    const { userId, broadcast, toAdmins, title, body: message, url, target } = body;
    if (!title) { res.status(400).json({ error: "Missing title" }); return; }

    // Every subscribed member (broadcast), one specific person (a coordinator
    // reply), or every admin account (a member's new message to Juan/coordinator)
    let query = supabase.from("push_subscriptions").select("id,endpoint,p256dh,auth,user_id");
    if (toAdmins) {
      // Prefer profile matches, but also resolve the admin accounts through Auth.
      // A profile row can be missing or delayed after sign-up; without this fallback
      // the endpoint would silently find zero subscriptions and send no alert.
      const { data: profileAdmins, error: profileErr } = await supabase
        .from("profiles").select("id").in("email", ADMIN_EMAILS);
      if (profileErr) throw profileErr;

      const { data: authData, error: authErr } = await supabase.auth.admin.listUsers({ page: 1, perPage: 1000 });
      if (authErr) throw authErr;
      const adminEmails = new Set(ADMIN_EMAILS.map((email) => String(email).trim().toLowerCase()));
      const authAdminIds = (authData?.users || [])
        .filter((user) => adminEmails.has(String(user.email || "").trim().toLowerCase()))
        .map((user) => user.id);
      const ids = [...new Set([...(profileAdmins || []).map((admin) => admin.id), ...authAdminIds])];

      if (!ids.length) { res.status(200).json({ sent: 0, removed: 0, total: 0 }); return; }
      query = query.in("user_id", ids);
    } else if (!broadcast) {
      if (!userId) { res.status(400).json({ error: "Missing userId" }); return; }
      query = query.eq("user_id", userId);
    }
    const { data: subs, error } = await query;
    if (error) throw error;

    const payload = JSON.stringify({ title, body: message || "", url: url || "/", target: target || null });
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
