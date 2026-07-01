import { createClient } from "@supabase/supabase-js";
import { getRuntimeConfig } from "./config.js";
import { validateLeadForSupabase, formatLeadErrors } from "./lib/lead-schema.js";

let supabaseClientPromise;

async function getSupabaseClient() {
  if (!supabaseClientPromise) {
    supabaseClientPromise = getRuntimeConfig()
      .then(({ supabaseUrl, supabaseAnonKey }) => {
        if (!supabaseUrl || !supabaseAnonKey) {
          throw new Error("Supabase URL or anon key is missing.");
        }

        return createClient(supabaseUrl, supabaseAnonKey, {
          auth: {
            persistSession: false,
            autoRefreshToken: false,
            detectSessionInUrl: false,
          },
        });
      })
      .catch((error) => {
        supabaseClientPromise = undefined;
        throw error;
      });
  }

  return supabaseClientPromise;
}

export async function insertLead(leadPayload) {
  const validation = validateLeadForSupabase(leadPayload);
  if (!validation.success) {
    throw new Error(formatLeadErrors(validation.errors) || "Lead payload is invalid.");
  }

  const supabase = await getSupabaseClient();
  const { error } = await supabase.from("leads").insert(validation.data);

  if (error) {
    throw new Error(error.message || "Supabase could not save the lead.");
  }

  return { ok: true };
}
