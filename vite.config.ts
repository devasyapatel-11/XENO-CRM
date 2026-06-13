import { defineConfig } from "@lovable.dev/vite-tanstack-config";
import { loadEnv } from "vite";

// Server-side env vars injected via Vite define so process.env.X works in SSR handlers.
const SERVER_ENV_VARS = [
  "OPENROUTER_API_KEY",
  "SUPABASE_SERVICE_ROLE_KEY",
  "SUPABASE_URL",
  "SUPABASE_PUBLISHABLE_KEY",
  "SUPABASE_PROJECT_ID",
  "CHANNEL_SIMULATOR_URL",
  "SIMULATOR_SECRET",
  "PUBLIC_APP_URL",
];

export default defineConfig((env) => {
  const loaded = loadEnv(env.mode, process.cwd(), ""); // load ALL vars, no prefix filter

  const processEnvDefine: Record<string, string> = {};
  for (const key of SERVER_ENV_VARS) {
    const value = loaded[key] ?? process.env[key] ?? "";
    processEnvDefine[`process.env.${key}`] = JSON.stringify(value);
  }

  return {
    tanstackStart: {
      server: { entry: "server" },
    },
    vite: {
      define: processEnvDefine,
    },
    nitro: true,
  };
});
