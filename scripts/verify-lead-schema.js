import { validateLead, validateLeadForSupabase } from "../lib/lead-schema.js";

const validLead = validateLeadForSupabase({
  full_name: "  Jane   Doe  ",
  email: "  JANE@Company.com ",
  project_type: "automation",
  budget_range: "1000_3000",
  timeline: "2_weeks",
  source: "",
  description: "  I need an automated onboarding workflow that qualifies leads and prepares proposals.  ",
  existing_tools: "",
  intake_channel: "web_form",
  status: "new",
  n8n_status: "pending",
});

if (!validLead.success) {
  console.error("Expected valid lead to pass:", validLead.errors);
  process.exit(1);
}

if (validLead.data.email !== "jane@company.com") {
  console.error("Expected email normalization to lowercase and trim.");
  process.exit(1);
}

if (validLead.data.source !== "unknown" || validLead.data.existing_tools !== null) {
  console.error("Expected empty optional fields to normalize to safe defaults/null.");
  process.exit(1);
}

const invalidLead = validateLead({
  full_name: "J",
  email: "bad-email",
  project_type: "bad_type",
  budget_range: "1000_3000",
  timeline: "2_weeks",
  description: "Too short",
});

if (invalidLead.success || invalidLead.errors.length < 4) {
  console.error("Expected invalid lead to return detailed validation errors:", invalidLead);
  process.exit(1);
}

console.log("Lead schema verification passed.");
