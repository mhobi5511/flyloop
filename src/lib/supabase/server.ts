import { cookies } from "next/headers";
import { createServerClient } from "@supabase/ssr";
import { getSupabaseConfigOrThrow } from "./config";

export async function createSupabaseServerClient() {
  const cookieStore = await cookies();
  const { url, anonKey } = getSupabaseConfigOrThrow();

  return createServerClient(url, anonKey, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        try {
          cookiesToSet.forEach(({ name, value, options }) =>
            cookieStore.set(name, value, options),
          );
        } catch {
          // Server Components cannot always set cookies; middleware/proxy refreshes them.
        }
      },
    },
  });
}
