import { AppShell } from "@/components/AppShell";
import { OpportunityCard } from "@/components/OpportunityCard";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { mapOpportunity, type HomeFeedRow } from "@/lib/supabase/mappers";
import { distanceKm, parseCoordinate } from "@/lib/location";
import type { InterestStatus, Opportunity } from "@/lib/types";
import { redirect } from "next/navigation";
import Link from "next/link";

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
  view?: string;
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
  const countryOptions = getCountryOptions(allRows);
  const monthOptions = getMonthOptions(allRows);
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
  const rows = allRows;
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
  const mapped = rows.map((row) => {
    const location = classifyLocation(row, homeProfile, useRadiusFilter);
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

  const today = new Date().toISOString().slice(0, 10);
  const upcomingAccepted = mapped
    .filter(
      (item) =>
        item.opportunity.viewerInterestStatus === "accepted" &&
        item.opportunity.endDate >= today &&
        item.opportunity.createdBy !== user.id,
    )
    .map((item) => item.opportunity);
  const joinable = mapped.filter((item) => {
    const viewerStatus = item.opportunity.viewerInterestStatus;

    return (
      item.opportunity.status === "published" &&
      item.opportunity.availableSpots > 0 &&
      item.opportunity.createdBy !== user.id &&
      (!viewerStatus || !interactedStatuses.has(viewerStatus))
    );
  });
  const lastMinute: Opportunity[] = [];
  const recommended: Opportunity[] = [];
  const followedCoaches: Opportunity[] = [];
  const followedTunnels: Opportunity[] = [];
  const usedOpportunityIds = new Set<string>();

  takeUnique(upcomingAccepted, usedOpportunityIds);

  for (const item of joinable) {
    if (item.isLastMinute && (!useRadiusFilter || item.isNearby)) {
      pushUnique(lastMinute, item.opportunity, usedOpportunityIds);
    }
  }

  for (const item of joinable) {
    if (item.isNearby && !item.isLastMinute) {
      pushUnique(recommended, item.opportunity, usedOpportunityIds);
    }
  }

  for (const item of joinable) {
    if (item.isFollowedCoach) {
      pushUnique(followedCoaches, item.opportunity, usedOpportunityIds);
    }
  }

  for (const item of joinable) {
    if (followedTunnelIds.has(item.opportunity.tunnelId)) {
      pushUnique(followedTunnels, item.opportunity, usedOpportunityIds);
    }
  }
  const currentView = filters.view ?? "";
  const hasGlobalSearch = Boolean(filters.country || filters.month);
  const visibleFeedIds = getVisibleFeedIds({
    upcomingAccepted,
    lastMinute,
    recommended,
    followedCoaches,
    followedTunnels,
    currentView,
  });
  const globalSearchResults = hasGlobalSearch
    ? joinable
        .map((item) => item.opportunity)
        .filter((opportunity) => {
          const countryMatches =
            !filters.country || opportunity.tunnelCountry === filters.country;
          const monthMatches =
            !filters.month || opportunity.startDate?.slice(0, 7) === filters.month;

          return (
            countryMatches &&
            monthMatches &&
            !visibleFeedIds.has(opportunity.id)
          );
        })
    : [];
  const hasAnySection =
    upcomingAccepted.length > 0 ||
    lastMinute.length > 0 ||
    recommended.length > 0 ||
    followedCoaches.length > 0 ||
    followedTunnels.length > 0;

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

      {upcomingAccepted.length > 0 ? (
        <HomeSection
          title="My Upcoming Camps"
          opportunities={upcomingAccepted}
          compact
          viewHref="/app/applications?status=accepted"
          showAll={false}
          limit={1}
          currentUserId={user.id}
        />
      ) : null}

      {lastMinute.length > 0 ? (
        <HomeSection
          title={currentView === "last-minute" ? "All Last Minute Opportunities" : "Last Minute Opportunities"}
          opportunities={lastMinute}
          compact={false}
          viewHref={buildViewHref(filters, "last-minute")}
          showAll={currentView === "last-minute"}
          limit={2}
          currentUserId={user.id}
        />
      ) : null}

      {recommended.length > 0 ? (
        <HomeSection
          title={
            currentView === "recommended"
              ? useRadiusFilter
                ? "All Opportunities Near You"
                : "All Recommended Opportunities"
              : useRadiusFilter
                ? "Opportunities Near You"
                : "Recommended Opportunities"
          }
          opportunities={recommended}
          compact={false}
          viewHref={buildViewHref(filters, "recommended")}
          showAll={currentView === "recommended"}
          limit={4}
          currentUserId={user.id}
        />
      ) : null}

      <HomeSection
        title={currentView === "followed-coaches" ? "All Followed Coach Opportunities" : "From Followed Coaches"}
        opportunities={followedCoaches}
        compact
        viewHref={buildViewHref(filters, "followed-coaches")}
        showAll={currentView === "followed-coaches"}
        limit={4}
        hideWhenEmpty
        currentUserId={user.id}
      />

      <HomeSection
        title={currentView === "followed-tunnels" ? "All Followed Tunnel Opportunities" : "From Followed Tunnels"}
        opportunities={followedTunnels}
        compact
        viewHref={buildViewHref(filters, "followed-tunnels")}
        showAll={currentView === "followed-tunnels"}
        limit={4}
        hideWhenEmpty
        currentUserId={user.id}
      />

      {!hasAnySection ? (
        <p className="mt-6 rounded-2xl border border-slate-200 bg-white p-4 text-sm text-slate-600">
          No matching opportunities yet.
        </p>
      ) : null}

      <GlobalCampSearch
        filters={filters}
        countryOptions={countryOptions}
        monthOptions={monthOptions}
        results={globalSearchResults}
        hasSearch={hasGlobalSearch}
        currentUserId={user.id}
      />
    </AppShell>
  );
}

