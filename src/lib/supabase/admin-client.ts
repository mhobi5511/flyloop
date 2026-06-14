import { createClient } from "@supabase/supabase-js";
import { getSupabaseConfigOrThrow } from "./config";

export function createSupabaseAdminClient() {
  const { url } = getSupabaseConfigOrThrow();
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!serviceRoleKey) {
    return null;
  }

  return createClient(url, serviceRoleKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  });
}
