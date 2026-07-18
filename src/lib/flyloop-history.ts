import type { createSupabaseServerClient } from "@/lib/supabase/server";
import { isOpportunityCompleted } from "@/lib/opportunity-lifecycle";

type SupabaseServerClient = Awaited<ReturnType<typeof createSupabaseServerClient>>;

type OpportunityRelation = {
  id: string;
  title: string;
  type: "camp" | "huck_jam";
  status: "draft" | "published" | "full" | "cancelled";
  start_date: string;
  end_date: string;
  registration_deadline: string | null;
  created_by: string;
  tunnel_profiles:
    | { id: string; name: string | null; country: string | null }
    | Array<{ id: string; name: string | null; country: string | null }>
    | null;
  profiles:
    | { full_name: string | null }
    | Array<{ full_name: string | null }>
    | null;
};

type CampBookingRow = {
  user_id: string;
  minutes: number;
  opportunities: OpportunityRelation | OpportunityRelation[] | null;
};

type InterestRow = {
  athlete_id: string;
  opportunities: OpportunityRelation | OpportunityRelation[] | null;
};

type OrganizedOpportunityRow = OpportunityRelation & {
  opportunity_slot_bookings:
    | Array<{ minutes: number; user_id: string }>
    | { minutes: number; user_id: string }
    | null;
};

export type FlyloopHistoryEntry = {
  opportunityId: string;
  title: string;
  type: "camp" | "huck_jam";
  completedDate: string;
  year: string;
  tunnelId: string | null;
  tunnelName: string;
  tunnelCountry: string | null;
  coachName: string;
  coachId: string;
  flyloopMinutes: number;
};

export type FlyloopProfileStats = {
  flyloopMinutes: number;
  flyloopHours: number;
  campsAttended: number;
  huckJamsAttended: number;
  visitedTunnels: number;
  visitedCountries: number;
  favoriteCoach: string | null;
  favoriteTunnel: string | null;
  campsOrganized: number;
  huckJamsOrganized: number;
  athleteMinutesCoached: number;
};

export type FlyloopProfileHistory = {
  stats: FlyloopProfileStats;
  historyByYear: Array<{ year: string; entries: FlyloopHistoryEntry[] }>;
  achievements: {
    available: false;
    examples: string[];
  };
};

export async function getFlyloopProfileHistory(
  supabase: SupabaseServerClient,
  userId: string,
  now = new Date(),
): Promise<FlyloopProfileHistory> {
  const histories = await getFlyloopProfileHistories(supabase, [userId], now);
  return histories.get(userId) ?? buildFlyloopProfileHistory([], [], [], now);
}

export async function getFlyloopProfileHistories(
  supabase: SupabaseServerClient,
  userIds: string[],
  now = new Date(),
): Promise<Map<string, FlyloopProfileHistory>> {
  const uniqueUserIds = [...new Set(userIds)];

  if (uniqueUserIds.length === 0) {
    return new Map();
  }

  const [campBookingsResult, huckJamInterestsResult, organizedResult] =
    await Promise.all([
      supabase
        .from("opportunity_slot_bookings")
        .select("user_id,minutes,opportunities(id,title,type,status,start_date,end_date,registration_deadline,created_by,tunnel_profiles(id,name,country),profiles!opportunities_created_by_fkey(full_name))")
        .in("user_id", uniqueUserIds),
      supabase
        .from("opportunity_interests")
        .select("athlete_id,opportunities(id,title,type,status,start_date,end_date,registration_deadline,created_by,tunnel_profiles(id,name,country),profiles!opportunities_created_by_fkey(full_name))")
        .in("athlete_id", uniqueUserIds)
        .eq("status", "accepted")
        .neq("interest_type", "timetable_reminder"),
      supabase
        .from("opportunities")
        .select("id,title,type,status,start_date,end_date,registration_deadline,created_by,tunnel_profiles(id,name,country),profiles!opportunities_created_by_fkey(full_name),opportunity_slot_bookings(minutes,user_id)")
        .in("created_by", uniqueUserIds),
    ]);

  if (campBookingsResult.error) {
    console.error("Flyloop camp history lookup failed", campBookingsResult.error);
  }

  if (huckJamInterestsResult.error) {
    console.error("Flyloop Huck Jam history lookup failed", huckJamInterestsResult.error);
  }

  if (organizedResult.error) {
    console.error("Flyloop organized history lookup failed", organizedResult.error);
  }

  const campBookingsByUserId = groupBy(
    (campBookingsResult.data ?? []) as CampBookingRow[],
    (row) => row.user_id,
  );
  const huckJamInterestsByUserId = groupBy(
    (huckJamInterestsResult.data ?? []) as InterestRow[],
    (row) => row.athlete_id,
  );
  const organizedByUserId = groupBy(
    (organizedResult.data ?? []) as OrganizedOpportunityRow[],
    (row) => row.created_by,
  );

  return new Map(
    uniqueUserIds.map(
      (userId) =>
        [
          userId,
          buildFlyloopProfileHistory(
            campBookingsByUserId.get(userId) ?? [],
            huckJamInterestsByUserId.get(userId) ?? [],
            organizedByUserId.get(userId) ?? [],
            now,
          ),
        ] as const,
    ),
  );
}

