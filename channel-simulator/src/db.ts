// Supabase client for the simulator service.
// Uses service role key to bypass RLS — this is an internal trusted service.
// We use `any` for the client type here since the simulator doesn't carry
// the full generated Database type (it's a standalone service).
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

function getEnv(key: string): string {
  const v = process.env[key];
  if (!v) throw new Error(`Missing required env var: ${key}`);
  return v;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
let _client: SupabaseClient<any> | undefined;

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function db(): SupabaseClient<any> {
  if (!_client) {
    _client = createClient(getEnv("SUPABASE_URL"), getEnv("SUPABASE_SERVICE_ROLE_KEY"), {
      auth: { persistSession: false, autoRefreshToken: false },
    });
  }
  return _client;
}
