import Link from "next/link";
import { Monitor, Plus } from "lucide-react";
import { AppShell } from "@/components/AppShell";
import { Badge } from "@/components/Badge";
import { NotificationCountBadge } from "@/components/NotificationCountBadge";
import {
  formatOpportunityDate,
  formatOpportunityType,
  formatSessionTimeRange,
} from "@/lib/opportunities";
import {
  countUnreadByOpportunity,
  organizerActivityNotificationTypes,
} from "@/lib/notifications";
import { isOpportunityCompleted } from "@/lib/opportunity-lifecycle";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import type { InterestStatus, OpportunityStatus, OpportunityType } from "@/lib/types";

type DashboardTab = "camps" | "huck-jams" | "past";

type OrganizerSearchParams = {
  tab?: string | string[];
};

type OrganizerOpportunityRow = {
  id: string;
  title: string;
  type: OpportunityType;
  status: OpportunityStatus;
  start_date: string;
  end_date: string;
  session_start: string | null;
  session_end: string | null;
  registration_deadline: string | null;
  total_capacity: number;
  available_spots: number;
  created_at: string | null;
  updated_at: string | null;
  tunnel_profiles:
    | { name: string; city: string | null; country: string | null }
    | Array<{ name: string; city: string | null; country: string | null }>
    | null;
  opportunity_interests:
    | Array<{
        status: InterestStatus;
        interest_type: string | null;
        created_at: string | null;
      }>
    | null;
};

type HealthStatus = "healthy" | "needs-attention" | "urgent";

type Health = {
  status: HealthStatus;
  label: "Healthy" | "Needs Attention" | "Urgent";
  explanation: string;
  tone: "green" | "yellow" | "red";
  priority: number;
};

type OpportunityCardModel = {
  id: string;
  title: string;
  type: OpportunityType;
  status: OpportunityStatus;
  startDate: string;
  endDate: string;
  sessionStart: string | null;
  sessionEnd: string | null;
  totalCapacity: number;
  availableSpots: number;
  bookedSpots: number;
  tunnelName: string;
  location: string;
  counts: Record<InterestStatus, number>;
  unreadNotificationCount: number;
  startsInDays: number;
  urgencyScore: number;
  needsAction: boolean;
  isUpcoming: boolean;
  isPast: boolean;
  isDraft: boolean;
  isFullyBooked: boolean;
  health: Health;
  sortDate: number;
};

const statuses: InterestStatus[] = [
  "pending",
  "accepted",
  "declined",
  "waitlist",
  "withdrawn",
];

const tabs: Array<{ key: DashboardTab; label: string; empty: string }> = [
  { key: "camps", label: "Camps", empty: "No upcoming camps." },
  { key: "huck-jams", label: "Huck Jams", empty: "No upcoming Huck Jams." },
  { key: "past", label: "Past", empty: "No completed opportunities yet." },
];

