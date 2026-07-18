import "server-only";

import { cache } from "react";
import { createSupabaseServerClient } from "./server";

// React scopes this cache to the current server render. Pages and AppShell can
// establish the viewer once instead of repeating the Auth network request.
export const getCurrentUser = cache(async () => {
  const supabase = await createSupabaseServerClient();
  return supabase.auth.getUser();
});
