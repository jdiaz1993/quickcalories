import { createClient, SupabaseClient } from "@supabase/supabase-js";

/**
 * Server-only Supabase client with service role key. Bypasses RLS.
 * Use only in trusted server code (e.g. webhooks, cron). Do NOT expose to client.
 */
export function createAdminClient(): SupabaseClient {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !serviceRoleKey) {
    throw new Error(
      "Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY"
    );
  }

  return createClient(url, serviceRoleKey);
}

/** Singleton admin client; call when needed (e.g. in server routes). */
export const supabaseAdmin = createAdminClient;
