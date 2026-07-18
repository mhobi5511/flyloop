"use client";

import { createBrowserClient } from "@supabase/ssr";
import { getSupabaseConfigOrThrow } from "./config";

let browserClient: ReturnType<typeof createBrowserClient> | null = null;

export function createSupabaseBrowserClient() {
  const { url, anonKey } = getSupabaseConfigOrThrow();

  browserClient ??= createBrowserClient(url, anonKey);

  return browserClient;
}
