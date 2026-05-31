import Link from "next/link";
import { Plus } from "lucide-react";
import { publishDraftOpportunity } from "@/app/app/create/actions";
import { AppShell } from "@/components/AppShell";
import { Badge } from "@/components/Badge";
import { formatDateRange, formatOpportunityType } from "@/lib/opportunities";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import type { InterestStatus, OpportunityStatus, OpportunityType } from "@/lib/types";

type DashboardTab = "needs-action" | "upcoming" | "past" | "drafts";

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
  total_capacity: number;
  available_spots: number;
  created_at: string | null;
  updated_at: string | null;
  tunnel_profiles:
    | { name: string; city: string | null; country: string | null }
    | Array<{ name: string; city: string | null; country: string | null }>
    | null;
  opportunity_interests: Array<{ status: InterestStatus }> | null;
};

type OpportunityCardModel = {
  id: string;
  title: string;
  type: OpportunityType;
  status: OpportunityStatus;
  startDate: string;
  endDate: string;
  totalCapacity: number;
  availableSpots: number;
  bookedSpots: number;
  tunnelName: string;
  location: string;
  counts: Record<InterestStatus, number>;
  hasUnread: boolean;
  startsInDays: number;
  urgencyScore: number;
  needsAction: boolean;
  isUpcoming: boolean;
  isPast: boolean;
  isDraft: boolean;
  isFullyBooked: boolean;
  statusTone: "red" | "yellow" | "orange" | "green" | "blue" | "slate";
  statusLabel: string;
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
  {
    key: "needs-action",
    label: "Needs Action",
    empty: "Nothing needs attention right now.",
  },
  { key: "upcoming", label: "Upcoming", empty: "No upcoming opportunities." },
  { key: "past", label: "Past", empty: "No completed opportunities yet." },
  { key: "drafts", label: "Drafts", empty: "No drafts right now." },
];

