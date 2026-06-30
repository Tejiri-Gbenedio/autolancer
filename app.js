import { APP_CONFIG } from "./config.js";
import { createLeadId, delay, isValidEmail, normalizeLongText, normalizeWhitespace, parseJsonResponse, setElementText } from "./helpers.js";
import { insertLead } from "./supabase.js";

const form = document.querySelector("#leadForm");
const alertBox = document.querySelector("#formAlert");
const submitButton = document.querySelector("#submitButton");
const submissionStatus = document.querySelector("#submissionStatus");
const statusText = document.querySelector("#statusText");
const successScreen = document.querySelector("#successScreen");
const successLeadId = document.querySelector("#successLeadId");
const handoffNote = document.querySelector("#handoffNote");
const resetButton = document.querySelector("#resetButton");
const panelHeading = document.querySelector(".panel-heading");
const requiredFields = new Set(["full_name", "email", "project_type", "budget_range", "timeline", "description"]);

let isSubmitting = false;

const validators = {
  full_name(value) {
    if (!value) return "Enter your full name.";
    if (value.length < 2) return "Use at least 2 characters.";
    return "";
  },
  email(value) {
    if (!value) return "Enter your email address.";
    if (!isValidEmail(value)) return "Enter a valid email address.";
    return "";
  },
  project_type(value) {
    return value ? "" : "Choose a project type.";
  },
  budget_range(value) {
    return value ? "" : "Choose a budget range.";
  },
  timeline(value) {
    return value ? "" : "Choose a timeline.";
  },
  description(value) {
    if (!value) return "Describe the project.";
    if (value.length < 20) return "Add a little more detail so the AI review has enough context.";
    return "";
  },
};

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

function readFieldValue(field) {
  const value = field.name === "description" ? normalizeLongText(field.value) : normalizeWhitespace(field.value);
  field.value = value;
  return value;
}

function validateField(field) {
  if (!field.name) return true;

  const value = readFieldValue(field);
  const validator = validators[field.name];
  const message = validator ? validator(value) : "";

  setFieldError(field.name, message);
  return !message;
}

function validateForm() {
  const fields = Array.from(form.elements).filter((element) => element.name);
  const invalidFields = fields.filter((field) => !validateField(field));
  const valid = invalidFields.length === 0;

  if (!valid) {
    invalidFields[0]?.focus();
  }

  return valid;
}

function showAlert(message) {
  alertBox.textContent = message;
  alertBox.hidden = false;
}

function clearAlert() {
  alertBox.textContent = "";
  alertBox.hidden = true;
}

function setBusyState(isBusy) {
  isSubmitting = isBusy;
  form.classList.toggle("is-busy", isBusy);
  submitButton.disabled = isBusy;
  submitButton.querySelector("span").textContent = isBusy ? "Submitting..." : "Submit project";
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

function collectLeadPayload() {
  const formData = new FormData(form);
  const source = normalizeWhitespace(formData.get("source")) || "unknown";

  return {
    lead_id: createLeadId(),
    created_at: new Date().toISOString(),
    full_name: normalizeWhitespace(formData.get("full_name")),
    email: normalizeWhitespace(formData.get("email")).toLowerCase(),
    project_type: normalizeWhitespace(formData.get("project_type")),
    budget_range: normalizeWhitespace(formData.get("budget_range")),
    timeline: normalizeWhitespace(formData.get("timeline")),
    source,
    description: normalizeLongText(formData.get("description")),
    existing_tools: normalizeWhitespace(formData.get("existing_tools")),
    intake_channel: APP_CONFIG.intakeChannel,
    status: APP_CONFIG.defaultStatus,
    n8n_status: APP_CONFIG.initialN8nStatus,
  };
}

async function notifyN8n(leadPayload) {
  const response = await fetch(APP_CONFIG.endpoints.notifyN8n, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json",
    },
    body: JSON.stringify(leadPayload),
  });

  const payload = await parseJsonResponse(response);

  if (!response.ok) {
    throw new Error(payload.error || "AutoLancer could not confirm the AI handoff.");
  }

  return payload;
}

function showSuccess(leadPayload, handoffResult) {
  form.hidden = true;
  panelHeading.hidden = true;
  submissionStatus.hidden = true;
  successScreen.hidden = false;
  successLeadId.textContent = leadPayload.lead_id;

  if (handoffResult?.n8n_status === "failed") {
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
  document.querySelectorAll(".field").forEach((field) => field.classList.remove("invalid"));
  document.querySelectorAll(".field-error").forEach((error) => setElementText(error, ""));
  document.querySelectorAll("[aria-invalid]").forEach((field) => field.setAttribute("aria-invalid", "false"));
  getFieldElement("full_name")?.focus();
}

async function handleSubmit(event) {
  event.preventDefault();
  if (isSubmitting) return;

  clearAlert();

  if (!validateForm()) {
    showAlert("Please fix the highlighted fields before submitting.");
    return;
  }

  setBusyState(true);
  submissionStatus.hidden = false;
  setStage("checking");

  const leadPayload = collectLeadPayload();

  try {
    await delay(240);
    setStage("saving");
    await insertLead(leadPayload);

    await delay(240);
    setStage("preparing");

    await delay(240);
    setStage("connecting");
    const handoffResult = await notifyN8n(leadPayload);

    showSuccess(leadPayload, handoffResult);
  } catch (error) {
    console.error("AutoLancer intake failed:", error);
    showAlert(error.message || "AutoLancer could not submit this project. Please try again.");
    submissionStatus.hidden = true;
  } finally {
    setBusyState(false);
  }
}

form.addEventListener("submit", handleSubmit);
resetButton.addEventListener("click", resetForm);

form.addEventListener("blur", (event) => {
  if (event.target?.name && requiredFields.has(event.target.name)) {
    validateField(event.target);
  }
}, true);

form.addEventListener("input", (event) => {
  if (event.target?.name && event.target.getAttribute("aria-invalid") === "true") {
    validateField(event.target);
  }
});

form.addEventListener("change", (event) => {
  if (event.target?.name) {
    validateField(event.target);
  }
});

document.querySelectorAll("input, select, textarea").forEach((field) => {
  field.setAttribute("aria-invalid", "false");
});
