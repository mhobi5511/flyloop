import { parseCoordinate } from "@/lib/location";
import type { HomeFeedRow } from "@/lib/supabase/mappers";

type GeocodeResult = {
  latitude: number;
  longitude: number;
};

type GeocodingCacheClient = {
  rpc: (
    fn: "cache_tunnel_geocode",
    args: {
      target_tunnel_id: string;
      target_city: string;
      target_country: string;
      target_latitude: number;
      target_longitude: number;
    },
  ) => PromiseLike<{ error: unknown }>;
};

const defaultGeocodingSearchUrl = "https://nominatim.openstreetmap.org/search";
const maxGeocodesPerRequest = 5;

export async function geocodeTunnelLocation(
  city?: string | null,
  country?: string | null,
): Promise<GeocodeResult | null> {
  const cleanCity = city?.trim();
  const cleanCountry = country?.trim();

  if (!cleanCity || !cleanCountry) {
    return null;
  }

  const searchUrl = new URL(
    process.env.GEOCODING_SEARCH_URL ?? defaultGeocodingSearchUrl,
  );
  searchUrl.searchParams.set("format", "jsonv2");
  searchUrl.searchParams.set("limit", "1");
  searchUrl.searchParams.set("city", cleanCity);
  searchUrl.searchParams.set("country", cleanCountry);

  try {
    const response = await fetch(searchUrl, {
      headers: {
        Accept: "application/json",
        "User-Agent": "Flyloop live platform location recommendations",
      },
      next: { revalidate: 60 * 60 * 24 * 30 },
    });

    if (!response.ok) {
      console.error("Tunnel geocoding failed", response.status, cleanCity, cleanCountry);
      return null;
    }

    const results = (await response.json()) as Array<{
      lat?: string;
      lon?: string;
    }>;
    const first = results[0];
    const latitude = parseCoordinate(first?.lat);
    const longitude = parseCoordinate(first?.lon);

    if (latitude === null || longitude === null) {
      return null;
    }

    return { latitude, longitude };
  } catch (error) {
    console.error("Tunnel geocoding request failed", error);
    return null;
  }
}

export async function ensureTunnelCoordinates(
  rows: HomeFeedRow[],
  supabase: GeocodingCacheClient,
) {
  const rowsByTunnelId = new Map<string, HomeFeedRow[]>();

  for (const row of rows) {
    const tunnelLat = parseCoordinate(row.tunnel_latitude);
    const tunnelLon = parseCoordinate(row.tunnel_longitude);

    if (tunnelLat !== null && tunnelLon !== null) {
      continue;
    }

    if (!row.tunnel_city?.trim() || !row.tunnel_country?.trim()) {
      continue;
    }

    rowsByTunnelId.set(row.tunnel_id, [
      ...(rowsByTunnelId.get(row.tunnel_id) ?? []),
      row,
    ]);
  }

  let attemptedCount = 0;
  for (const [tunnelId, tunnelRows] of rowsByTunnelId) {
    if (attemptedCount >= maxGeocodesPerRequest) {
      break;
    }

    attemptedCount += 1;
    const firstRow = tunnelRows[0];
    const result = await geocodeTunnelLocation(
      firstRow.tunnel_city,
      firstRow.tunnel_country,
    );

    if (!result) {
      if (
        attemptedCount < maxGeocodesPerRequest &&
        attemptedCount < rowsByTunnelId.size
      ) {
        await wait(1100);
      }
      continue;
    }

    const { error } = await supabase.rpc("cache_tunnel_geocode", {
      target_tunnel_id: tunnelId,
      target_city: firstRow.tunnel_city ?? "",
      target_country: firstRow.tunnel_country ?? "",
      target_latitude: result.latitude,
      target_longitude: result.longitude,
    });

    if (error) {
      console.error("Tunnel coordinate cache failed", error);
    }

    for (const row of tunnelRows) {
      row.tunnel_latitude = result.latitude;
      row.tunnel_longitude = result.longitude;
    }

    if (
      attemptedCount < maxGeocodesPerRequest &&
      attemptedCount < rowsByTunnelId.size
    ) {
      await wait(1100);
    }
  }

  return rows;
}

function wait(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
