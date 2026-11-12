import "server-only";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { requireEnv } from "./env";

let client: SupabaseClient | null = null;

/**
 * Server-side Supabase client.
 * It uses the secret (service_role) key, so use it ONLY in API routes and agent tools.
 */
export function getSupabase(): SupabaseClient {
  if (!client) {
    const rawUrl = requireEnv("SUPABASE_URL");
    const normalizedUrl = rawUrl.replace(
      /https:\/\/supabase\.com\/dashboard\/project\/([a-z0-9]+).*/i,
      "https://$1.supabase.co"
    );
    client = createClient(normalizedUrl, requireEnv("SUPABASE_SECRET_KEY"), {
      auth: { persistSession: false, autoRefreshToken: false },
    });
  }
  return client;
}
