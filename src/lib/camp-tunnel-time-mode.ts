import "server-only";

import type { CampTunnelTimeMode } from "@/lib/types";

const defaultCampTunnelTimeMode: CampTunnelTimeMode =
  "athletes_may_use_own_tunnel_time";

let cachedSupportsCampTunnelTimeMode: boolean | null = null;

export function normalizeCampTunnelTimeMode(
  value?: string | null,
): CampTunnelTimeMode {
  return value === "tunnel_time_must_be_purchased_through_coach"
    ? "tunnel_time_must_be_purchased_through_coach"
    : defaultCampTunnelTimeMode;
}

export async function supportsCampTunnelTimeModeColumn(
  supabase: {
    from: (table: string) => {
      select: (columns: string) => {
        limit: (count: number) => PromiseLike<{ error: unknown }>;
      };
    };
  },
) {
  if (cachedSupportsCampTunnelTimeMode !== null) {
    return cachedSupportsCampTunnelTimeMode;
  }

  const { error } = await supabase.from("opportunities").select("tunnel_time_mode").limit(1);
  cachedSupportsCampTunnelTimeMode = !error;
  return cachedSupportsCampTunnelTimeMode;
}

export { defaultCampTunnelTimeMode };
