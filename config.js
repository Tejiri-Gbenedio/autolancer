export const APP_CONFIG = Object.freeze({
  intakeChannel: "web_form",
  defaultStatus: "new",
  initialN8nStatus: "pending",
  endpoints: Object.freeze({
    runtimeConfig: "/.netlify/functions/config",
    notifyN8n: "/.netlify/functions/notify-n8n",
  }),
  submissionStages: Object.freeze([
    { id: "checking", label: "Checking your project..." },
    { id: "saving", label: "Saving your request..." },
    { id: "preparing", label: "Preparing AI review..." },
    { id: "connecting", label: "Connecting with AutoLancer..." },
  ]),
});

let runtimeConfigPromise;

export async function getRuntimeConfig() {
  if (!runtimeConfigPromise) {
    runtimeConfigPromise = fetch(APP_CONFIG.endpoints.runtimeConfig, {
      headers: { Accept: "application/json" },
    })
      .then(async (response) => {
        const payload = await response.json().catch(() => ({}));

        if (!response.ok) {
          throw new Error(payload.error || "AutoLancer configuration is unavailable.");
        }

        if (!payload.supabaseUrl || !payload.supabaseAnonKey) {
          throw new Error("Supabase configuration is incomplete.");
        }

        return Object.freeze(payload);
      })
      .catch((error) => {
        runtimeConfigPromise = undefined;
        throw error;
      });
  }

  return runtimeConfigPromise;
}