export default async function OrganizerDashboardPage({
  searchParams,
}: {
  searchParams?: Promise<OrganizerSearchParams>;
}) {
  const resolvedSearchParams = searchParams ? await searchParams : {};
  const activeTab = normalizeTab(resolvedSearchParams.tab);
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const { data: profile } = await supabase
    .from("profiles")
    .select("is_organizer,wants_to_create_opportunities")
    .eq("id", user?.id)
    .maybeSingle();
  const canCreate =
    profile?.is_organizer === true ||
    profile?.wants_to_create_opportunities === true;

  if (!canCreate) {
    return (
      <AppShell active="dashboard" canCreate={false}>
        <div className="mx-auto max-w-2xl rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
          <h1 className="text-3xl font-black tracking-tight">My Coachings</h1>
          <p className="mt-2 text-sm leading-6 text-slate-600">
            Enable organizer mode in your profile to access organizer tools.
          </p>
          <Link
            href="/app/profile"
            className="mt-4 inline-flex h-11 items-center rounded-xl bg-sky-600 px-4 text-sm font-bold text-white"
          >
            Open profile
          </Link>
        </div>
      </AppShell>
    );
  }

  const [{ data: opportunities }, { data: unreadNotifications }] = await Promise.all([
    supabase
      .from("opportunities")
      .select(
        "id,title,type,status,start_date,end_date,session_start,session_end,registration_deadline,total_capacity,available_spots,created_at,updated_at,tunnel_profiles(name,city,country),opportunity_interests(status,interest_type,created_at)",
      )
      .eq("created_by", user?.id)
      .order("start_date", { ascending: true }),
    supabase
      .from("notifications")
      .select("opportunity_id")
      .eq("user_id", user?.id)
      .eq("read", false)
      .in("type", [...organizerActivityNotificationTypes]),
  ]);
  const opportunityRows = (opportunities ?? []) as OrganizerOpportunityRow[];
  const unreadCountsByOpportunity = countUnreadByOpportunity(unreadNotifications ?? []);
  const today = dateOnly(new Date());
  const now = new Date();
  const cards = opportunityRows.map((row) =>
    toCardModel(row, unreadCountsByOpportunity.get(row.id) ?? 0, today, now),
  );
  const grouped = {
    camps: cards
      .filter((card) => card.isUpcoming && card.type === "camp")
      .sort(
        (a, b) =>
          b.health.priority - a.health.priority ||
          b.urgencyScore - a.urgencyScore ||
          a.sortDate - b.sortDate,
      ),
    "huck-jams": cards
      .filter((card) => card.isUpcoming && card.type === "huck_jam")
      .sort(
        (a, b) =>
          b.health.priority - a.health.priority ||
          b.urgencyScore - a.urgencyScore ||
          a.sortDate - b.sortDate,
      ),
    past: cards
      .filter((card) => card.isPast)
      .sort((a, b) => b.sortDate - a.sortDate),
  } satisfies Record<DashboardTab, OpportunityCardModel[]>;
  const groupedUnreadCounts = Object.fromEntries(
    tabs.map((tab) => [
      tab.key,
      grouped[tab.key].reduce(
        (total, card) => total + card.unreadNotificationCount,
        0,
      ),
    ]),
  ) as Record<DashboardTab, number>;
  const activeCards = grouped[activeTab];
  const activeEmpty = tabs.find((tab) => tab.key === activeTab)?.empty;

  return (
    <AppShell active="dashboard" canCreate>
      <div className="flex items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-black tracking-tight sm:text-3xl">
            My Coachings
          </h1>
        </div>
        <Link
          href="/app/create"
          className="flex h-10 shrink-0 items-center gap-1.5 rounded-xl bg-sky-600 px-3 text-sm font-bold text-white sm:h-11 sm:gap-2 sm:px-4"
        >
          <Plus size={17} /> New
        </Link>
      </div>

      <div className="mt-3">
        <Link
          href="/app/coach-dashboard"
          target="_blank"
          rel="noreferrer"
          className="mb-2 hidden h-11 items-center justify-center gap-2 rounded-xl border border-sky-200 bg-sky-50 px-3 text-sm font-black text-sky-700 transition hover:bg-sky-100 md:inline-flex"
        >
          <Monitor size={17} /> Open Coach Dashboard
        </Link>
        <div className="grid grid-cols-3 gap-1 rounded-xl border border-slate-200 bg-white p-1 shadow-sm">
          {tabs.map((tab) => (
            <Link
              key={tab.key}
              href={tab.key === "camps" ? "/app/dashboard" : `/app/dashboard?tab=${tab.key}`}
              className={`min-w-0 rounded-lg px-1.5 py-1.5 text-center text-[0.7rem] font-black transition sm:px-3 sm:py-2 sm:text-xs ${
                activeTab === tab.key
                  ? "bg-slate-950 text-white"
                  : "text-slate-600 hover:bg-slate-50"
              }`}
            >
              <span className="truncate">
                {tab.label}
                {groupedUnreadCounts[tab.key] > 0
                  ? ` (${groupedUnreadCounts[tab.key]})`
                  : ""}
              </span>
            </Link>
          ))}
        </div>
      </div>

      <div className="mt-4 grid gap-2">
        {activeCards.map((opportunity) => (
          <OpportunityCard
            key={opportunity.id}
            opportunity={opportunity}
          />
        ))}
      </div>

      {activeCards.length === 0 ? (
        <p className="mt-4 rounded-2xl border border-slate-200 bg-white p-4 text-sm font-semibold text-slate-600">
          {activeEmpty}
        </p>
      ) : null}
    </AppShell>
  );
}

