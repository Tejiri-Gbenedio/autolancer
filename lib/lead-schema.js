const LEAD_ID_PREFIX = "lead";

// Enumerations are centralized here so the UI, API layer, Supabase inserts,
// n8n handoff, and future admin tools all speak the same language.
export const LEAD_ENUMS = Object.freeze({
  project_type: Object.freeze(["automation", "web_development", "chatbot", "integration", "other"]),
  budget_range: Object.freeze(["under_500", "500_1000", "1000_3000", "3000_plus"]),
  timeline: Object.freeze(["1_week", "2_weeks", "1_month", "flexible"]),
  source: Object.freeze(["linkedin", "referral", "twitter", "google", "other", "unknown"]),
  status: Object.freeze(["new", "qualified", "proposal_pending", "proposal_sent", "accepted", "invoiced", "paid", "archived"]),
  n8n_status: Object.freeze(["pending", "delivered", "failed"]),
});

// This is the canonical contract for every lead entering AutoLancer.
// Keep database columns, UI inputs, n8n workflows, and AI pipeline fields aligned
// by changing rules here first, then adapting downstream systems.
export const LEAD_FIELD_DEFINITIONS = Object.freeze({
  lead_id: { required: true, type: "string", min: 12, max: 80 },
  created_at: { required: true, type: "datetime" },
  updated_at: { required: true, type: "datetime" },

  full_name: { required: true, type: "string", min: 2, max: 160 },
  email: { required: true, type: "email", min: 5, max: 254 },
  phone: { required: false, type: "phone", min: 7, max: 32 },

  project_type: { required: true, type: "enum", enum: "project_type" },
  budget_range: { required: true, type: "enum", enum: "budget_range" },
  timeline: { required: true, type: "enum", enum: "timeline" },
  source: { required: false, type: "enum", enum: "source", defaultValue: "unknown" },

  description: { required: true, type: "string", min: 20, max: 5000, multiline: true },
  existing_tools: { required: false, type: "string", max: 1000 },
  website_url: { required: false, type: "url", max: 2048 },

  intake_channel: { required: true, type: "string", min: 3, max: 80, defaultValue: "web_form" },
  status: { required: true, type: "enum", enum: "status", defaultValue: "new" },
  n8n_status: { required: true, type: "enum", enum: "n8n_status", defaultValue: "pending" },

  // Future-facing fields are intentionally part of the contract now. They let
  // AutoLancer add uploads, AI enrichment, payments, and authentication without
  // replacing the validation architecture.
  file_uploads: { required: false, type: "array", defaultValue: null },
  ai_score: { required: false, type: "number", min: 0, max: 100 },
  ai_summary: { required: false, type: "string", max: 5000, multiline: true },
  proposal_id: { required: false, type: "string", max: 120 },
  invoice_id: { required: false, type: "string", max: 120 },
  payment_status: { required: false, type: "string", max: 80 },
  user_id: { required: false, type: "string", max: 120 },
});

// Only these fields should be inserted into the current leads table. Future
// fields remain validated by the contract, but should not be sent to Supabase
// until corresponding columns or related tables exist.
export const CURRENT_LEADS_TABLE_FIELDS = Object.freeze([
  "lead_id",
  "created_at",
  "updated_at",
  "full_name",
  "email",
  "phone",
  "project_type",
  "budget_range",
  "timeline",
  "source",
  "description",
  "existing_tools",
  "website_url",
  "intake_channel",
  "status",
  "n8n_status",
]);

export function createLeadId(date = new Date()) {
  const stamp = date.toISOString().replace(/[-:TZ.]/g, "").slice(0, 14);
  const randomPart =
    globalThis.crypto && globalThis.crypto.randomUUID
      ? globalThis.crypto.randomUUID().split("-")[0]
      : Math.random().toString(36).slice(2, 10);

  return `${LEAD_ID_PREFIX}_${stamp}_${randomPart}`;
}

export function isEmptyValue(value) {
  return value === undefined || value === null || (typeof value === "string" && value.trim() === "");
}

export function normalizeSpaces(value) {
  if (typeof value !== "string") return value;
  return value.trim().replace(/\s+/g, " ");
}

export function normalizeLongText(value) {
  if (typeof value !== "string") return value;
  return value.trim().replace(/\r\n/g, "\n").replace(/[ \t]+/g, " ");
}

export function normalizeNullableString(value, options = {}) {
  if (isEmptyValue(value)) return null;

  const normalized = options.multiline ? normalizeLongText(String(value)) : normalizeSpaces(String(value));
  const finalValue = options.lowercase ? normalized.toLowerCase() : normalized;

  return finalValue === "" ? null : finalValue;
}

export function normalizeEmail(value) {
  return normalizeNullableString(value, { lowercase: true });
}

export function isValidEmail(value) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(String(value || "").trim());
}

export function normalizePhone(value) {
  if (isEmptyValue(value)) return null;

  const trimmed = String(value).trim();
  const hasLeadingPlus = trimmed.startsWith("+");
  const digits = trimmed.replace(/[^\d]/g, "");

  if (!digits) return null;
  return `${hasLeadingPlus ? "+" : ""}${digits}`;
}

export function isValidPhone(value) {
  if (isEmptyValue(value)) return true;
  return /^\+?[1-9]\d{6,14}$/.test(normalizePhone(value) || "");
}

