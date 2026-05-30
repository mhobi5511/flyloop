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
  const filteredRows = allRows.filter((row) => {
    const countryMatches =
      !filters.country || row.tunnel_country === filters.country;
    const monthMatches =
      !filters.month || row.start_date?.slice(0, 7) === filters.month;

    return countryMatches && monthMatches;
  });
  const opportunityIds = filteredRows.map((row) => row.id);
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
  const rows = filteredRows;
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
  const recommended: Opportunity[] = [];
  const followedCoaches: Opportunity[] = [];
  const followedTunnels: Opportunity[] = [];

  for (const item of mapped) {
    if (item.isLastMinute) {
      lastMinute.push(item.opportunity);
    }

    if (item.isNearby && !item.isLastMinute) {
      recommended.push(item.opportunity);
    }

    if (item.isFollowedCoach) {
      followedCoaches.push(item.opportunity);
    }

    if (followedTunnelIds.has(item.opportunity.tunnelId)) {
      followedTunnels.push(item.opportunity);
    }
  }
  const currentView = filters.view ?? "";
  const hasFilters = Boolean(filters.country || filters.month);
  const recommendationsEnabled = homeProfile?.use_location_recommendations === true;

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

      <form className="mt-4 -mx-4 flex gap-2 overflow-x-auto px-4 pb-1">
        <label className="shrink-0">
          <span className="sr-only">Country</span>
          <select
            name="country"
            defaultValue={filters.country ?? ""}
            className="h-9 rounded-full border border-slate-200 bg-white px-3 text-xs font-bold text-slate-700 shadow-sm outline-none"
          >
            <option value="">All countries</option>
            {countryOptions.map((country) => (
              <option key={country} value={country}>
                {country}
              </option>
            ))}
          </select>
        </label>
        <label className="shrink-0">
          <span className="sr-only">Month</span>
          <select
            name="month"
            defaultValue={filters.month ?? ""}
            className="h-9 rounded-full border border-slate-200 bg-white px-3 text-xs font-bold text-slate-700 shadow-sm outline-none"
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
          className="h-9 shrink-0 rounded-full bg-slate-950 px-4 text-xs font-bold text-white shadow-sm"
        >
          Apply
        </button>
      </form>

      {hasFilters ? (
        <Link
          href="/app"
          className="mt-3 inline-flex text-sm font-bold text-sky-700"
        >
          Clear filters
        </Link>
      ) : null}

      {lastMinute.length > 0 ? (
        <HomeSection
          title={currentView === "last-minute" ? "All last-minute opportunities" : "Last-minute opportunities"}
          opportunities={lastMinute}
          compact={false}
          viewHref={buildViewHref(filters, "last-minute")}
          showAll={currentView === "last-minute"}
        />
      ) : null}

      <HomeSection
        title={
          currentView === "recommended"
            ? recommendationsEnabled
              ? "All opportunities near you"
              : "All recommended opportunities"
            : recommendationsEnabled
              ? "Opportunities near you"
              : "Recommended opportunities"
        }
        opportunities={recommended}
        compact={false}
        viewHref={buildViewHref(filters, "recommended")}
        showAll={currentView === "recommended"}
      />

      <HomeSection
        title={currentView === "followed-coaches" ? "All followed coach opportunities" : "From followed coaches"}
        opportunities={followedCoaches}
        compact
        viewHref={buildViewHref(filters, "followed-coaches")}
        showAll={currentView === "followed-coaches"}
        hideWhenEmpty
      />

      <HomeSection
        title={currentView === "followed-tunnels" ? "All followed tunnel opportunities" : "From followed tunnels"}
        opportunities={followedTunnels}
        compact
        viewHref={buildViewHref(filters, "followed-tunnels")}
        showAll={currentView === "followed-tunnels"}
        hideWhenEmpty
      />
    </AppShell>
  );
}

function classifyLocation(row: HomeFeedRow, profile: HomeProfile | null) {
  if (!profile?.use_location_recommendations) {
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
    isNearby: true,
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
  hideWhenEmpty = false,
}: {
  title: string;
  opportunities: Opportunity[];
  compact: boolean;
  viewHref: string;
  showAll: boolean;
  hideWhenEmpty?: boolean;
}) {
  const visible = showAll ? opportunities : opportunities.slice(0, 4);

  if (hideWhenEmpty && visible.length === 0) {
    return null;
  }

  return (
    <section className="mt-6">
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-xl font-bold tracking-tight text-slate-950">
          {title}
        </h2>
        {!showAll && opportunities.length > 4 ? (
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
