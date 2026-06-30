import { getRuntimeConfig } from "./config.js";
import { parseJsonResponse } from "./helpers.js";

function buildSupabaseRestUrl(supabaseUrl, tableName) {
  return `${supabaseUrl.replace(/\/$/, "")}/rest/v1/${tableName}`;
}

export async function insertLead(leadPayload) {
  const { supabaseUrl, supabaseAnonKey } = await getRuntimeConfig();
  const response = await fetch(buildSupabaseRestUrl(supabaseUrl, "leads"), {
    method: "POST",
    headers: {
      apikey: supabaseAnonKey,
      Authorization: `Bearer ${supabaseAnonKey}`,
      "Content-Type": "application/json",
      Prefer: "return=minimal",
    },
    body: JSON.stringify(leadPayload),
  });

  if (!response.ok) {
    const details = await parseJsonResponse(response);
    throw new Error(details.message || details.error || "Supabase could not save the lead.");
  }

  return { ok: true };
}