function buildFlyloopProfileHistory(
  campBookings: CampBookingRow[],
  huckJamInterests: InterestRow[],
  organizedOpportunities: OrganizedOpportunityRow[],
  now: Date,
): FlyloopProfileHistory {
  const entriesByOpportunity = new Map<string, FlyloopHistoryEntry>();
  const countableEntriesByOpportunity = new Map<string, FlyloopHistoryEntry>();

  for (const row of campBookings) {
    const opportunity = firstRelation(row.opportunities);

    if (
      !opportunity ||
      opportunity.type !== "camp"
    ) {
      continue;
    }

    if (isOpportunityCompleted({ endDate: opportunity.end_date }, now)) {
      const current = entriesByOpportunity.get(opportunity.id);
      const nextMinutes = (current?.flyloopMinutes ?? 0) + Number(row.minutes ?? 0);
      entriesByOpportunity.set(opportunity.id, toHistoryEntry(opportunity, nextMinutes));
    }

    if (
      isRegistrationCycleCounted(opportunity, now) &&
      isCountableOpportunityStatus(opportunity.status)
    ) {
      const current = countableEntriesByOpportunity.get(opportunity.id);
      const nextMinutes = (current?.flyloopMinutes ?? 0) + Number(row.minutes ?? 0);
      countableEntriesByOpportunity.set(
        opportunity.id,
        toHistoryEntry(opportunity, nextMinutes),
      );
    }
  }

  for (const row of huckJamInterests) {
    const opportunity = firstRelation(row.opportunities);

    if (
      !opportunity ||
      opportunity.type !== "huck_jam"
    ) {
      continue;
    }

    if (isOpportunityCompleted({ endDate: opportunity.end_date }, now)) {
      if (!entriesByOpportunity.has(opportunity.id)) {
        entriesByOpportunity.set(opportunity.id, toHistoryEntry(opportunity, 0));
      }
    }

    if (
      isRegistrationCycleCounted(opportunity, now) &&
      isCountableOpportunityStatus(opportunity.status)
    ) {
      if (!countableEntriesByOpportunity.has(opportunity.id)) {
        countableEntriesByOpportunity.set(opportunity.id, toHistoryEntry(opportunity, 0));
      }
    }
  }

  const countableHistoryEntries = [...countableEntriesByOpportunity.values()].sort((a, b) =>
    `${b.completedDate} ${b.title}`.localeCompare(`${a.completedDate} ${a.title}`),
  );
  const historyEntries = [...entriesByOpportunity.values()].sort((a, b) =>
    `${b.completedDate} ${b.title}`.localeCompare(`${a.completedDate} ${a.title}`),
  );
  const completedOrganized = organizedOpportunities.filter(
    (opportunity) =>
      isRegistrationCycleCounted(opportunity, now) &&
      isCountableOpportunityStatus(opportunity.status),
  );
  const athleteMinutesCoached = completedOrganized.reduce((total, opportunity) => {
    if (opportunity.type !== "camp") {
      return total;
    }

    const bookings = normalizeArray(opportunity.opportunity_slot_bookings);
    return (
      total +
      bookings.reduce((bookingTotal, booking) => bookingTotal + Number(booking.minutes ?? 0), 0)
    );
  }, 0);
  const countableFlyloopMinutes = countableHistoryEntries.reduce(
    (total, entry) => total + entry.flyloopMinutes,
    0,
  );
  const entriesWithMinutes = countableHistoryEntries.filter(
    (entry) => entry.flyloopMinutes > 0,
  );

  return {
    stats: {
      flyloopMinutes: countableFlyloopMinutes,
      flyloopHours: Number((countableFlyloopMinutes / 60).toFixed(1)),
      campsAttended: countableHistoryEntries.filter((entry) => entry.type === "camp").length,
      huckJamsAttended: countableHistoryEntries.filter((entry) => entry.type === "huck_jam").length,
      visitedTunnels: new Set(
        countableHistoryEntries.map((entry) => entry.tunnelId).filter(Boolean),
      )
        .size,
      visitedCountries: new Set(
        countableHistoryEntries.map((entry) => entry.tunnelCountry).filter(Boolean),
      ).size,
      favoriteCoach: topByMinutes(entriesWithMinutes, (entry) => entry.coachName),
      favoriteTunnel: topByMinutes(entriesWithMinutes, (entry) => entry.tunnelName),
      campsOrganized: completedOrganized.filter((entry) => entry.type === "camp").length,
      huckJamsOrganized: completedOrganized.filter((entry) => entry.type === "huck_jam")
        .length,
      athleteMinutesCoached,
    },
    historyByYear: groupHistoryByYear(historyEntries),
    achievements: {
      available: false,
      examples: [
        "First Camp",
        "First Huck Jam",
        "1000 Flyloop Minutes",
        "5 Tunnels Visited",
        "10 Camps Attended",
      ],
    },
  };
}

