import type { createSupabaseServerClient } from "@/lib/supabase/server";
import { isOpportunityCompleted } from "@/lib/opportunity-lifecycle";

type SupabaseServerClient = Awaited<ReturnType<typeof createSupabaseServerClient>>;

type OpportunityRelation = {
  id: string;
  title: string;
  type: "camp" | "huck_jam";
  start_date: string;
  end_date: string;
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
  minutes: number;
  opportunities: OpportunityRelation | OpportunityRelation[] | null;
};

type InterestRow = {
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
  const [campBookingsResult, huckJamInterestsResult, organizedResult] =
    await Promise.all([
      supabase
        .from("opportunity_slot_bookings")
        .select("minutes,opportunities(id,title,type,start_date,end_date,created_by,tunnel_profiles(id,name,country),profiles!opportunities_created_by_fkey(full_name))")
        .eq("user_id", userId),
      supabase
        .from("opportunity_interests")
        .select("opportunities(id,title,type,start_date,end_date,created_by,tunnel_profiles(id,name,country),profiles!opportunities_created_by_fkey(full_name))")
        .eq("athlete_id", userId)
        .eq("status", "accepted")
        .neq("interest_type", "timetable_reminder"),
      supabase
        .from("opportunities")
        .select("id,title,type,start_date,end_date,created_by,tunnel_profiles(id,name,country),profiles!opportunities_created_by_fkey(full_name),opportunity_slot_bookings(minutes,user_id)")
        .eq("created_by", userId),
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

  const entriesByOpportunity = new Map<string, FlyloopHistoryEntry>();

  for (const row of (campBookingsResult.data ?? []) as CampBookingRow[]) {
    const opportunity = firstRelation(row.opportunities);

    if (
      !opportunity ||
      opportunity.type !== "camp" ||
      !isOpportunityCompleted({ endDate: opportunity.end_date }, now)
    ) {
      continue;
    }

    const current = entriesByOpportunity.get(opportunity.id);
    const nextMinutes = (current?.flyloopMinutes ?? 0) + Number(row.minutes ?? 0);
    entriesByOpportunity.set(opportunity.id, toHistoryEntry(opportunity, nextMinutes));
  }

  for (const row of (huckJamInterestsResult.data ?? []) as InterestRow[]) {
    const opportunity = firstRelation(row.opportunities);

    if (
      !opportunity ||
      opportunity.type !== "huck_jam" ||
      !isOpportunityCompleted({ endDate: opportunity.end_date }, now)
    ) {
      continue;
    }

    if (!entriesByOpportunity.has(opportunity.id)) {
      entriesByOpportunity.set(opportunity.id, toHistoryEntry(opportunity, 0));
    }
  }

  const historyEntries = [...entriesByOpportunity.values()].sort((a, b) =>
    `${b.completedDate} ${b.title}`.localeCompare(`${a.completedDate} ${a.title}`),
  );
  const completedOrganized = ((organizedResult.data ?? []) as OrganizedOpportunityRow[])
    .filter((opportunity) =>
      isOpportunityCompleted({ endDate: opportunity.end_date }, now),
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
  const flyloopMinutes = historyEntries.reduce(
    (total, entry) => total + entry.flyloopMinutes,
    0,
  );
  const entriesWithMinutes = historyEntries.filter((entry) => entry.flyloopMinutes > 0);

  return {
    stats: {
      flyloopMinutes,
      flyloopHours: Number((flyloopMinutes / 60).toFixed(1)),
      campsAttended: historyEntries.filter((entry) => entry.type === "camp").length,
      huckJamsAttended: historyEntries.filter((entry) => entry.type === "huck_jam").length,
      visitedTunnels: new Set(historyEntries.map((entry) => entry.tunnelId).filter(Boolean))
        .size,
      visitedCountries: new Set(
        historyEntries.map((entry) => entry.tunnelCountry).filter(Boolean),
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

function normalizeArray<T>(value: T | T[] | null | undefined) {
  if (!value) {
    return [];
  }

  return Array.isArray(value) ? value : [value];
}
