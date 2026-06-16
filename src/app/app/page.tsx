import Link from "next/link";
import { AppShell } from "@/components/AppShell";
import { GlobalCampSearch } from "@/components/GlobalCampSearch";
import { OpportunityCard } from "@/components/OpportunityCard";
import { distanceKm, parseCoordinate } from "@/lib/location";
import {
  isOpportunityCompleted,
  isOpportunityCurrent,
  isOpportunityJoinable,
} from "@/lib/opportunity-lifecycle";
import {
  countUnreadByOpportunity,
  participantActivityNotificationTypes,
} from "@/lib/notifications";
import { calculateProfileCompleteness } from "@/lib/profile-completeness";
import { mapOpportunity, type HomeFeedRow } from "@/lib/supabase/mappers";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import type { InterestStatus, Opportunity } from "@/lib/types";
import { redirect } from "next/navigation";

type HomeProfile = {
  full_name: string | null;
  country: string | null;
  city: string | null;
  disciplines: string[] | null;
  home_tunnel_id: string | null;
  instagram_handle: string | null;
  profile_image_url: string | null;
  latitude: number | string | null;
  longitude: number | string | null;
  use_location_recommendations: boolean | null;
  preferred_radius_km: number | null;
};

type InterestRow = {
  opportunity_id: string;
  status: InterestStatus;
  interest_type: string | null;
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
]);