function normalizeTab(value: OrganizerSearchParams["tab"]): DashboardTab {
  const tab = Array.isArray(value) ? value[0] : value;
  return tabs.some((item) => item.key === tab) ? (tab as DashboardTab) : "camps";
}

function toCardModel(
  opportunity: OrganizerOpportunityRow,
  unreadNotificationCount: number,
  today: string,
  now: Date,
): OpportunityCardModel {
  const tunnel = Array.isArray(opportunity.tunnel_profiles)
    ? opportunity.tunnel_profiles[0]
    : opportunity.tunnel_profiles;
  const interests = (opportunity.opportunity_interests ?? []).filter(
    (interest) => interest.interest_type !== "timetable_reminder",
  );
  const counts = Object.fromEntries(
    statuses.map((status) => [
      status,
      interests.filter((interest) => interest.status === status).length,
    ]),
  ) as Record<InterestStatus, number>;
  const startsInDays = daysBetween(today, opportunity.start_date);
  const isDraft = opportunity.status === "draft";
  const isCancelled = opportunity.status === "cancelled";
  const isPast =
    !isDraft &&
    isOpportunityCompleted(
      {
        endDate: opportunity.end_date,
        registrationDeadline: opportunity.registration_deadline,
      },
      now,
    );
  const isUpcoming = !isDraft && !isCancelled && opportunity.start_date >= today;
  const activeForAttention = !isDraft && !isCancelled;
  const isFullyBooked =
    opportunity.status === "full" || opportunity.available_spots <= 0;
  const bookedSpots = Math.min(
    opportunity.total_capacity,
    Math.max(counts.accepted, opportunity.total_capacity - opportunity.available_spots),
  );
  const health = getOpportunityHealth({
    opportunity,
    counts,
    bookedSpots,
    isFullyBooked,
    startsInDays,
    now,
  });
  const needsAction =
    activeForAttention &&
    (health.status === "urgent" ||
      health.status === "needs-attention" ||
      unreadNotificationCount > 0);
  const urgencyScore =
    health.priority * 500 +
    (unreadNotificationCount > 0 ? 300 + unreadNotificationCount * 10 : 0) +
    counts.pending * 90 +
    counts.waitlist * 70 +
    (startsInDays >= 0 && startsInDays <= 14
      ? Math.max(20, 180 - startsInDays * 10)
      : 0);

  return {
    id: opportunity.id,
    title: opportunity.title,
    type: opportunity.type,
    status: opportunity.status,
    startDate: opportunity.start_date,
    endDate: opportunity.end_date,
    sessionStart: opportunity.session_start,
    sessionEnd: opportunity.session_end,
    totalCapacity: opportunity.total_capacity,
    availableSpots: opportunity.available_spots,
    bookedSpots,
    tunnelName: tunnel?.name ?? "Tunnel",
    location: formatLocation(tunnel?.city, tunnel?.country),
    counts,
    unreadNotificationCount,
    startsInDays,
    urgencyScore,
    needsAction,
    isUpcoming,
    isPast,
    isDraft,
    isFullyBooked,
    health,
    sortDate: Date.parse(
      isDraft
        ? opportunity.updated_at ?? opportunity.created_at ?? opportunity.start_date
        : opportunity.start_date,
    ),
  };
}

