import Link from "next/link";
import { AppShell } from "@/components/AppShell";
import { GlobalCampSearch } from "@/components/GlobalCampSearch";
import { OpportunityCard } from "@/components/OpportunityCard";
import { distanceKm, parseCoordinate } from "@/lib/location";
import { mapOpportunity, type HomeFeedRow } from "@/lib/supabase/mappers";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import type { InterestStatus, Opportunity } from "@/lib/types";
import { redirect } from "next/navigation";

type HomeProfile = {
  full_name: string | null;
  latitude: number | string | null;
  longitude: number | string | null;
  use_location_recommendations: boolean | null;
  preferred_radius_km: number | null;
};

type InterestRow = {
  opportunity_id: string;
  status: InterestStatus;
};

type HomeSearchParams = {
  country?: string;
  month?: string;
  coach?: string;
  tunnel?: string;
};

type FeedItem = {
  opportunity: Opportunity;
  isNearby: boolean;
  isLastMinute: boolean;
  isFollowedCoach: boolean;
  isFollowedTunnel: boolean;
  isPopular: boolean;
  distanceKm: number | null;
};

const interactedStatuses = new Set<InterestStatus>([
  "pending",
  "accepted",
  "waitlist",
  "declined",
  "withdrawn",
]);

export default async function AppHomePage({
  searchParams,
}: {
  searchParams?: Promise<HomeSearchParams>;
}) {
  const filters = (await searchParams) ?? {};
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
      .select("full_name,latitude,longitude,use_location_recommendations,preferred_radius_km")
      .eq("id", user.id)
      .maybeSingle(),
    supabase
      .from("published_opportunities_with_context")
      .select("*")
      .order("start_date", { ascending: true }),
    supabase
      .from("follows")
      .select("target_id,target_type")
      .eq("follower_id", user.id),
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

  const allRows = opportunitiesResult.error
    ? []
    : ((opportunitiesResult.data ?? []) as HomeFeedRow[]);
  const opportunityIds = allRows.map((row) => row.id);
  const followRows = followsResult.error ? [] : followsResult.data ?? [];
  const followedTunnelIds = new Set(
    followRows
      .filter((follow) => follow.target_type === "tunnel")
      .map((follow) => follow.target_id),
  );
  const { data: interestRows } =
    opportunityIds.length > 0
      ? await supabase
          .from("opportunity_interests")
          .select("opportunity_id,status")
          .eq("athlete_id", user.id)
          .in("opportunity_id", opportunityIds)
      : { data: [] };
  const homeProfile = profileResult.error
    ? null
    : (profileResult.data as HomeProfile | null);
  const interestByOpportunityId = new Map(
    ((interestRows ?? []) as InterestRow[]).map((interest) => [
      interest.opportunity_id,
      interest.status,
    ]),
  );
  const userLat = parseCoordinate(homeProfile?.latitude);
  const userLon = parseCoordinate(homeProfile?.longitude);
  const recommendationsEnabled =
    homeProfile?.use_location_recommendations === true;
  const locationAvailable = userLat !== null && userLon !== null;
  const useRadiusFilter = recommendationsEnabled && locationAvailable;
  const mapped = allRows.map((row) => {
    const location = classifyLocation(row, homeProfile, useRadiusFilter);
    const opportunity = {
      ...mapOpportunity(row),
      tunnelDistanceKm: location.distanceKm ?? undefined,
      locationLabel: location.label,
      viewerInterestStatus: interestByOpportunityId.get(row.id),
    };

    return {
      opportunity,
      isNearby: location.isNearby,
      isLastMinute: row.is_last_minute ?? false,
      isFollowedCoach: Boolean(row.is_followed_coach),
      isFollowedTunnel: followedTunnelIds.has(opportunity.tunnelId),
      isPopular: isPopular(opportunity),
      distanceKm: location.distanceKm,
    };
  });

  const today = new Date().toISOString().slice(0, 10);
  const upcomingAccepted = mapped
    .filter(
      (item) =>
        item.opportunity.viewerInterestStatus === "accepted" &&
        item.opportunity.endDate >= today &&
        item.opportunity.createdBy !== user.id,
    )
    .map((item) => item.opportunity)
    .sort((a, b) => Date.parse(a.startDate) - Date.parse(b.startDate));
  const joinable = mapped.filter((item) => {
    const viewerStatus = item.opportunity.viewerInterestStatus;

    return (
      item.opportunity.status === "published" &&
      item.opportunity.availableSpots > 0 &&
      item.opportunity.createdBy !== user.id &&
      (!viewerStatus || !interactedStatuses.has(viewerStatus))
    );
  });
  const discoveryFeed = joinable
    .filter((item) => !useRadiusFilter || item.isNearby)
    .sort(compareFeedItems);
  const visibleDiscoveryFeed = discoveryFeed.slice(0, 5);
  const globalSearchOpportunities = joinable.map((item) => item.opportunity);
  const countryOptions = getCountryOptions(allRows);
  const monthOptions = getMonthOptions(allRows);

  return (
    <AppShell active="home">
      <div className="rounded-2xl bg-gradient-to-br from-sky-600 to-cyan-500 px-4 py-3 text-white shadow-sm sm:px-5">
        <p className="text-sm font-bold text-sky-100">
          Good to see you{homeProfile?.full_name ? `, ${homeProfile.full_name}` : ""}
        </p>
        <h1 className="mt-1 text-2xl font-black tracking-tight sm:text-3xl">
          What can you fly next?
        </h1>
      </div>

      {upcomingAccepted.length > 0 ? (
        <HomeSection
          title="My Upcoming Camps"
          opportunities={upcomingAccepted}
          limit={1}
          viewHref="/app/applications?status=accepted"
          currentUserId={user.id}
        />
      ) : null}

      <section className="mt-4">
        <div className="flex items-center justify-between gap-3">
          <h2 className="text-lg font-bold tracking-tight text-slate-950">
            {useRadiusFilter ? "Opportunities Near You" : "Recommended Opportunities"}
          </h2>
          {discoveryFeed.length > visibleDiscoveryFeed.length ? (
            <Link
              href="#find-camps-worldwide"
              className="shrink-0 text-sm font-bold text-sky-700"
            >
              View More
            </Link>
          ) : null}
        </div>
        <div className="mt-3 grid gap-2 md:grid-cols-2">
          {visibleDiscoveryFeed.length > 0 ? (
            visibleDiscoveryFeed.map((item) => (
              <OpportunityCard
                key={item.opportunity.id}
                opportunity={item.opportunity}
                dense
                currentUserId={user.id}
                discoveryBadges={getDiscoveryBadges(item)}
              />
            ))
          ) : (
            <p className="rounded-2xl border border-slate-200 bg-white p-4 text-sm text-slate-600">
              No matching opportunities yet.
            </p>
          )}
        </div>
      </section>

      <GlobalCampSearch
        initialCountry={filters.country ?? ""}
        initialMonth={filters.month ?? ""}
        initialCoach={filters.coach ?? ""}
        initialTunnel={filters.tunnel ?? ""}
        countryOptions={countryOptions}
        monthOptions={monthOptions}
        opportunities={globalSearchOpportunities}
        excludedOpportunityIds={[]}
        currentUserId={user.id}
      />
    </AppShell>
  );
}

