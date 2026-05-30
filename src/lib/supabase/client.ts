"use client";

import { createBrowserClient } from "@supabase/ssr";
import { getSupabaseConfigOrThrow } from "./config";

export function createSupabaseBrowserClient() {
  const { url, anonKey } = getSupabaseConfigOrThrow();

  return createBrowserClient(url, anonKey);
}