function getOpportunityHealth({
  opportunity,
  counts,
  bookedSpots,
  isFullyBooked,
  startsInDays,
  now,
}: {
  opportunity: OrganizerOpportunityRow;
  counts: Record<InterestStatus, number>;
  bookedSpots: number;
  isFullyBooked: boolean;
  startsInDays: number;
  now: Date;
}): Health {
  const capacity = Math.max(opportunity.total_capacity, 1);
  const bookedRatio = bookedSpots / capacity;
  const capacityNoun =
    opportunity.type === "huck_jam" ? "participants" : "spots";
  const oldestPendingAgeDays = getOldestPendingAgeDays(
    (opportunity.opportunity_interests ?? []).filter(
      (interest) => interest.interest_type !== "timetable_reminder",
    ),
    now,
  );
  const today = dateOnly(now);
  const deadlineInDays = opportunity.registration_deadline
    ? daysBetween(today, opportunity.registration_deadline)
    : null;

  if (isFullyBooked) {
    return {
      status: "healthy",
      label: "Healthy",
      explanation: "Fully booked",
      tone: "green",
      priority: 1,
    };
  }

  if (bookedRatio < 0.25) {
    return {
      status: "urgent",
      label: "Urgent",
      explanation: `${bookedSpots}/${opportunity.total_capacity} ${capacityNoun} filled`,
      tone: "red",
      priority: 3,
    };
  }

  if (startsInDays >= 0 && startsInDays <= 7 && bookedRatio < 0.75) {
    return {
      status: "urgent",
      label: "Urgent",
      explanation: `Starts in ${formatDays(startsInDays)}`,
      tone: "red",
      priority: 3,
    };
  }

  if (deadlineInDays !== null && deadlineInDays >= 0 && deadlineInDays <= 3) {
    return {
      status: "urgent",
      label: "Urgent",
      explanation: `Registration closes in ${formatDays(deadlineInDays)}`,
      tone: "red",
      priority: 3,
    };
  }

  if (oldestPendingAgeDays !== null && oldestPendingAgeDays >= 3) {
    return {
      status: "urgent",
      label: "Urgent",
      explanation: `Pending applications waiting ${oldestPendingAgeDays} days`,
      tone: "red",
      priority: 3,
    };
  }

  if (counts.pending > 0) {
    return {
      status: "needs-attention",
      label: "Needs Attention",
      explanation: `${counts.pending} pending ${pluralize("application", counts.pending)}`,
      tone: "yellow",
      priority: 2,
    };
  }

  if (counts.waitlist > 0) {
    return {
      status: "needs-attention",
      label: "Needs Attention",
      explanation: `${counts.waitlist} waitlist ${pluralize("application", counts.waitlist)}`,
      tone: "yellow",
      priority: 2,
    };
  }

  if (startsInDays >= 0 && startsInDays <= 30 && bookedRatio < 0.75) {
    return {
      status: "needs-attention",
      label: "Needs Attention",
      explanation: `${bookedSpots}/${opportunity.total_capacity} ${capacityNoun} filled`,
      tone: "yellow",
      priority: 2,
    };
  }

  return {
    status: "healthy",
    label: "Healthy",
    explanation:
      bookedRatio >= 0.75
        ? `${bookedSpots}/${opportunity.total_capacity} ${capacityNoun} filled`
        : startsInDays > 30
          ? `Starts in ${formatDays(startsInDays)}`
          : `${bookedSpots}/${opportunity.total_capacity} ${capacityNoun} filled`,
    tone: "green",
    priority: 1,
  };
}

