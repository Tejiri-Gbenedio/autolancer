import { APP_CONFIG } from "./config.js";
import { delay, parseJsonResponse, setElementText } from "./helpers.js";
import { validateLead, validateLeadForHandoff, formatLeadErrors } from "./lib/lead-schema.js";
import { insertLead } from "./supabase.js";

const form = document.querySelector("#leadForm");
const alertBox = document.querySelector("#formAlert");
const submitButton = document.querySelector("#submitButton");
const submissionStatus = document.querySelector("#submissionStatus");
const statusText = document.querySelector("#statusText");
const successScreen = document.querySelector("#successScreen");
const successLeadId = document.querySelector("#successLeadId");
const copyReferenceButton = document.querySelector("#copyReferenceButton");
const handoffNote = document.querySelector("#handoffNote");
const resetButton = document.querySelector("#resetButton");
const returnHomeButton = document.querySelector("#returnHomeButton");
const panelHeading = document.querySelector(".panel-heading");
const descriptionField = document.querySelector("#description");
const descriptionCount = document.querySelector("#descriptionCount");
const fieldLabels = {
  full_name: "Full name",
  email: "Email",
  phone: "Phone",
  project_type: "Project type",
  budget_range: "Budget",
  timeline: "Timeline",
  source: "Lead source",
  description: "Project description",
  existing_tools: "Existing tools",
  website_url: "Website URL",
};

let isSubmitting = false;

function formatDisplayLeadId(leadId) {
  if (!leadId) return "-";

  const match = /^lead_(\d{14})(?:_(.+))?$/i.exec(leadId);
  if (!match) return leadId.startsWith("AL-") ? leadId : `AL-${leadId}`;

  const [, stamp] = match;
  return `AL-${stamp.slice(0, 8)}-${stamp.slice(8, 14)}`;
}

function getFieldElement(name) {
  return form.elements.namedItem(name);
}

function setFieldError(name, message) {
  const field = getFieldElement(name);
  if (!field) return;

  const fieldWrapper = field.closest(".field");
  const error = document.querySelector(`#${CSS.escape(name)}_error`);
  const hasError = Boolean(message);

  fieldWrapper?.classList.toggle("invalid", hasError);
  field.setAttribute("aria-invalid", String(hasError));
  setElementText(error, message);
}

function clearFieldErrors() {
  document.querySelectorAll(".field").forEach((field) => field.classList.remove("invalid"));
  document.querySelectorAll(".field-error").forEach((error) => setElementText(error, ""));
  document.querySelectorAll("[aria-invalid]").forEach((field) => field.setAttribute("aria-invalid", "false"));
}

function collectLeadPayload() {
  const formData = new FormData(form);

  return {
    ...Object.fromEntries(formData.entries()),
    intake_channel: APP_CONFIG.intakeChannel,
    status: APP_CONFIG.defaultStatus,
    n8n_status: APP_CONFIG.initialN8nStatus,
  };
}

function validateCurrentLead({ focusFirstInvalid = false } = {}) {
  clearFieldErrors();

  const result = validateLead(collectLeadPayload());

  for (const error of result.errors) {
    if (!getFieldElement(error.field)) continue;
    setFieldError(error.field, `${fieldLabels[error.field] || error.field}: ${error.message}`);
  }

  if (focusFirstInvalid && !result.success) {
    const firstInvalid = result.errors.map((error) => getFieldElement(error.field)).find(Boolean);
    firstInvalid?.focus();
  }

  return result;
}

function showAlert(message) {
  alertBox.textContent = message;
  alertBox.hidden = false;
}

function clearAlert() {
  alertBox.textContent = "";
  alertBox.hidden = true;
}

function updateDescriptionCount() {
  if (!descriptionField || !descriptionCount) return;
  descriptionCount.textContent = `${descriptionField.value.length} / 5000`;
}

function setBusyState(isBusy) {
  isSubmitting = isBusy;
  form.classList.toggle("is-busy", isBusy);
  submitButton.disabled = isBusy;

  const label = submitButton.querySelector(".button-label");
  if (label) {
    label.textContent = isBusy ? "Submitting..." : "Submit Project Brief";
  }
}

function setStage(stageId) {
  const stage = APP_CONFIG.submissionStages.find((item) => item.id === stageId);
  setElementText(statusText, stage?.label || "");

  document.querySelectorAll(".stage-list li").forEach((item) => {
    const itemStage = item.dataset.stage;
    const currentIndex = APP_CONFIG.submissionStages.findIndex((step) => step.id === stageId);
    const itemIndex = APP_CONFIG.submissionStages.findIndex((step) => step.id === itemStage);

    item.classList.toggle("active", itemStage === stageId);
    item.classList.toggle("complete", itemIndex > -1 && itemIndex < currentIndex);
  });
}

