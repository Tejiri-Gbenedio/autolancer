export function createLeadId() {
  const stamp = new Date().toISOString().replace(/[-:TZ.]/g, "").slice(0, 14);
  const randomPart =
    window.crypto && window.crypto.randomUUID
      ? window.crypto.randomUUID().split("-")[0]
      : Math.random().toString(36).slice(2, 10);

  return `lead_${stamp}_${randomPart}`;
}

export function delay(ms) {
  return new Promise((resolve) => window.setTimeout(resolve, ms));
}

export function normalizeWhitespace(value) {
  return String(value || "").trim().replace(/\s+/g, " ");
}

export function normalizeLongText(value) {
  return String(value || "").trim().replace(/\r\n/g, "\n");
}

export function isValidEmail(value) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(value || "").trim());
}

export function setElementText(element, value) {
  if (element) {
    element.textContent = value;
  }
}

export async function parseJsonResponse(response) {
  const text = await response.text();
  if (!text) return {};

  try {
    return JSON.parse(text);
  } catch {
    return { message: text };
  }
}
