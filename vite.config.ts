import { defineConfig } from "@lovable.dev/vite-tanstack-config";
import { loadEnv } from "vite";

// Load environment variables at file load time
const mode = process.env.NODE_ENV || "production";
const loaded = loadEnv(mode, process.cwd(), "");

// Server-side env vars injected via Vite define so process.env.X works in SSR handlers.
const SERVER_ENV_VARS = [
  "SUPABASE_URL",
  "SUPABASE_PUBLISHABLE_KEY",
  "SUPABASE_PROJECT_ID",
  "CHANNEL_SIMULATOR_URL",
  "PUBLIC_APP_URL",
];

const processEnvDefine: Record<string, string> = {};
for (const key of SERVER_ENV_VARS) {
  const value = loaded[key] ?? process.env[key] ?? "";
  processEnvDefine[`process.env.${key}`] = JSON.stringify(value);
}

export default defineConfig({
  tanstackStart: {
    server: { entry: "server" },
  },
  vite: {
    define: processEnvDefine,
  },
  nitro: {
    preset: "vercel",
  },
});
