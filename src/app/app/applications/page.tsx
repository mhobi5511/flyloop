import Link from "next/link";
import type { ReactNode } from "react";
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
          | { name: string; city: string | null; country: string | null }
          | Array<{ name: string; city: string | null; country: string | null }>
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
          | { name: string; city: string | null; country: string | null }
          | Array<{ name: string; city: string | null; country: string | null }>
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
  status?: string;
};

const statusOptions: InterestStatus[] = [
  "pending",
  "accepted",
  "waitlist",
  "declined",
  "withdrawn",
];

export default async function ApplicationsPage({
  searchParams,
}: {
  searchParams?: Promise<ApplicationsSearchParams>;
}) {
  const filters = (await searchParams) ?? {};
  const selectedStatus = statusOptions.includes(filters.status as InterestStatus)
    ? (filters.status as InterestStatus)
    : null;
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
      .select("id,status,created_at,opportunities(id,title,type,start_date,end_date,price,currency,tunnel_profiles(name,city,country),coach_profiles(profiles(full_name)),profiles!opportunities_created_by_fkey(full_name))")
      .eq("athlete_id", user?.id)
      .order("created_at", { ascending: false }),
  ]);
  const rows = ((applications ?? []) as ApplicationRow[]).filter(
    (application) => !selectedStatus || application.status === selectedStatus,
  );
  const canCreate =
    profile?.is_organizer === true ||
    profile?.wants_to_create_opportunities === true;

  return (
    <AppShell active="applications" canCreate={canCreate} canJoin>
      <div>
        <h1 className="text-2xl font-black tracking-tight sm:text-3xl">Applications</h1>
      </div>

      <div className="mt-3 flex gap-2 overflow-x-auto pb-1">
        <StatusLink href="/app/applications" active={!selectedStatus}>
          All
        </StatusLink>
        {statusOptions.map((status) => (
          <StatusLink
            key={status}
            href={`/app/applications?status=${status}`}
            active={selectedStatus === status}
          >
            {status.slice(0, 1).toUpperCase() + status.slice(1)}
          </StatusLink>
        ))}
      </div>

      <div className="mt-4 grid gap-3">
        {rows.map((application) => {
          const opportunity = Array.isArray(application.opportunities)
            ? application.opportunities[0]
            : application.opportunities;

          if (!opportunity) {
            return null;
          }

          const tunnel = Array.isArray(opportunity.tunnel_profiles)
            ? opportunity.tunnel_profiles[0]
            : opportunity.tunnel_profiles;

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

      {rows.length === 0 ? (
        <p className="mt-5 rounded-2xl border border-slate-200 bg-white p-4 text-sm text-slate-600">
          You have not sent interest for any opportunities yet.
        </p>
      ) : null}
    </AppShell>
  );
}

function StatusLink({
  href,
  active,
  children,
}: {
  href: string;
  active: boolean;
  children: ReactNode;
}) {
  return (
    <Link
      href={href}
      className={`shrink-0 rounded-full border px-3 py-1.5 text-sm font-bold ${
        active
          ? "border-sky-600 bg-sky-600 text-white"
          : "border-slate-200 bg-white text-slate-700"
      }`}
    >
      {children}
    </Link>
  );
}

function formatLocation(city?: string | null, country?: string | null) {
  if (city && country) {
    return `${city}, ${country}`;
  }

  return city ?? country ?? "Location to be confirmed";
}
