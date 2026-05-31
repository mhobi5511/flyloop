import { NextResponse } from "next/server";
import { isAdmin } from "@/lib/admin";
import { geocodeTunnelLocation, wait } from "@/lib/geocoding";
import { createSupabaseServerClient } from "@/lib/supabase/server";

type GeocodeTunnelRow = {
  id: string;
  name: string;
  city: string | null;
  country: string | null;
  latitude: number | null;
  longitude: number | null;
};

type FailedItem = {
  id: string;
  name: string;
  reason: string;
};

export async function POST(request: Request) {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!isAdmin(user)) {
    return NextResponse.json({ message: "Forbidden" }, { status: 403 });
  }

  const body = (await request.json().catch(() => ({}))) as {
    mode?: "missing" | "all";
  };
  const reGeocodeAll = body.mode === "all";
  const query = supabase
    .from("tunnel_profiles")
    .select("id,name,city,country,latitude,longitude")
    .order("name", { ascending: true });
  const { data, error } = reGeocodeAll
    ? await query
    : await query.or("latitude.is.null,longitude.is.null");

  if (error) {
    console.error("Tunnel geocode query failed", error);
    return NextResponse.json(
      { message: "Could not load tunnels for geocoding." },
      { status: 500 },
    );
  }

  const tunnels = (data ?? []) as GeocodeTunnelRow[];
  const failedItems: FailedItem[] = [];
  let updated = 0;
  let skipped = 0;

  for (let index = 0; index < tunnels.length; index += 1) {
    const tunnel = tunnels[index];

    if (!reGeocodeAll && tunnel.latitude !== null && tunnel.longitude !== null) {
      skipped += 1;
      continue;
    }

    if (!tunnel.city?.trim() || !tunnel.country?.trim()) {
      skipped += 1;
      failedItems.push({
        id: tunnel.id,
        name: tunnel.name,
        reason: "Missing city or country.",
      });
      continue;
    }

    const coordinates = await geocodeTunnelLocation(tunnel.city, tunnel.country);

    if (!coordinates) {
      failedItems.push({
        id: tunnel.id,
        name: tunnel.name,
        reason: "Geocoding returned no result.",
      });
    } else {
      const { error: updateError } = await supabase
        .from("tunnel_profiles")
        .update({
          latitude: coordinates.latitude,
          longitude: coordinates.longitude,
        })
        .eq("id", tunnel.id);

      if (updateError) {
        console.error("Tunnel geocode update failed", updateError);
        failedItems.push({
          id: tunnel.id,
          name: tunnel.name,
          reason: "Could not save coordinates.",
        });
      } else {
        updated += 1;
      }
    }

    if (index < tunnels.length - 1) {
      await wait(1100);
    }
  }

  return NextResponse.json({
    total: tunnels.length,
    updated,
    failed: failedItems.length,
    skipped,
    failed_items: failedItems,
  });
}
