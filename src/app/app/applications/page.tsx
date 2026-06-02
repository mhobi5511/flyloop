import Link from "next/link";
import {
  ApplicationStatusBadge,
  applicantBorderClass,
} from "@/components/ApplicationStatusBadge";
import { AppShell } from "@/components/AppShell";
import { Badge } from "@/components/Badge";
import { WithdrawApplicationButton } from "@/components/WithdrawApplicationButton";
import {
  formatDateRange,
  formatOpportunityType,
  formatPrice,
  formatPriceLabel,
} from "@/lib/opportunities";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import type { InterestStatus, OpportunityType } from "@/lib/types";

type ApplicationRow = {
  id: string;
  status: InterestStatus;
  created_at: string;
  opportunities:
    | {
        id: string;
        title: string;
        type: OpportunityType;
        start_date: string;
        end_date: string;
        price: number | string;
        currency: string;
        tunnel_profiles:
          | { id: string; name: string; city: string | null; country: string | null }
          | Array<{ id: string; name: string; city: string | null; country: string | null }>
          | null;
        coach_profiles:
          | {
              profiles: { full_name: string } | Array<{ full_name: string }> | null;
            }
          | Array<{
              profiles: { full_name: string } | Array<{ full_name: string }> | null;
            }>
          | null;
        profiles:
          | { full_name: string }
          | Array<{ full_name: string }>
          | null;
      }
    | Array<{
        id: string;
        title: string;
        type: OpportunityType;
        start_date: string;
        end_date: string;
        price: number | string;
        currency: string;
        tunnel_profiles:
          | { id: string; name: string; city: string | null; country: string | null }
          | Array<{ id: string; name: string; city: string | null; country: string | null }>
          | null;
        coach_profiles:
          | {
              profiles: { full_name: string } | Array<{ full_name: string }> | null;
            }
          | Array<{
              profiles: { full_name: string } | Array<{ full_name: string }> | null;
            }>
          | null;
        profiles:
          | { full_name: string }
          | Array<{ full_name: string }>
          | null;
      }>;
};

type ApplicationsSearchParams = {
  month?: string;
  tunnel?: string;
};

const activeStatuses: InterestStatus[] = [
  "pending",
  "accepted",
  "waitlist",
];