function OpportunityCard({ opportunity }: { opportunity: OpportunityCardModel }) {
  return (
    <Link
      href={`/app/organizer/opportunities/${opportunity.id}`}
      className={`relative block rounded-2xl border border-slate-200 border-l-4 bg-white p-3 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md ${borderClass(
        opportunity.health.tone,
      )}`}
    >
      <NotificationCountBadge count={opportunity.unreadNotificationCount} />
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-1.5">
            <Badge tone={opportunity.type === "camp" ? "blue" : "green"}>
              {formatOpportunityType(opportunity.type)}
            </Badge>
            <span className={`rounded-full px-2 py-0.5 text-[0.68rem] font-black ${pillClass(opportunity.health.tone)}`}>
              {opportunity.health.label}
            </span>
          </div>
          <p className="mt-1 text-xs font-semibold text-slate-600">
            {opportunity.health.explanation}
          </p>
          <h2 className="mt-2 line-clamp-1 text-base font-black tracking-tight text-slate-950">
            {opportunity.title}
          </h2>
          <p className="mt-1 line-clamp-1 text-xs font-semibold text-slate-600">
            {opportunity.tunnelName}
            {opportunity.location ? `, ${opportunity.location}` : ""}
          </p>
          <p className="mt-0.5 text-xs font-semibold text-slate-500">
            {formatOpportunityDate(
              opportunity.type,
              opportunity.startDate,
              opportunity.endDate,
            )}
            {opportunity.type === "huck_jam"
              ? `, ${
                  formatSessionTimeRange(
                    opportunity.sessionStart,
                    opportunity.sessionEnd,
                  ) || "Time to be confirmed"
                }`
              : ""}
          </p>
        </div>
        <div className="shrink-0 pr-3 text-right">
          <p className="text-sm font-black text-slate-950">
            {opportunity.bookedSpots}/{opportunity.totalCapacity}
          </p>
          <p className="text-[0.68rem] font-bold text-slate-500">
            {opportunity.type === "huck_jam" ? "participants" : "booked"}
          </p>
        </div>
      </div>
      <p className="mt-2 text-xs font-black text-slate-700">
        {opportunity.isFullyBooked
          ? opportunity.type === "huck_jam"
            ? "Session full"
            : "Fully booked"
          : `${opportunity.availableSpots} open ${pluralize(
              opportunity.type === "huck_jam" ? "participant spot" : "spot",
              opportunity.availableSpots,
            )}`}
      </p>
    </Link>
  );
}

function borderClass(tone: Health["tone"]) {
  const classes = {
    red: "border-l-rose-500",
    yellow: "border-l-amber-400",
    green: "border-l-emerald-500",
  };

  return classes[tone];
}

function pillClass(tone: Health["tone"]) {
  const classes = {
    red: "bg-rose-50 text-rose-700",
    yellow: "bg-amber-50 text-amber-800",
    green: "bg-emerald-50 text-emerald-700",
  };

  return classes[tone];
}

function formatLocation(city?: string | null, country?: string | null) {
  if (city && country) {
    return `${city}, ${country}`;
  }

  return city ?? country ?? "";
}

function dateOnly(date: Date) {
  return date.toISOString().slice(0, 10);
}

function daysBetween(fromDate: string, toDate: string) {
  const from = Date.parse(`${fromDate}T00:00:00.000Z`);
  const to = Date.parse(`${toDate}T00:00:00.000Z`);
  return Math.floor((to - from) / 86_400_000);
}

function getOldestPendingAgeDays(
  interests: Array<{ status: InterestStatus; created_at: string | null }>,
  now: Date,
) {
  const pendingAges = interests
    .filter((interest) => interest.status === "pending" && interest.created_at)
    .map((interest) => {
      const createdAt = Date.parse(interest.created_at as string);
      return Number.isFinite(createdAt)
        ? Math.floor((now.getTime() - createdAt) / 86_400_000)
        : null;
    })
    .filter((age): age is number => age !== null);

  return pendingAges.length > 0 ? Math.max(...pendingAges) : null;
}

function formatDays(days: number) {
  if (days <= 0) {
    return "today";
  }

  if (days === 1) {
    return "1 day";
  }

  return `${days} days`;
}

function pluralize(word: string, count: number) {
  return count === 1 ? word : `${word}s`;
}
