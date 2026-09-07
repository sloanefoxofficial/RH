import { createClient } from "@supabase/supabase-js";

const url = import.meta.env.VITE_SUPABASE_URL;
const anon = import.meta.env.VITE_SUPABASE_ANON_KEY;

// Login is required only once these two keys are configured. Until then the app
// runs open (no sign-in) so your deployment keeps working before Supabase is set up.
export const authEnabled = Boolean(url && anon);

const STAY_LOGGED_IN_KEY = "rh_stay_logged_in";
const authKey = (key) => key.includes("auth-token");
const readPreference = () => {
  try {
    const raw = localStorage.getItem(STAY_LOGGED_IN_KEY);
    return raw === null ? true : JSON.parse(raw) !== false;
  } catch { return true; }
};

let persistAuth = readPreference();
const storageFor = () => persistAuth ? window.localStorage : window.sessionStorage;

// Supabase's auth storage is deliberately dynamic: the preference can change
// after the client has been created, without storing the password anywhere.
const authStorage = {
  getItem: (key) => storageFor().getItem(key),
  setItem: (key, value) => storageFor().setItem(key, value),
  removeItem: (key) => storageFor().removeItem(key),
};

function moveAuthToken(from, to) {
  try {
    for (let i = 0; i < from.length; i += 1) {
      const key = from.key(i);
      if (!key || !authKey(key)) continue;
      const value = from.getItem(key);
      if (value !== null) to.setItem(key, value);
      from.removeItem(key);
    }
  } catch {}
}

// If a returning user changes devices or has a stored preference from an older
// build, put the existing Supabase token in the selected storage before auth
// bootstrap reads it.
try {
  if (persistAuth) moveAuthToken(window.sessionStorage, window.localStorage);
  else moveAuthToken(window.localStorage, window.sessionStorage);
} catch {}

export function setAuthSessionPersistence(shouldPersist) {
  persistAuth = Boolean(shouldPersist);
  try {
    localStorage.setItem(STAY_LOGGED_IN_KEY, JSON.stringify(persistAuth));
    if (persistAuth) moveAuthToken(window.sessionStorage, window.localStorage);
    else moveAuthToken(window.localStorage, window.sessionStorage);
  } catch {}
}

export const supabase = authEnabled ? createClient(url, anon, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
    storage: authStorage,
  },
}) : null;
