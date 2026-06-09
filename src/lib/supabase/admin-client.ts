import { createClient } from "@supabase/supabase-js";
import { getSupabaseConfigOrThrow } from "./config";

export function createSupabaseAdminClient() {
  const { url, anonKey } = getSupabaseConfigOrThrow();

  return createClient(url, anonKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  });
}