function HomeSection({
  title,
  opportunities,
  limit,
  viewHref,
  currentUserId,
}: {
  title: string;
  opportunities: Opportunity[];
  limit: number;
  viewHref: string;
  currentUserId: string;
}) {
  const visible = opportunities.slice(0, limit);

  return (
    <section className="mt-4">
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-lg font-bold tracking-tight text-slate-950">
          {title}
        </h2>
        {opportunities.length > 0 ? (
          <Link
            href={viewHref}
            className="shrink-0 text-sm font-bold text-sky-700"
          >
            View All
          </Link>
        ) : null}
      </div>
      <div className="mt-3 grid gap-2 md:grid-cols-2">
        {visible.map((opportunity) => (
          <OpportunityCard
            key={opportunity.id}
            opportunity={opportunity}
            compact
            dense
            currentUserId={currentUserId}
          />
        ))}
      </div>
    </section>
  );
}

function compareFeedItems(a: FeedItem, b: FeedItem) {
  return (
    Number(b.isLastMinute) - Number(a.isLastMinute) ||
    compareDistance(a, b) ||
    Date.parse(a.opportunity.startDate) - Date.parse(b.opportunity.startDate) ||
    Number(b.isFollowedCoach) - Number(a.isFollowedCoach) ||
    Number(b.isFollowedTunnel) - Number(a.isFollowedTunnel) ||
    Number(b.isPopular) - Number(a.isPopular) ||
    sortTimestamp(b.opportunity.createdAt) - sortTimestamp(a.opportunity.createdAt)
  );
}

function sortTimestamp(value?: string) {
  if (!value) {
    return 0;
  }

  const timestamp = Date.parse(value);
  return Number.isFinite(timestamp) ? timestamp : 0;
}

function compareDistance(a: FeedItem, b: FeedItem) {
  const aDistance = a.distanceKm ?? Number.POSITIVE_INFINITY;
  const bDistance = b.distanceKm ?? Number.POSITIVE_INFINITY;
  return aDistance - bDistance;
}

function getDiscoveryBadges(item: FeedItem) {
  const badges: Array<{
    label: string;
    tone: "amber" | "blue" | "green" | "slate";
  }> = [];

  if (item.isLastMinute) {
    badges.push({ label: "Last Minute", tone: "amber" });
  }

  if (item.isFollowedCoach) {
    badges.push({ label: "Followed Coach", tone: "blue" });
  }

  if (item.isFollowedTunnel) {
    badges.push({ label: "Followed Tunnel", tone: "green" });
  }

  if (item.isPopular) {
    badges.push({ label: "Popular", tone: "slate" });
  }

  return badges;
}

function isPopular(opportunity: Opportunity) {
  const booked = opportunity.totalCapacity - opportunity.availableSpots;

  return (
    opportunity.totalCapacity > 0 &&
    booked >= Math.max(2, Math.ceil(opportunity.totalCapacity * 0.5))
  );
}

function classifyLocation(
  row: HomeFeedRow,
  profile: HomeProfile | null,
  useRadiusFilter: boolean,
) {
  if (!useRadiusFilter) {
    return {
      isNearby: true,
      distanceKm: null,
      label: row.tunnel_region ?? undefined,
    };
  }

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

  return {
    isNearby: false,
    distanceKm: null,
    label: row.tunnel_region ?? undefined,
  };
}

function getCountryOptions(rows: HomeFeedRow[]) {
  return Array.from(
    new Set(
      rows
        .map((row) => row.tunnel_country)
        .filter((country): country is string => Boolean(country)),
    ),
  ).sort((a, b) => a.localeCompare(b));
}

function getMonthOptions(rows: HomeFeedRow[]) {
  const formatter = new Intl.DateTimeFormat("en", {
    month: "long",
    year: "numeric",
  });

  return Array.from(
    new Set(
      rows
        .map((row) => row.start_date?.slice(0, 7))
        .filter((month): month is string => Boolean(month)),
    ),
  )
    .sort()
    .map((value) => ({
      value,
      label: formatter.format(new Date(`${value}-01T00:00:00.000Z`)),
    }));
}
