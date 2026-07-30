import { createClient } from "@supabase/supabase-js";

const url = import.meta.env.VITE_SUPABASE_URL;
const anon = import.meta.env.VITE_SUPABASE_ANON_KEY;

// Login is required only once these two keys are configured. Until then the app
// runs open (no sign-in) so your deployment keeps working before Supabase is set up.
export const authEnabled = Boolean(url && anon);
export const supabase = authEnabled ? createClient(url, anon) : null;
