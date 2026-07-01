import { validateLeadForHandoff, formatLeadErrors } from "../../lib/lead-schema.js";

const jsonHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "Content-Type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Content-Type": "application/json",
};

function json(statusCode, payload) {
  return {
    statusCode,
    headers: jsonHeaders,
    body: JSON.stringify(payload),
  };
}

async function parseRequestBody(event) {
  if (!event.body) return {};

  const body = event.isBase64Encoded
    ? Buffer.from(event.body, "base64").toString("utf8")
    : event.body;

  return JSON.parse(body);
}

function getSupabaseRestUrl(tableName, query) {
  const baseUrl = process.env.SUPABASE_URL.replace(/\/$/, "");
  return `${baseUrl}/rest/v1/${tableName}${query ? `?${query}` : ""}`;
}

function getMissingStatusUpdateConfig() {
  return ["SUPABASE_URL", "SUPABASE_SERVICE_ROLE_KEY"].filter((name) => !process.env[name]);
}

async function updateN8nStatus(leadId, n8nStatus, errorMessage) {
  const missingConfig = getMissingStatusUpdateConfig();
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (missingConfig.length > 0) {
    throw new Error(`Missing ${missingConfig.join(", ")} for n8n status updates.`);
  }

  const updatePayload = {
    n8n_status: n8nStatus,
    n8n_last_error: errorMessage || null,
    n8n_delivered_at: n8nStatus === "delivered" ? new Date().toISOString() : null,
    updated_at: new Date().toISOString(),
  };

  const response = await fetch(getSupabaseRestUrl("leads", `lead_id=eq.${encodeURIComponent(leadId)}`), {
    method: "PATCH",
    headers: {
      apikey: serviceKey,
      Authorization: `Bearer ${serviceKey}`,
      "Content-Type": "application/json",
      Prefer: "return=minimal",
    },
    body: JSON.stringify(updatePayload),
  });

  if (!response.ok) {
    const details = await response.text();
    throw new Error(`Supabase status update failed: ${details || response.status}`);
  }
}

async function postToN8n(leadPayload) {
  const response = await fetch(process.env.N8N_WEBHOOK_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json",
    },
    body: JSON.stringify(leadPayload),
  });

  if (!response.ok) {
    const body = await response.text();
    throw new Error(`n8n responded with HTTP ${response.status}${body ? `: ${body.slice(0, 240)}` : ""}`);
  }
}

export const handler = async (event) => {
  if (event.httpMethod === "OPTIONS") {
    return { statusCode: 204, headers: jsonHeaders, body: "" };
  }

  if (event.httpMethod !== "POST") {
    return json(405, { error: "Method not allowed." });
  }

  let leadPayload;
  try {
    leadPayload = await parseRequestBody(event);
  } catch {
    return json(400, { error: "Invalid JSON payload." });
  }

  const validation = validateLeadForHandoff(leadPayload);
  if (!validation.success) {
    return json(400, {
      error: "Invalid lead payload.",
      details: validation.errors,
    });
  }

  leadPayload = validation.data;

  if (!process.env.N8N_WEBHOOK_URL) {
    console.warn("AutoLancer n8n handoff skipped: N8N_WEBHOOK_URL is not configured.");

    return json(200, {
      ok: true,
      n8n_status: "pending",
      warning: "Lead was saved, but the n8n webhook is not configured yet. AutoLancer skipped the AI handoff without losing the lead.",
    });
  }

  try {
    await postToN8n(leadPayload);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown n8n handoff failure.";
    console.error("AutoLancer n8n handoff failed:", message);

    try {
      await updateN8nStatus(leadPayload.lead_id, "failed", message);
    } catch (statusError) {
      const statusMessage = statusError instanceof Error ? statusError.message : "Unknown Supabase status update failure.";
      console.error("AutoLancer n8n status update failed:", statusMessage);

      return json(200, {
        ok: true,
        n8n_status: "pending",
        warning: "Lead was saved, but the n8n handoff failed and AutoLancer could not update the handoff status automatically.",
      });
    }

    return json(200, {
      ok: true,
      n8n_status: "failed",
      warning: "Lead was saved, but the n8n handoff failed and was recorded for follow-up.",
    });
  }

  try {
    await updateN8nStatus(leadPayload.lead_id, "delivered", null);

    return json(200, {
      ok: true,
      n8n_status: "delivered",
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown Supabase status update failure.";
    console.error("AutoLancer delivered status update failed:", message);

    return json(200, {
      ok: true,
      n8n_status: "pending",
      warning: "Lead was saved and sent to n8n, but AutoLancer could not mark the handoff as delivered automatically.",
    });
  }
};
