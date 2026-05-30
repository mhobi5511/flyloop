export function getSupabaseConfig() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  const hasValidUrl = Boolean(
    url?.startsWith("https://") || url?.startsWith("http://localhost") || url?.startsWith("http://127.0.0.1"),
  );

  return {
    url,
    anonKey,
    isConfigured: Boolean(hasValidUrl && anonKey),
  };
}

export function getSupabaseConfigOrThrow() {
  const config = getSupabaseConfig();

  if (!config.isConfigured || !config.url || !config.anonKey) {
    throw new Error(
      "Supabase is not configured. NEXT_PUBLIC_SUPABASE_URL must be a valid Supabase URL and NEXT_PUBLIC_SUPABASE_ANON_KEY must be set.",
    );
  }

  return {
    url: config.url,
    anonKey: config.anonKey,
  };
}