function toHistoryEntry(
  opportunity: OpportunityRelation,
  flyloopMinutes: number,
): FlyloopHistoryEntry {
  const tunnel = firstRelation(opportunity.tunnel_profiles);
  const coach = firstRelation(opportunity.profiles);
  const completedDate = opportunity.end_date;

  return {
    opportunityId: opportunity.id,
    title: opportunity.title,
    type: opportunity.type,
    completedDate,
    year: completedDate.slice(0, 4),
    tunnelId: tunnel?.id ?? null,
    tunnelName: tunnel?.name ?? "Tunnel",
    tunnelCountry: tunnel?.country ?? null,
    coachName: coach?.full_name ?? "Coach",
    coachId: opportunity.created_by,
    flyloopMinutes,
  };
}

function groupHistoryByYear(entries: FlyloopHistoryEntry[]) {
  const groups = new Map<string, FlyloopHistoryEntry[]>();

  for (const entry of entries) {
    const yearEntries = groups.get(entry.year) ?? [];
    yearEntries.push(entry);
    groups.set(entry.year, yearEntries);
  }

  return [...groups.entries()]
    .sort(([yearA], [yearB]) => yearB.localeCompare(yearA))
    .map(([year, yearEntries]) => ({
      year,
      entries: yearEntries,
    }));
}

function topByMinutes(
  entries: FlyloopHistoryEntry[],
  getLabel: (entry: FlyloopHistoryEntry) => string,
) {
  const totals = new Map<string, number>();

  for (const entry of entries) {
    const label = getLabel(entry);
    totals.set(label, (totals.get(label) ?? 0) + entry.flyloopMinutes);
  }

  return [...totals.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? null;
}

function firstRelation<T>(value: T | T[] | null | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

function isRegistrationCycleCounted(
  opportunity: {
    registration_deadline: string | null;
  },
  now: Date,
) {
  if (!opportunity.registration_deadline) {
    return false;
  }

  const deadline = new Date(opportunity.registration_deadline);
  return Number.isFinite(deadline.getTime()) && deadline.getTime() < now.getTime();
}

function isCountableOpportunityStatus(
  status: "draft" | "published" | "full" | "cancelled",
) {
  return status !== "draft" && status !== "cancelled";
}

function normalizeArray<T>(value: T | T[] | null | undefined) {
  if (!value) {
    return [];
  }

  return Array.isArray(value) ? value : [value];
}

function groupBy<T>(rows: T[], getKey: (row: T) => string) {
  const groups = new Map<string, T[]>();

  for (const row of rows) {
    const key = getKey(row);
    const group = groups.get(key) ?? [];
    group.push(row);
    groups.set(key, group);
  }

  return groups;
}
