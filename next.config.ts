import type { NextConfig } from "next";

const supabaseImagePattern = getSupabaseImagePattern();

const nextConfig: NextConfig = {
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "images.unsplash.com",
      },
      ...(supabaseImagePattern ? [supabaseImagePattern] : []),
    ],
  },
};

export default nextConfig;

function getSupabaseImagePattern() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;

  if (!supabaseUrl) {
    return null;
  }

  try {
    const storage = new URL(supabaseUrl);

    // Next's optimizer blocks loopback/private origins by design. Those use
    // the raw-image fallback in development instead.
    if (storage.protocol !== "https:") {
      return null;
    }

    return {
      protocol: "https" as const,
      hostname: storage.hostname,
      port: storage.port,
      pathname: "/storage/v1/object/public/**",
      // Intentionally omit `search` so valid cache-busting query strings work.
    };
  } catch {
    return null;
  }
}
