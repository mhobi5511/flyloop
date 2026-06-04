import { createClient } from "@supabase/supabase-js";

import { getSupabaseServiceConfig } from "./config";

export function createSupabaseAdminClient() {
  const config = getSupabaseServiceConfig();

  if (!config) {
    return null;
  }

  return createClient(config.url, config.serviceRoleKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  });
}