function getVisibleFeedIds({
  upcomingAccepted,
  lastMinute,
  recommended,
  followedCoaches,
  followedTunnels,
  currentView,
}: {
  upcomingAccepted: Opportunity[];
  lastMinute: Opportunity[];
  recommended: Opportunity[];
  followedCoaches: Opportunity[];
  followedTunnels: Opportunity[];
  currentView: string;
}) {
  return new Set(
    [
      ...upcomingAccepted.slice(0, 1),
      ...(currentView === "last-minute" ? lastMinute : lastMinute.slice(0, 2)),
      ...(currentView === "recommended" ? recommended : recommended.slice(0, 4)),
      ...(currentView === "followed-coaches"
        ? followedCoaches
        : followedCoaches.slice(0, 4)),
      ...(currentView === "followed-tunnels"
        ? followedTunnels
        : followedTunnels.slice(0, 4)),
    ].map((opportunity) => opportunity.id),
  );
}

function takeUnique(opportunities: Opportunity[], usedIds: Set<string>) {
  for (const opportunity of opportunities) {
    usedIds.add(opportunity.id);
  }
}

function pushUnique(
  target: Opportunity[],
  opportunity: Opportunity,
  usedIds: Set<string>,
) {
  if (usedIds.has(opportunity.id)) {
    return;
  }

  target.push(opportunity);
  usedIds.add(opportunity.id);
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

function HomeSection({
  title,
  opportunities,
  compact,
  viewHref,
  showAll,
  limit,
  hideWhenEmpty = false,
  currentUserId,
}: {
  title: string;
  opportunities: Opportunity[];
  compact: boolean;
  viewHref: string;
  showAll: boolean;
  limit: number;
  hideWhenEmpty?: boolean;
  currentUserId: string;
}) {
  const visible = showAll ? opportunities : opportunities.slice(0, limit);

  if (hideWhenEmpty && visible.length === 0) {
    return null;
  }

  return (
    <section className="mt-6">
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-xl font-bold tracking-tight text-slate-950">
          {title}
        </h2>
        {!showAll && opportunities.length > limit ? (
          <Link
            href={viewHref}
            className="shrink-0 text-sm font-bold text-sky-700"
          >
            View all
          </Link>
        ) : null}
      </div>
      <div className="mt-4 grid gap-3 md:grid-cols-2">
        {visible.length > 0 ? (
          visible.map((opportunity) => (
            <OpportunityCard
              key={opportunity.id}
              opportunity={opportunity}
              compact={compact}
              currentUserId={currentUserId}
            />
          ))
        ) : (
          <p className="rounded-2xl border border-slate-200 bg-white p-4 text-sm text-slate-600">
            No matching opportunities yet.
          </p>
        )}
      </div>
    </section>
  );
}

function GlobalCampSearch({
  filters,
  countryOptions,
  monthOptions,
  results,
  hasSearch,
  currentUserId,
}: {
  filters: HomeSearchParams;
  countryOptions: string[];
  monthOptions: Array<{ value: string; label: string }>;
  results: Opportunity[];
  hasSearch: boolean;
  currentUserId: string;
}) {
  return (
    <section className="mt-8 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
      <div>
        <h2 className="text-xl font-black tracking-tight text-slate-950">
          Find Camps Worldwide
        </h2>
        <p className="mt-1 text-sm leading-6 text-slate-600">
          Search all published camps by country and month.
        </p>
      </div>

      <form className="mt-4 grid gap-2 sm:grid-cols-[1fr_1fr_auto]">
        <label>
          <span className="sr-only">Country</span>
          <select
            name="country"
            defaultValue={filters.country ?? ""}
            className="field"
          >
            <option value="">All countries</option>
            {countryOptions.map((country) => (
              <option key={country} value={country}>
                {country}
              </option>
            ))}
          </select>
        </label>
        <label>
          <span className="sr-only">Month</span>
          <select
            name="month"
            defaultValue={filters.month ?? ""}
            className="field"
          >
            <option value="">All months</option>
            {monthOptions.map((month) => (
              <option key={month.value} value={month.value}>
                {month.label}
              </option>
            ))}
          </select>
        </label>
        <button
          type="submit"
          className="h-11 rounded-xl bg-slate-950 px-4 text-sm font-bold text-white"
        >
          Find Camp
        </button>
      </form>

      {hasSearch ? (
        <Link
          href="/app"
          className="mt-3 inline-flex text-sm font-bold text-sky-700"
        >
          Clear search
        </Link>
      ) : null}

      {hasSearch ? (
        <div className="mt-4 grid gap-3 md:grid-cols-2">
          {results.length > 0 ? (
            results.map((opportunity) => (
              <OpportunityCard
                key={opportunity.id}
                opportunity={opportunity}
                currentUserId={currentUserId}
              />
            ))
          ) : (
            <p className="rounded-xl bg-slate-50 p-4 text-sm font-semibold text-slate-600">
              No camps found for this search.
            </p>
          )}
        </div>
      ) : null}
    </section>
  );
}

function buildViewHref(filters: HomeSearchParams, view: string) {
  const params = new URLSearchParams();

  if (filters.country) {
    params.set("country", filters.country);
  }

  if (filters.month) {
    params.set("month", filters.month);
  }

  params.set("view", view);
  return `/app?${params.toString()}`;
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