async function notifyN8n(leadPayload) {
  const validation = validateLeadForHandoff(leadPayload);
  if (!validation.success) {
    throw new Error(formatLeadErrors(validation.errors) || "Lead payload is invalid.");
  }

  const response = await fetch(APP_CONFIG.endpoints.notifyN8n, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json",
    },
    body: JSON.stringify(validation.data),
  });

  const payload = await parseJsonResponse(response);

  if (!response.ok) {
    throw new Error(payload.error || "AutoLancer could not confirm the AI handoff.");
  }

  return payload;
}

function createHandoffWarning(error) {
  const message = error instanceof Error ? error.message : "";

  if (message.includes("Missing Supabase or n8n environment variables") || message.includes("N8N_WEBHOOK_URL")) {
    return {
      ok: true,
      n8n_status: "pending",
      warning: "Your lead is safely stored. The n8n automation webhook is not configured yet, so AutoLancer skipped the AI handoff for now.",
    };
  }

  return {
    ok: true,
    n8n_status: "pending",
    warning: "Your lead is safely stored. AutoLancer could not complete the AI handoff right now, so it has been left pending for follow-up.",
  };
}

function showSuccess(leadPayload, handoffResult) {
  form.hidden = true;
  panelHeading.hidden = true;
  submissionStatus.hidden = true;
  successScreen.hidden = false;
  successLeadId.textContent = formatDisplayLeadId(leadPayload.lead_id);
  copyReferenceButton.disabled = false;
  copyReferenceButton.textContent = "Copy reference";

  if (handoffResult?.warning) {
    handoffNote.textContent = handoffResult.warning;
    handoffNote.hidden = false;
  } else if (handoffResult?.n8n_status === "failed") {
    handoffNote.textContent = "Your lead is safely stored. The AI handoff was flagged for follow-up, so no project details were lost.";
    handoffNote.hidden = false;
  } else {
    handoffNote.hidden = true;
  }

  successScreen.focus({ preventScroll: false });
}

function resetForm() {
  form.reset();
  clearAlert();
  panelHeading.hidden = false;
  form.hidden = false;
  successScreen.hidden = true;
  submissionStatus.hidden = true;
  handoffNote.hidden = true;
  copyReferenceButton.disabled = false;
  copyReferenceButton.textContent = "Copy reference";
  clearFieldErrors();
  updateDescriptionCount();
  getFieldElement("full_name")?.focus();
}

async function copyReferenceId() {
  const referenceId = successLeadId.textContent?.trim();
  if (!referenceId || referenceId === "-") return;

  try {
    await navigator.clipboard.writeText(referenceId);
    copyReferenceButton.textContent = "Copied";
  } catch (error) {
    console.warn("Clipboard copy failed:", error);
    copyReferenceButton.textContent = "Copy failed";
  }
}

function returnHome() {
  window.scrollTo({ top: 0, behavior: "smooth" });
  resetForm();
}

async function handleSubmit(event) {
  event.preventDefault();
  if (isSubmitting) return;

  clearAlert();

  const validation = validateCurrentLead({ focusFirstInvalid: true });

  if (!validation.success) {
    showAlert("Please fix the highlighted fields before submitting.");
    return;
  }

  setBusyState(true);
  submissionStatus.hidden = false;
  setStage("checking");

  const leadPayload = validation.data;
  let savedToSupabase = false;

  try {
    await delay(240);
    setStage("saving");
    await insertLead(leadPayload);
    savedToSupabase = true;

    await delay(240);
    setStage("preparing");

    await delay(240);
    setStage("connecting");
    let handoffResult;

    try {
      handoffResult = await notifyN8n(leadPayload);
    } catch (handoffError) {
      console.warn("AutoLancer handoff skipped after Supabase save:", handoffError);
      handoffResult = createHandoffWarning(handoffError);
    }

    showSuccess(leadPayload, handoffResult);
  } catch (error) {
    console.error("AutoLancer intake failed:", error);

    if (savedToSupabase) {
      showSuccess(leadPayload, createHandoffWarning(error));
      return;
    }

    showAlert(error.message || "AutoLancer could not submit this project. Please try again.");
    submissionStatus.hidden = true;
  } finally {
    setBusyState(false);
  }
}

form.addEventListener("submit", handleSubmit);
resetButton.addEventListener("click", resetForm);
copyReferenceButton.addEventListener("click", copyReferenceId);
returnHomeButton.addEventListener("click", returnHome);

form.addEventListener("blur", (event) => {
  if (event.target?.name) {
    validateCurrentLead();
  }
}, true);

form.addEventListener("input", (event) => {
  if (event.target?.name && event.target.getAttribute("aria-invalid") === "true") {
    validateCurrentLead();
  }
});

form.addEventListener("change", (event) => {
  if (event.target?.name) {
    validateCurrentLead();
  }
});

document.querySelectorAll("input, select, textarea").forEach((field) => {
  field.setAttribute("aria-invalid", "false");
});

descriptionField?.addEventListener("input", updateDescriptionCount);

updateDescriptionCount();
