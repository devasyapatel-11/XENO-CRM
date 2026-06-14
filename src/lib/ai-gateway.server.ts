import { createOpenAICompatible } from "@ai-sdk/openai-compatible";

// Vite injects VITE_* vars into import.meta.env at build time (client + SSR).
// For server-only vars we use the define plugin in vite.config.ts which
// replaces process.env.X at compile time — making them available in SSR handlers.
function getApiKey(): string {
  // Try process.env first (replaced at compile time by vite define)
  // Then fall back to import.meta.env for VITE_ prefixed version if available
  const key =
    (typeof process !== "undefined" && process.env?.OPENROUTER_API_KEY) ||
    (import.meta.env?.VITE_OPENROUTER_API_KEY as string | undefined) ||
    "";
  return key;
}

export function createAiProvider(apiKey: string) {
  return createOpenAICompatible({
    name: "openrouter",
    baseURL: "https://openrouter.ai/api/v1",
    headers: {
      "Authorization": `Bearer ${apiKey}`,
      "HTTP-Referer": "https://xeno-crm.app",
      "X-Title": "Xeno CRM",
    },
  });
}

// Called by all AI functions — picks up the key automatically
export const createAiGatewayProvider = (_unused?: string) => {
  const key = getApiKey();
  return createAiProvider(key);
};