const heroMessages = [
  "What can you fly next?",
  "Ready for your next camp?",
  "Time to fly?",
  "Find your next tunnel session.",
  "Discover your next opportunity.",
  "Your next camp might already be waiting.",
  "Where do you want to fly next?",
];

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

  const [
    profileResult,
    opportunitiesResult,
    followsResult,
    unreadNotificationsResult,
  ] = await Promise.all([
    supabase
      .from("profiles")
      .select("full_name,country,city,disciplines,home_tunnel_id,instagram_handle,profile_image_url,latitude,longitude,use_location_recommendations,preferred_radius_km")
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
    supabase
      .from("notifications")
      .select("opportunity_id,type,body")
      .eq("user_id", user.id)
      .eq("read", false)
      .in("type", [...participantActivityNotificationTypes]),
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
  if (unreadNotificationsResult.error) {
    console.error(
      "Home unread notification lookup failed",
      unreadNotificationsResult.error,
    );
  }

  const unreadCountsByOpportunity = countUnreadByOpportunity(
    unreadNotificationsResult.error ? [] : (unreadNotificationsResult.data ?? []),
  );
  const followedTunnelIds = new Set(
    followRows
      .filter((follow) => follow.target_type === "tunnel")
      .map((follow) => follow.target_id),
  );
  const { data: interestRows } =
    opportunityIds.length > 0
      ? await supabase
          .from("opportunity_interests")
          .select("opportunity_id,status,interest_type")
          .eq("athlete_id", user.id)
          .in("opportunity_id", opportunityIds)
      : { data: [] };
  const homeProfile = profileResult.error
    ? null
    : (profileResult.data as HomeProfile | null);
  const profileCompleteness = calculateProfileCompleteness(homeProfile);
  const interestByOpportunityId = new Map(
    ((interestRows ?? []) as InterestRow[]).map((interest) => [
      interest.opportunity_id,
      interest.interest_type === "timetable_reminder" ||
      interest.status === "withdrawn"
        ? undefined
        : interest.status,
    ]),
  );
  const userLat = parseCoordinate(homeProfile?.latitude);
  const userLon = parseCoordinate(homeProfile?.longitude);
  const recommendationsEnabled =
    homeProfile?.use_location_recommendations === true;
  const locationAvailable = userLat !== null && userLon !== null;
  const useRadiusFilter = recommendationsEnabled && locationAvailable;
  const now = new Date();
  const mapped = allRows.map((row) => {
    const location = classifyLocation(row, homeProfile, useRadiusFilter);
    const opportunity = {
      ...mapOpportunity(row),
      tunnelDistanceKm: location.distanceKm ?? undefined,
      locationLabel: location.label,
      viewerInterestStatus: interestByOpportunityId.get(row.id),
      unreadNotificationCount: unreadCountsByOpportunity.get(row.id) ?? 0,
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
  const upcomingAccepted = mapped
    .filter(
      (item) =>
        item.opportunity.viewerInterestStatus === "accepted" &&
        isOpportunityCurrent(item.opportunity, now) &&
        item.opportunity.createdBy !== user.id,
    )
    .map((item) => item.opportunity)
    .sort((a, b) => Date.parse(a.startDate) - Date.parse(b.startDate));
  const isDiscoverableStatus = (status: Opportunity["status"]) =>
    status === "published" || status === "full";
  const joinable = mapped.filter((item) => {
    const viewerStatus = item.opportunity.viewerInterestStatus;

    return (
      isDiscoverableStatus(item.opportunity.status) &&
      isOpportunityJoinable(item.opportunity, now) &&
      item.opportunity.createdBy !== user.id &&
      (!viewerStatus || !interactedStatuses.has(viewerStatus))
    );
  });
  const nearbyDiscoveryFeed = useRadiusFilter
    ? joinable.filter((item) => item.isNearby).sort(compareFeedItems)
    : joinable.sort(compareFeedItems);
  const isUsingGlobalFallback = useRadiusFilter && nearbyDiscoveryFeed.length === 0;
  const discoveryFeed = isUsingGlobalFallback
    ? [...joinable].sort(compareStartDate)
    : nearbyDiscoveryFeed;
  const visibleDiscoveryFeed = discoveryFeed.slice(0, 5);
  const globalSearchOpportunities = mapped
    .filter(
      (item) =>
        isDiscoverableStatus(item.opportunity.status) &&
        isOpportunityJoinable(item.opportunity, now),
    )
    .map((item) => item.opportunity);
  const futureRows = allRows.filter(
    (row) =>
      row.status !== "cancelled" &&
      !isOpportunityCompleted({ endDate: row.end_date, registrationDeadline: row.registration_deadline }, now),
  );
  const countryOptions = getCountryOptions(futureRows);
  const monthOptions = getMonthOptions(futureRows);
  const heroHeadline = getDailyHeroMessage();

  return (
    <AppShell active="home">
      <div className="rounded-2xl bg-gradient-to-br from-sky-600 to-cyan-500 px-4 py-3 text-white shadow-sm sm:px-5">
        <p className="text-sm font-bold text-sky-100">
          Good to see you{homeProfile?.full_name ? `, ${homeProfile.full_name}` : ""}
        </p>
        <h1 className="mt-1 text-2xl font-black tracking-tight sm:text-3xl">
          {heroHeadline}
        </h1>
      </div>

      {!profileCompleteness.isComplete ? (
        <div className="mt-4 flex flex-col items-start gap-3 rounded-2xl border border-sky-100 bg-white p-4 shadow-sm sm:flex-row sm:items-center sm:justify-between">
          <div className="min-w-0">
            <h2 className="text-base font-black tracking-tight text-slate-950">
              Complete your profile
            </h2>
            <p className="mt-1 text-sm text-slate-600">
              Your profile is {profileCompleteness.percent}% complete.
            </p>
          </div>
          <Link
            href="/app/profile"
            className="shrink-0 rounded-full bg-sky-600 px-4 py-2 text-sm font-black text-white"
          >
            Complete Profile
          </Link>
        </div>
      ) : null}

      {upcomingAccepted.length > 0 ? (
        <HomeSection
          title="My Next Camp"
          opportunities={upcomingAccepted}
          limit={1}
          viewHref="/app/applications?status=accepted"
          currentUserId={user.id}
        />
      ) : null}

      <section className="mt-4">
        <div className="flex items-center justify-between gap-3">
          <div>
            <h2 className="text-lg font-bold tracking-tight text-slate-950">
              {useRadiusFilter ? "Opportunities Near You" : "Recommended Opportunities"}
            </h2>
            <p className="mt-0.5 text-sm font-semibold text-slate-500">
              {useRadiusFilter
                ? "Based on your preferences and location."
                : "Based on your profile and upcoming availability."}
            </p>
          </div>
          {discoveryFeed.length > visibleDiscoveryFeed.length ? (
            <Link
              href="#find-camps-worldwide"
              className="shrink-0 text-sm font-bold text-sky-700"
            >
              View More
            </Link>
          ) : null}
        </div>
        {isUsingGlobalFallback && visibleDiscoveryFeed.length > 0 ? (
          <p className="mt-2 text-sm font-semibold text-slate-500">
            No nearby opportunities found. Showing upcoming opportunities worldwide.
          </p>
        ) : null}
        <div className="mt-3 grid gap-2 md:grid-cols-2">
          {visibleDiscoveryFeed.length > 0 ? (
            visibleDiscoveryFeed.map((item) => (
              <OpportunityCard
                key={item.opportunity.id}
                opportunity={item.opportunity}
                dense
                discoveryLayout
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

function compareStartDate(a: FeedItem, b: FeedItem) {
  return (
    Date.parse(a.opportunity.startDate) - Date.parse(b.opportunity.startDate) ||
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

function getDailyHeroMessage(date = new Date()) {
  return heroMessages[getDayOfYear(date) % heroMessages.length];
}

function getDayOfYear(date: Date) {
  const startOfYear = Date.UTC(date.getUTCFullYear(), 0, 0);
  const today = Date.UTC(
    date.getUTCFullYear(),
    date.getUTCMonth(),
    date.getUTCDate(),
  );

  return Math.floor((today - startOfYear) / 86_400_000);
}
