import { parseCoordinate } from "@/lib/location";

export type GeocodeResult = {
  latitude: number;
  longitude: number;
};

const defaultGeocodingSearchUrl = "https://nominatim.openstreetmap.org/search";
const geocodeCache = new Map<string, GeocodeResult | null>();

export async function geocodeTunnelLocation(
  city?: string | null,
  country?: string | null,
): Promise<GeocodeResult | null> {
  const cleanCity = city?.trim();
  const cleanCountry = country?.trim();

  if (!cleanCity || !cleanCountry) {
    return null;
  }

  const cacheKey = getGeocodeCacheKey(cleanCity, cleanCountry);
  if (geocodeCache.has(cacheKey)) {
    return geocodeCache.get(cacheKey) ?? null;
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
      geocodeCache.set(cacheKey, null);
      return null;
    }

    const result = { latitude, longitude };
    geocodeCache.set(cacheKey, result);
    return result;
  } catch (error) {
    console.error("Tunnel geocoding request failed", error);
    geocodeCache.set(cacheKey, null);
    return null;
  }
}

export function getGeocodeCacheKey(city: string, country: string) {
  return `${city.trim().toLowerCase()}|${country.trim().toLowerCase()}`;
}

export function wait(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