export default async function ApplicationsPage({
  searchParams,
}: {
  searchParams?: Promise<ApplicationsSearchParams>;
}) {
  const filters = (await searchParams) ?? {};
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const [{ data: profile }, { data: applications }] = await Promise.all([
    supabase
      .from("profiles")
      .select("is_organizer,wants_to_create_opportunities")
      .eq("id", user?.id)
      .maybeSingle(),
    supabase
      .from("opportunity_interests")
      .select("id,status,created_at,opportunities(id,title,type,start_date,end_date,price,currency,tunnel_profiles(id,name,city,country),coach_profiles(profiles(full_name)),profiles!opportunities_created_by_fkey(full_name))")
      .eq("athlete_id", user?.id)
      .order("created_at", { ascending: false }),
  ]);
  const activeRows = ((applications ?? []) as ApplicationRow[]).filter((application) =>
    activeStatuses.includes(application.status),
  );
  const monthOptions = getMonthOptions(activeRows);
  const tunnelOptions = getTunnelOptions(activeRows);
  const selectedMonth = monthOptions.some((option) => option.value === filters.month)
    ? filters.month
    : "";
  const selectedTunnel = tunnelOptions.some((option) => option.id === filters.tunnel)
    ? filters.tunnel
    : "";
  const rows = activeRows.filter((application) => {
    const opportunity = getOpportunity(application);
    const tunnel = opportunity ? getTunnel(opportunity) : null;

    return (
      (!selectedMonth || opportunity?.start_date.slice(0, 7) === selectedMonth) &&
      (!selectedTunnel || tunnel?.id === selectedTunnel)
    );
  });
  const canCreate =
    profile?.is_organizer === true ||
    profile?.wants_to_create_opportunities === true;

  return (
    <AppShell active="applications" canCreate={canCreate} canJoin>
      <div>
        <h1 className="text-2xl font-black tracking-tight sm:text-3xl">My Flights</h1>
      </div>

      <form className="mt-3 grid grid-cols-2 gap-2 sm:flex sm:items-end" action="/app/applications">
        <label className="grid gap-1 text-xs font-bold text-slate-600 sm:w-44">
          Month
          <select
            name="month"
            defaultValue={selectedMonth}
            className="h-10 rounded-xl border border-slate-200 bg-white px-3 text-sm font-semibold text-slate-800 shadow-sm"
          >
            <option value="">All months</option>
            {monthOptions.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </label>
        <label className="grid gap-1 text-xs font-bold text-slate-600 sm:w-56">
          Tunnel
          <select
            name="tunnel"
            defaultValue={selectedTunnel}
            className="h-10 rounded-xl border border-slate-200 bg-white px-3 text-sm font-semibold text-slate-800 shadow-sm"
          >
            <option value="">All tunnels</option>
            {tunnelOptions.map((option) => (
              <option key={option.id} value={option.id}>
                {option.name}
              </option>
            ))}
          </select>
        </label>
        <button
          type="submit"
          className="col-span-2 h-10 rounded-xl bg-slate-950 px-4 text-sm font-black text-white shadow-sm sm:col-span-1"
        >
          Apply
        </button>
      </form>

      <div className="mt-4 grid gap-3">
        {rows.map((application) => {
          const opportunity = getOpportunity(application);

          if (!opportunity) {
            return null;
          }

          const tunnel = getTunnel(opportunity);

          return (
            <article
              key={application.id}
              className={`rounded-2xl border border-slate-200 bg-white p-3 shadow-sm ${applicantBorderClass(application.status)}`}
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <ApplicationStatusBadge status={application.status} />
                    <Badge tone={opportunity.type === "camp" ? "blue" : "green"}>
                      {formatOpportunityType(opportunity.type)}
                    </Badge>
                  </div>
                  <h2 className="mt-2 line-clamp-2 text-base font-black tracking-tight text-slate-950">
                    {opportunity.title}
                  </h2>
                  <div className="mt-2 grid gap-0.5 text-sm text-slate-600">
                    <p className="font-semibold text-slate-700">
                      {tunnel?.name ?? "Tunnel"}
                    </p>
                    <p className="text-xs">
                      {formatDateRange(opportunity.start_date, opportunity.end_date)}
                      {tunnel ? ` · ${formatLocation(tunnel.city, tunnel.country)}` : ""}
                    </p>
                    <p className="text-xs font-semibold text-slate-700">
                      {formatPrice(Number(opportunity.price), opportunity.currency)}{" "}
                      <span className="text-slate-500">
                        {formatPriceLabel(opportunity.type)}
                      </span>
                    </p>
                  </div>
                </div>
                <Link
                  href={`/app/opportunities/${opportunity.id}`}
                  className="shrink-0 rounded-full border border-slate-200 px-3 py-1.5 text-xs font-bold text-slate-700"
                >
                  Details
                </Link>
              </div>
              {application.status === "pending" || application.status === "waitlist" ? (
                <div className="mt-3">
                  <WithdrawApplicationButton interestId={application.id} />
                </div>
              ) : null}
            </article>
          );
        })}
      </div>

      {activeRows.length === 0 ? (
        <div className="mt-5 rounded-2xl border border-slate-200 bg-white p-4 text-sm text-slate-600">
          <p>You have not sent interest for any opportunities yet.</p>
          <Link
            href="/app"
            className="mt-3 inline-flex rounded-full bg-sky-600 px-4 py-2 text-sm font-black text-white"
          >
            Find your next camp
          </Link>
        </div>
      ) : rows.length === 0 ? (
        <p className="mt-5 rounded-2xl border border-slate-200 bg-white p-4 text-sm text-slate-600">
          No flights match those filters.
        </p>
      ) : null}
    </AppShell>
  );
}

function formatLocation(city?: string | null, country?: string | null) {
  if (city && country) {
    return `${city}, ${country}`;
  }

  return city ?? country ?? "Location to be confirmed";
}

function getOpportunity(application: ApplicationRow) {
  return Array.isArray(application.opportunities)
    ? application.opportunities[0]
    : application.opportunities;
}

function getTunnel(opportunity: NonNullable<ReturnType<typeof getOpportunity>>) {
  return Array.isArray(opportunity.tunnel_profiles)
    ? opportunity.tunnel_profiles[0]
    : opportunity.tunnel_profiles;
}

function getMonthOptions(applications: ApplicationRow[]) {
  const months = new Map<string, string>();

  for (const application of applications) {
    const opportunity = getOpportunity(application);

    if (!opportunity?.start_date) {
      continue;
    }

    const value = opportunity.start_date.slice(0, 7);
    months.set(value, formatMonthLabel(value));
  }

  return Array.from(months, ([value, label]) => ({ value, label })).sort((a, b) =>
    a.value.localeCompare(b.value),
  );
}

function getTunnelOptions(applications: ApplicationRow[]) {
  const tunnels = new Map<string, string>();

  for (const application of applications) {
    const opportunity = getOpportunity(application);
    const tunnel = opportunity ? getTunnel(opportunity) : null;

    if (tunnel?.id) {
      tunnels.set(tunnel.id, tunnel.name);
    }
  }

  return Array.from(tunnels, ([id, name]) => ({ id, name })).sort((a, b) =>
    a.name.localeCompare(b.name),
  );
}

function formatMonthLabel(value: string) {
  const [year, month] = value.split("-");
  const date = new Date(Number(year), Number(month) - 1, 1);

  return new Intl.DateTimeFormat("en", {
    month: "long",
    year: "numeric",
  }).format(date);
}
