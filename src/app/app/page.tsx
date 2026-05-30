import { AppShell } from "@/components/AppShell";
import { OpportunityCard } from "@/components/OpportunityCard";
import { Section } from "@/components/Section";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { mapOpportunity, type HomeFeedRow } from "@/lib/supabase/mappers";
import { distanceKm, parseCoordinate } from "@/lib/location";
import type { InterestStatus, Opportunity } from "@/lib/types";
import { redirect } from "next/navigation";

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

type InterestRow = {
  opportunity_id: string;
  status: InterestStatus;
};

export default async function AppHomePage() {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login?next=/app");
  }

  const [profileResult, opportunitiesResult, followsResult] = await Promise.all([
    supabase
      .from("profiles")
      .select("full_name,latitude,longitude,region,preferred_radius_km")
      .eq("id", user.id)
      .maybeSingle(),
    supabase
      .from("published_opportunities_with_context")
      .select("*")
      .order("start_date", { ascending: true }),
    supabase
      .from("follows")
      .select("target_id")
      .eq("follower_id", user.id)
      .eq("target_type", "coach"),
  ]);

  if (profileResult.error) {
    console.error("Home profile lookup failed", profileResult.error);
  }

  if (opportunitiesResult.error) {
    console.error("Home opportunities lookup failed", opportunitiesResult.error);
  }

  if (followsResult.error) {
    console.error("Home follows lookup failed", followsResult.error);
  }

  const followRows = followsResult.error ? [] : followsResult.data ?? [];
  const followedCoachIds = followRows
    .map((follow) => follow.target_id)
    .filter((id): id is string => typeof id === "string" && id.length > 0);
  const opportunityRows = opportunitiesResult.error
    ? []
    : ((opportunitiesResult.data ?? []) as HomeFeedRow[]);
  const opportunityIds = opportunityRows.map((row) => row.id);
  const { data: interestRows } =
    opportunityIds.length > 0
      ? await supabase
          .from("opportunity_interests")
          .select("opportunity_id,status")
          .eq("athlete_id", user.id)
          .in("opportunity_id", opportunityIds)
      : { data: [] };
  const { data: followedCoachRows } =
    followedCoachIds.length > 0
      ? await supabase
          .from("profiles")
          .select("id,full_name,country")
          .in("id", followedCoachIds)
      : { data: [] };
  const followedCoachProfiles = (followedCoachRows ?? []) as FollowedCoach[];

  const homeProfile = profileResult.error
    ? null
    : (profileResult.data as HomeProfile | null);
  const rows = opportunityRows;
  const interestByOpportunityId = new Map(
    ((interestRows ?? []) as InterestRow[]).map((interest) => [
      interest.opportunity_id,
      interest.status,
    ]),
  );
  const mapped = rows.map((row) => {
    const location = classifyLocation(row, homeProfile);
    return {
      opportunity: {
        ...mapOpportunity(row),
        tunnelDistanceKm: location.distanceKm ?? undefined,
        locationLabel: location.label,
        viewerInterestStatus: interestByOpportunityId.get(row.id),
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
      <div className="rounded-2xl bg-gradient-to-br from-sky-600 to-cyan-500 px-4 py-4 text-white shadow-sm sm:px-5">
        <p className="text-sm font-bold text-sky-100">
          Good to see you{homeProfile?.full_name ? `, ${homeProfile.full_name}` : ""}
        </p>
        <h1 className="mt-1 text-2xl font-black tracking-tight sm:text-3xl">
          Find flying opportunities you can still join.
        </h1>
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
  const profileRadius = profile?.preferred_radius_km;
  const radius =
    typeof profileRadius === "number" && Number.isFinite(profileRadius)
      ? profileRadius
      : 1000;

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
