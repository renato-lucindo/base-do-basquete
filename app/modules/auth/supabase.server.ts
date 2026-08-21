import { createClient, type SupabaseClient } from "@supabase/supabase-js";

import type { Database } from "../../types/database.generated";

function assertServerConfiguration(env: Env): void {
  if (!env.SUPABASE_URL || !env.SUPABASE_PUBLISHABLE_KEY) {
    throw new Error("Supabase server configuration is unavailable");
  }
}

const authOptions = {
  autoRefreshToken: false,
  detectSessionInUrl: false,
  persistSession: false,
} as const;

export function createAnonymousSupabaseClient(env: Env): SupabaseClient<Database> {
  assertServerConfiguration(env);

  return createClient<Database>(env.SUPABASE_URL, env.SUPABASE_PUBLISHABLE_KEY, {
    auth: authOptions,
  });
}

export function createAuthenticatedSupabaseClient(env: Env): SupabaseClient<Database> {
  assertServerConfiguration(env);

  return createClient<Database>(env.SUPABASE_URL, env.SUPABASE_PUBLISHABLE_KEY, {
    auth: authOptions,
  });
}