async function publishDraftFromDashboard(formData: FormData) {
  "use server";

  const opportunityId = formData.get("opportunityId");

  if (typeof opportunityId !== "string") {
    return;
  }

  await publishDraftOpportunity(opportunityId);
}

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
          <h1 className="text-3xl font-black tracking-tight">Organizer</h1>
          <p className="mt-2 text-sm leading-6 text-slate-600">
            Enable organizer mode in your profile to access organizer tools.
          </p>
          <Link
            href="/app/onboarding"
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
        "id,title,type,status,start_date,end_date,total_capacity,available_spots,created_at,updated_at,tunnel_profiles(name,city,country),opportunity_interests(status)",
      )
      .eq("created_by", user?.id)
      .order("start_date", { ascending: true }),
    supabase
      .from("notifications")
      .select("opportunity_id")
      .eq("user_id", user?.id)
      .eq("type", "new_interest")
      .eq("read", false),
  ]);
  const opportunityRows = (opportunities ?? []) as OrganizerOpportunityRow[];
  const unreadOpportunityIds = new Set(
    (unreadNotifications ?? [])
      .map((notification) => notification.opportunity_id)
      .filter((id): id is string => Boolean(id)),
  );
  const today = dateOnly(new Date());
  const cards = opportunityRows.map((row) =>
    toCardModel(row, unreadOpportunityIds.has(row.id), today),
  );
  const kpis = buildKpis(cards);
  const grouped = {
    "needs-action": cards
      .filter((card) => card.needsAction)
      .sort((a, b) => b.urgencyScore - a.urgencyScore || a.sortDate - b.sortDate),
    upcoming: cards
      .filter((card) => card.isUpcoming)
      .sort((a, b) => a.sortDate - b.sortDate),
    past: cards
      .filter((card) => card.isPast)
      .sort((a, b) => b.sortDate - a.sortDate),
    drafts: cards
      .filter((card) => card.isDraft)
      .sort((a, b) => b.sortDate - a.sortDate),
  } satisfies Record<DashboardTab, OpportunityCardModel[]>;
  const activeCards = grouped[activeTab];
  const activeEmpty = tabs.find((tab) => tab.key === activeTab)?.empty;

  return (
    <AppShell active="dashboard" canCreate>
      <div className="flex items-start justify-between gap-3">
        <div>
          <h1 className="text-3xl font-black tracking-tight">Organizer</h1>
          <p className="mt-1 text-sm font-semibold text-slate-500">
            Focus on applicants, open spots, and the opportunities closest to start.
          </p>
        </div>
        <Link
          href="/app/create"
          className="flex h-11 shrink-0 items-center gap-2 rounded-xl bg-sky-600 px-4 text-sm font-bold text-white"
        >
          <Plus size={17} /> New
        </Link>
      </div>

      <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-5">
        <Kpi label="Published" value={kpis.published} />
        <Kpi label="Pending" value={kpis.pending} />
        <Kpi label="Accepted" value={kpis.accepted} />
        <Kpi label="Waitlist" value={kpis.waitlist} />
        <Kpi label="Open Spots" value={kpis.openSpots} />
      </div>

      <div className="mt-4 overflow-x-auto">
        <div className="inline-flex min-w-full gap-1 rounded-2xl border border-slate-200 bg-white p-1 shadow-sm sm:min-w-0">
          {tabs.map((tab) => (
            <Link
              key={tab.key}
              href={tab.key === "needs-action" ? "/app/dashboard" : `/app/dashboard?tab=${tab.key}`}
              className={`flex-1 whitespace-nowrap rounded-xl px-3 py-2 text-center text-xs font-black transition sm:flex-none ${
                activeTab === tab.key
                  ? "bg-slate-950 text-white"
                  : "text-slate-600 hover:bg-slate-50"
              }`}
            >
              {tab.label}
              <span className="ml-1 text-[0.68rem] opacity-70">
                {grouped[tab.key].length}
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
            showDraftActions={activeTab === "drafts"}
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
  return tabs.some((item) => item.key === tab) ? (tab as DashboardTab) : "needs-action";
}

function toCardModel(
  opportunity: OrganizerOpportunityRow,
  hasUnread: boolean,
  today: string,
): OpportunityCardModel {
  const tunnel = Array.isArray(opportunity.tunnel_profiles)
    ? opportunity.tunnel_profiles[0]
    : opportunity.tunnel_profiles;
  const interests = opportunity.opportunity_interests ?? [];
  const counts = Object.fromEntries(
    statuses.map((status) => [
      status,
      interests.filter((interest) => interest.status === status).length,
    ]),
  ) as Record<InterestStatus, number>;
  const startsInDays = daysBetween(today, opportunity.start_date);
  const isDraft = opportunity.status === "draft";
  const isCancelled = opportunity.status === "cancelled";
  const isPast = !isDraft && opportunity.end_date < today;
  const isUpcoming = !isDraft && !isCancelled && opportunity.start_date >= today;
  const activeForAttention = !isDraft && !isCancelled && opportunity.end_date >= today;
  const startsSoonOpen =
    activeForAttention &&
    opportunity.status === "published" &&
    opportunity.available_spots > 0 &&
    startsInDays >= 0 &&
    startsInDays <= 7;
  const largeWaitlist = counts.waitlist >= 5;
  const manyUnread = hasUnread && counts.pending + counts.waitlist >= 4;
  const highPriority =
    (startsSoonOpen && startsInDays <= 2) || largeWaitlist || manyUnread;
  const needsAction =
    activeForAttention &&
    (hasUnread || counts.pending > 0 || counts.waitlist > 0 || startsSoonOpen);
  const isFullyBooked =
    opportunity.status === "full" || opportunity.available_spots <= 0;
  const bookedSpots = Math.min(
    opportunity.total_capacity,
    Math.max(counts.accepted, opportunity.total_capacity - opportunity.available_spots),
  );
  const urgencyScore =
    (highPriority ? 1000 : 0) +
    (hasUnread ? 300 : 0) +
    counts.pending * 90 +
    counts.waitlist * 70 +
    (startsSoonOpen ? Math.max(20, 180 - startsInDays * 20) : 0);
  const statusTone = getStatusTone({
    highPriority,
    pending: counts.pending,
    startsSoonOpen,
    isFullyBooked,
    status: opportunity.status,
  });

  return {
    id: opportunity.id,
    title: opportunity.title,
    type: opportunity.type,
    status: opportunity.status,
    startDate: opportunity.start_date,
    endDate: opportunity.end_date,
    totalCapacity: opportunity.total_capacity,
    availableSpots: opportunity.available_spots,
    bookedSpots,
    tunnelName: tunnel?.name ?? "Tunnel",
    location: formatLocation(tunnel?.city, tunnel?.country),
    counts,
    hasUnread,
    startsInDays,
    urgencyScore,
    needsAction,
    isUpcoming,
    isPast,
    isDraft,
    isFullyBooked,
    statusTone,
    statusLabel: getStatusLabel(statusTone, opportunity.status),
    sortDate: Date.parse(
      isDraft
        ? opportunity.updated_at ?? opportunity.created_at ?? opportunity.start_date
        : opportunity.start_date,
    ),
  };
}

function getStatusTone({
  highPriority,
  pending,
  startsSoonOpen,
  isFullyBooked,
  status,
}: {
  highPriority: boolean;
  pending: number;
  startsSoonOpen: boolean;
  isFullyBooked: boolean;
  status: OpportunityStatus;
}): OpportunityCardModel["statusTone"] {
  if (highPriority) {
    return "red";
  }

  if (pending > 0) {
    return "yellow";
  }

  if (startsSoonOpen) {
    return "orange";
  }

  if (isFullyBooked) {
    return "green";
  }

  if (status === "published") {
    return "blue";
  }

  return "slate";
}

function getStatusLabel(
  tone: OpportunityCardModel["statusTone"],
  status: OpportunityStatus,
) {
  if (tone === "red") {
    return "High priority";
  }

  if (tone === "yellow") {
    return "Review applicants";
  }

  if (tone === "orange") {
    return "Starts soon";
  }

  if (tone === "green") {
    return "Fully booked";
  }

  if (tone === "blue") {
    return "Healthy";
  }

  return status;
}

function buildKpis(opportunities: OpportunityCardModel[]) {
  const activePublished = opportunities.filter(
    (opportunity) =>
      (opportunity.status === "published" || opportunity.status === "full") &&
      !opportunity.isPast,
  );

  return {
    published: activePublished.length,
    pending: opportunities.reduce((sum, item) => sum + item.counts.pending, 0),
    accepted: opportunities.reduce((sum, item) => sum + item.counts.accepted, 0),
    waitlist: opportunities.reduce((sum, item) => sum + item.counts.waitlist, 0),
    openSpots: activePublished.reduce(
      (sum, item) => sum + Math.max(item.availableSpots, 0),
      0,
    ),
  };
}

function OpportunityCard({
  opportunity,
  showDraftActions,
}: {
  opportunity: OpportunityCardModel;
  showDraftActions: boolean;
}) {
  return (
    <div
      className={`rounded-2xl border border-slate-200 border-l-4 bg-white p-3 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md ${borderClass(
        opportunity.statusTone,
      )}`}
    >
      <Link href={`/app/organizer/opportunities/${opportunity.id}`}>
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-1.5">
              <Badge tone={opportunity.type === "camp" ? "blue" : "green"}>
                {formatOpportunityType(opportunity.type)}
              </Badge>
              <span className={`rounded-full px-2 py-0.5 text-[0.68rem] font-black ${pillClass(opportunity.statusTone)}`}>
                {opportunity.statusLabel}
              </span>
              {opportunity.hasUnread ? <Badge tone="blue">New</Badge> : null}
            </div>
            <h2 className="mt-2 line-clamp-1 text-base font-black tracking-tight text-slate-950">
              {opportunity.title}
            </h2>
            <p className="mt-1 line-clamp-1 text-xs font-semibold text-slate-600">
              {opportunity.tunnelName}
              {opportunity.location ? `, ${opportunity.location}` : ""}
            </p>
            <p className="mt-0.5 text-xs font-semibold text-slate-500">
              {formatDateRange(opportunity.startDate, opportunity.endDate)}
            </p>
          </div>
          <div className="shrink-0 text-right">
            <p className="text-sm font-black text-slate-950">
              {opportunity.bookedSpots}/{opportunity.totalCapacity}
            </p>
            <p className="text-[0.68rem] font-bold text-slate-500">booked</p>
          </div>
        </div>
        <div className="mt-3 flex flex-wrap gap-1.5 text-xs font-black">
          <StatusChip value={opportunity.counts.pending} label="pending" tone="amber" />
          <StatusChip value={opportunity.counts.waitlist} label="waitlist" tone="sky" />
          <StatusChip
            value={opportunity.availableSpots}
            label="open"
            tone={opportunity.availableSpots > 0 ? "emerald" : "slate"}
          />
        </div>
      </Link>

      {showDraftActions ? (
        <div className="mt-3 flex flex-wrap gap-2 border-t border-slate-100 pt-3">
          <Link
            href={`/app/organizer/opportunities/${opportunity.id}/edit`}
            className="inline-flex h-9 items-center rounded-xl border border-slate-200 px-3 text-xs font-black text-slate-700 transition hover:bg-slate-50"
          >
            Edit
          </Link>
          <form action={publishDraftFromDashboard}>
            <input type="hidden" name="opportunityId" value={opportunity.id} />
            <button
              type="submit"
              className="inline-flex h-9 items-center rounded-xl bg-sky-600 px-3 text-xs font-black text-white transition hover:bg-sky-700"
            >
              Publish
            </button>
          </form>
        </div>
      ) : null}
    </div>
  );
}

function Kpi({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white px-3 py-2 shadow-sm">
      <p className="text-lg font-black leading-none text-slate-950">{value}</p>
      <p className="mt-1 truncate text-[0.68rem] font-bold uppercase text-slate-500">
        {label}
      </p>
    </div>
  );
}

function StatusChip({
  value,
  label,
  tone,
}: {
  value: number;
  label: string;
  tone: "amber" | "sky" | "emerald" | "slate";
}) {
  const classes = {
    amber: "bg-amber-50 text-amber-800",
    sky: "bg-sky-50 text-sky-700",
    emerald: "bg-emerald-50 text-emerald-700",
    slate: "bg-slate-100 text-slate-600",
  };

  return (
    <span className={`rounded-full px-2 py-1 ${classes[tone]}`}>
      {value} {label}
    </span>
  );
}

function borderClass(tone: OpportunityCardModel["statusTone"]) {
  const classes = {
    red: "border-l-rose-500",
    yellow: "border-l-amber-400",
    orange: "border-l-orange-500",
    green: "border-l-emerald-500",
    blue: "border-l-sky-500",
    slate: "border-l-slate-300",
  };

  return classes[tone];
}

function pillClass(tone: OpportunityCardModel["statusTone"]) {
  const classes = {
    red: "bg-rose-50 text-rose-700",
    yellow: "bg-amber-50 text-amber-800",
    orange: "bg-orange-50 text-orange-700",
    green: "bg-emerald-50 text-emerald-700",
    blue: "bg-sky-50 text-sky-700",
    slate: "bg-slate-100 text-slate-600",
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
