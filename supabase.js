import { createClient } from "@supabase/supabase-js";
import { getRuntimeConfig } from "./config.js";
import { validateLeadForSupabase, formatLeadErrors } from "./lib/lead-schema.js";

// AutoLancer is currently a plain static Netlify app, not Vite or Next.js.
// Browser modules cannot safely read process.env or local .env files directly,
// so Netlify Functions expose only the public Supabase URL and anon/publishable key.
const { supabaseUrl, supabaseAnonKey } = await getRuntimeConfig();

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error("Supabase URL or anon key is missing.");
}

// Canonical Supabase client for all frontend code.
// Never use SUPABASE_SERVICE_ROLE_KEY here. Service role keys bypass RLS and
// must stay server-side in Netlify Functions only.
export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    persistSession: false,
    autoRefreshToken: false,
    detectSessionInUrl: false,
  },
});

// Inserts the lead through supabase-js so RLS, table constraints, and API errors
// are handled by the official client instead of manual REST fetch calls.
export async function insertLead(leadPayload) {
  const validation = validateLeadForSupabase(leadPayload);
  if (!validation.success) {
    throw new Error(formatLeadErrors(validation.errors) || "Lead payload is invalid.");
  }

  const { error } = await supabase.from("leads").insert(validation.data);

  if (error) {
    throw new Error(error.message || "Supabase could not save the lead.");
  }

  return { ok: true };
}