export function normalizeUrl(value) {
  if (isEmptyValue(value)) return null;

  const raw = normalizeSpaces(String(value));
  const withProtocol = /^https?:\/\//i.test(raw) ? raw : `https://${raw}`;

  try {
    const url = new URL(withProtocol);
    if (!["http:", "https:"].includes(url.protocol)) return null;
    return url.toString();
  } catch {
    return null;
  }
}

export function isValidUrl(value) {
  if (isEmptyValue(value)) return true;
  return Boolean(normalizeUrl(value));
}

export function isAllowedEnum(enumName, value) {
  const allowedValues = LEAD_ENUMS[enumName];
  return Boolean(allowedValues && allowedValues.includes(value));
}

function addError(errors, field, message) {
  errors.push({ field, message });
}

function normalizeField(fieldName, value, definition) {
  if (definition.type === "email") return normalizeEmail(value);
  if (definition.type === "phone") return normalizePhone(value);
  if (definition.type === "url") return normalizeUrl(value);
  if (definition.type === "number") return isEmptyValue(value) ? null : Number(value);
  if (definition.type === "array") return Array.isArray(value) ? value : null;
  if (definition.type === "string" || definition.type === "enum" || definition.type === "datetime") {
    return normalizeNullableString(value, { multiline: definition.multiline });
  }

  return isEmptyValue(value) ? null : value;
}

function validateLength(fieldName, value, definition, errors) {
  if (typeof value !== "string") return;

  if (definition.min !== undefined && value.length < definition.min) {
    addError(errors, fieldName, `Must be at least ${definition.min} characters.`);
  }

  if (definition.max !== undefined && value.length > definition.max) {
    addError(errors, fieldName, `Must be ${definition.max} characters or fewer.`);
  }
}

function validateField(fieldName, value, definition, errors) {
  if (definition.required && isEmptyValue(value)) {
    addError(errors, fieldName, "This field is required.");
    return;
  }

  if (isEmptyValue(value)) return;

  validateLength(fieldName, value, definition, errors);

  if (definition.type === "email" && !isValidEmail(value)) {
    addError(errors, fieldName, "Must be a valid email address.");
  }

  if (definition.type === "phone" && !isValidPhone(value)) {
    addError(errors, fieldName, "Must be a valid phone number.");
  }

  if (definition.type === "url" && !isValidUrl(value)) {
    addError(errors, fieldName, "Must be a valid URL.");
  }

  if (definition.type === "enum" && !isAllowedEnum(definition.enum, value)) {
    addError(errors, fieldName, `Must be one of: ${LEAD_ENUMS[definition.enum].join(", ")}.`);
  }

  if (definition.type === "datetime" && Number.isNaN(Date.parse(value))) {
    addError(errors, fieldName, "Must be a valid ISO datetime.");
  }

  if (definition.type === "number") {
    if (!Number.isFinite(value)) {
      addError(errors, fieldName, "Must be a valid number.");
      return;
    }

    if (definition.min !== undefined && value < definition.min) {
      addError(errors, fieldName, `Must be at least ${definition.min}.`);
    }

    if (definition.max !== undefined && value > definition.max) {
      addError(errors, fieldName, `Must be no more than ${definition.max}.`);
    }
  }
}

export function normalizeLeadInput(input = {}, options = {}) {
  const now = options.now || new Date().toISOString();
  const raw = { ...input };
  const normalized = {};

  for (const [fieldName, definition] of Object.entries(LEAD_FIELD_DEFINITIONS)) {
    let rawValue = raw[fieldName];

    if (rawValue === undefined) {
      if (fieldName === "lead_id") rawValue = createLeadId();
      if (fieldName === "created_at" || fieldName === "updated_at") rawValue = now;
      if (rawValue === undefined && "defaultValue" in definition) rawValue = definition.defaultValue;
    }

    normalized[fieldName] = normalizeField(fieldName, rawValue, definition);
  }

  normalized.source = normalized.source || "unknown";
  normalized.status = normalized.status || "new";
  normalized.n8n_status = normalized.n8n_status || "pending";
  normalized.intake_channel = normalized.intake_channel || "web_form";

  return normalized;
}

export function validateLead(input = {}, options = {}) {
  const data = normalizeLeadInput(input, options);
  const errors = [];

  for (const [fieldName, definition] of Object.entries(LEAD_FIELD_DEFINITIONS)) {
    validateField(fieldName, data[fieldName], definition, errors);
  }

  return {
    success: errors.length === 0,
    data: errors.length === 0 ? data : null,
    errors,
  };
}

export function pickLeadFields(lead, fields = CURRENT_LEADS_TABLE_FIELDS) {
  return fields.reduce((payload, field) => {
    payload[field] = lead[field] ?? null;
    return payload;
  }, {});
}

export function validateLeadForSupabase(input = {}, options = {}) {
  const result = validateLead(input, options);
  if (!result.success) return result;

  return {
    success: true,
    data: pickLeadFields(result.data),
    errors: [],
  };
}

export function validateLeadForHandoff(input = {}, options = {}) {
  const result = validateLead(input, options);
  if (!result.success) return result;

  return {
    success: true,
    data: pickLeadFields(result.data),
    errors: [],
  };
}

export function formatLeadErrors(errors = []) {
  return errors.map((error) => `${error.field}: ${error.message}`).join(" ");
}
