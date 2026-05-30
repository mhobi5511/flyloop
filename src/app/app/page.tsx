import { AppShell } from "@/components/AppShell";
import { OpportunityCard } from "@/components/OpportunityCard";
import { Section } from "@/components/Section";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { mapOpportunity, type HomeFeedRow } from "@/lib/supabase/mappers";
import { distanceKm, parseCoordinate } from "@/lib/location";
import type { Opportunity } from "@/lib/types";

type HomeProfile = {
  full_name: string | null;
  latitude: number | string | null;
  longitude: number | string | null;
  region: string | null;
  preferred_radius_km: number | null;
};

type FollowedCoach = {
  id: string;
  full_name: string;
  country: string | null;
};

export default async function AppHomePage() {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const [{ data: profile }, { data }, { data: followRows }] = await Promise.all([
    supabase
      .from("profiles")
      .select("full_name,latitude,longitude,region,preferred_radius_km")
      .eq("id", user?.id)
      .maybeSingle(),
    supabase
      .from("published_opportunities_with_context")
      .select("*")
      .order("start_date", { ascending: true }),
    supabase
      .from("follows")
      .select("target_id")
      .eq("follower_id", user?.id)
      .eq("target_type", "coach"),
  ]);
  const followedCoachIds = (followRows ?? []).map((follow) => follow.target_id);
  const { data: followedCoachRows } =
    followedCoachIds.length > 0
      ? await supabase
          .from("profiles")
          .select("id,full_name,country")
          .in("id", followedCoachIds)
      : { data: [] };
  const followedCoachProfiles = (followedCoachRows ?? []) as FollowedCoach[];

  const homeProfile = profile as HomeProfile | null;
  const rows = (data ?? []) as HomeFeedRow[];
  const mapped = rows.map((row) => {
    const location = classifyLocation(row, homeProfile);
    return {
      opportunity: {
        ...mapOpportunity(row),
        tunnelDistanceKm: location.distanceKm ?? undefined,
        locationLabel: location.label,
      },
      isNearby: location.isNearby,
      isLastMinute: row.is_last_minute ?? false,
      isFollowedCoach: Boolean(row.is_followed_coach),
    };
  });

  const lastMinute: Opportunity[] = [];
  const nearbyUpcoming: Opportunity[] = [];
  const allUpcoming: Opportunity[] = [];
  const followedCoaches: Opportunity[] = [];

  for (const item of mapped) {
    if (item.isNearby && item.isLastMinute) {
      lastMinute.push(item.opportunity);
    }

    if (item.isNearby && !item.isLastMinute) {
      nearbyUpcoming.push(item.opportunity);
    }

    if (!item.isLastMinute) {
      allUpcoming.push(item.opportunity);
    }

    if (item.isFollowedCoach) {
      followedCoaches.push(item.opportunity);
    }
  }
  const hasLocationPreference = Boolean(
    parseCoordinate(homeProfile?.latitude) !== null &&
      parseCoordinate(homeProfile?.longitude) !== null,
  ) || Boolean(homeProfile?.region);

  return (
    <AppShell active="home">
      <div className="rounded-3xl bg-gradient-to-br from-sky-600 to-cyan-500 p-5 text-white shadow-sm">
        <p className="text-sm font-bold text-sky-100">
          Good to see you{homeProfile?.full_name ? `, ${homeProfile.full_name}` : ""}
        </p>
        <h1 className="mt-2 text-3xl font-black tracking-tight">
          Find flying you can still join.
        </h1>
        <p className="mt-3 max-w-2xl text-sm leading-6 text-sky-50">
          Last-minute opportunities appear first automatically when dates,
          deadline and open capacity line up.
        </p>
      </div>

      {lastMinute.length > 0 ? (
        <Section title="Last-minute near you" eyebrow="Auto detected">
          {lastMinute.map((opportunity) => (
            <OpportunityCard key={opportunity.id} opportunity={opportunity} />
          ))}
        </Section>
      ) : null}

      {!hasLocationPreference ? (
        <div className="mt-5 rounded-2xl border border-sky-100 bg-white p-4 shadow-sm">
          <h2 className="font-black text-slate-950">
            Set your location to see opportunities near you.
          </h2>
          <p className="mt-2 text-sm leading-6 text-slate-600">
            Add coordinates or choose a region in your profile. Until then,
            browse all opportunities below.
          </p>
        </div>
      ) : null}

      <Section title="Upcoming opportunities near you">
        {nearbyUpcoming.length > 0 ? (
          nearbyUpcoming.map((opportunity) => (
            <OpportunityCard key={opportunity.id} opportunity={opportunity} />
          ))
        ) : (
          <p className="rounded-2xl border border-slate-200 bg-white p-4 text-sm text-slate-600">
            No nearby opportunities match your current location settings.
          </p>
        )}
      </Section>

      {followedCoaches.length > 0 ? (
        <Section title="From followed coaches">
          {followedCoaches.map((opportunity) => (
            <OpportunityCard key={opportunity.id} opportunity={opportunity} compact />
          ))}
        </Section>
      ) : null}

      {followedCoachProfiles.length > 0 ? (
        <Section title="Coaches you follow">
          <div className="grid gap-3 md:grid-cols-2">
            {followedCoachProfiles.map((coach) => (
              <div
                key={coach.id}
                className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm"
              >
                <p className="font-black text-slate-950">{coach.full_name}</p>
                <p className="mt-1 text-sm text-slate-600">
                  {coach.country ?? "Coach"}
                </p>
              </div>
            ))}
          </div>
        </Section>
      ) : null}

      <Section title="All Opportunities">
        {allUpcoming.length > 0 ? (
          allUpcoming.map((opportunity) => (
            <OpportunityCard key={opportunity.id} opportunity={opportunity} compact />
          ))
        ) : (
          <p className="rounded-2xl border border-slate-200 bg-white p-4 text-sm text-slate-600">
            No published opportunities yet.
          </p>
        )}
      </Section>
    </AppShell>
  );
}

function classifyLocation(row: HomeFeedRow, profile: HomeProfile | null) {
  const userLat = parseCoordinate(profile?.latitude);
  const userLon = parseCoordinate(profile?.longitude);
  const tunnelLat = parseCoordinate(row.tunnel_latitude);
  const tunnelLon = parseCoordinate(row.tunnel_longitude);
  const radius = profile?.preferred_radius_km ?? 1000;

  if (
    userLat !== null &&
    userLon !== null &&
    tunnelLat !== null &&
    tunnelLon !== null
  ) {
    const distance = distanceKm(
      { latitude: userLat, longitude: userLon },
      { latitude: tunnelLat, longitude: tunnelLon },
    );

    return {
      isNearby: distance <= radius,
      distanceKm: distance,
      label: `${Math.round(distance)} km away`,
    };
  }

  if (profile?.region && row.tunnel_region) {
    const sameRegion = profile.region === row.tunnel_region;
    return {
      isNearby: sameRegion,
      distanceKm: null,
      label: sameRegion ? "Same region" : row.tunnel_region,
    };
  }

  return {
    isNearby: false,
    distanceKm: null,
    label: row.tunnel_region ?? undefined,
  };
}
