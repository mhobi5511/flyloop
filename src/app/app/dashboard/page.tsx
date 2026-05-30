import Link from "next/link";
import { Plus } from "lucide-react";
import { AppShell } from "@/components/AppShell";
import { Badge } from "@/components/Badge";
import { formatDateRange, formatOpportunityType } from "@/lib/opportunities";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import type { InterestStatus, OpportunityStatus, OpportunityType } from "@/lib/types";

type OrganizerOpportunityRow = {
  id: string;
  title: string;
  type: OpportunityType;
  status: OpportunityStatus;
  start_date: string;
  end_date: string;
  total_capacity: number;
  available_spots: number;
  tunnel_profiles:
    | { name: string; city: string | null; country: string | null }
    | Array<{ name: string; city: string | null; country: string | null }>
    | null;
  opportunity_interests:
    | Array<{ status: InterestStatus }>
    | null;
};

const statuses: InterestStatus[] = ["pending", "accepted", "declined", "waitlist"];

export default async function OrganizerDashboardPage() {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const { data: profile } = await supabase
    .from("profiles")
    .select("wants_to_create_opportunities")
    .eq("id", user?.id)
    .maybeSingle();
  const canCreate = profile?.wants_to_create_opportunities === true;

  if (!canCreate) {
    return (
      <AppShell active="dashboard" canCreate={false}>
        <div className="mx-auto max-w-2xl rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
          <h1 className="text-3xl font-black tracking-tight">Organizer</h1>
          <p className="mt-2 text-sm leading-6 text-slate-600">
            Enable creating opportunities in your profile to access organizer
            tools.
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

  const { data: opportunities } = await supabase
    .from("opportunities")
    .select("id,title,type,status,start_date,end_date,total_capacity,available_spots,tunnel_profiles(name,city,country),opportunity_interests(status)")
    .eq("created_by", user?.id)
    .order("start_date", { ascending: true });
  const opportunityRows = (opportunities ?? []) as OrganizerOpportunityRow[];

  return (
    <AppShell active="dashboard" canCreate>
      <div className="flex items-start justify-between gap-3">
        <div>
          <h1 className="text-3xl font-black tracking-tight">Organizer</h1>
          <p className="mt-2 text-sm leading-6 text-slate-600">
            Manage your opportunities and open each one to handle applicants.
          </p>
        </div>
        <Link
          href="/app/create"
          className="flex h-11 shrink-0 items-center gap-2 rounded-xl bg-sky-600 px-4 text-sm font-bold text-white"
        >
          <Plus size={17} /> New
        </Link>
      </div>

      <div className="mt-5 grid gap-4 md:grid-cols-2">
        {opportunityRows.map((opportunity) => {
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

          return (
            <Link
              key={opportunity.id}
              href={`/app/organizer/opportunities/${opportunity.id}`}
              className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md"
            >
              <div className="flex flex-wrap items-center gap-2">
                <Badge tone={opportunity.type === "camp" ? "blue" : "green"}>
                  {formatOpportunityType(opportunity.type)}
                </Badge>
                <Badge tone={opportunity.status === "published" ? "slate" : "red"}>
                  {opportunity.status}
                </Badge>
              </div>
              <h2 className="mt-3 text-xl font-black tracking-tight">
                {opportunity.title}
              </h2>
              <p className="mt-2 text-sm font-semibold text-slate-600">
                {tunnel?.name ?? "Tunnel"}
                {tunnel ? `, ${formatLocation(tunnel.city, tunnel.country)}` : ""} -{" "}
                {formatDateRange(opportunity.start_date, opportunity.end_date)}
              </p>
              <p className="mt-1 text-sm text-slate-500">
                {opportunity.available_spots} / {opportunity.total_capacity} spots open
              </p>
              <div className="mt-4 grid grid-cols-2 gap-2 text-center sm:grid-cols-5">
                <Count label="Total" value={interests.length} />
                <Count label="Pending" value={counts.pending} />
                <Count label="Accepted" value={counts.accepted} />
                <Count label="Declined" value={counts.declined} />
                <Count label="Waitlist" value={counts.waitlist} />
              </div>
            </Link>
          );
        })}
      </div>

      {opportunityRows.length === 0 ? (
        <p className="mt-5 rounded-2xl border border-slate-200 bg-white p-4 text-sm text-slate-600">
          No opportunities yet.
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

function Count({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-xl bg-slate-50 px-2 py-2">
      <p className="text-base font-black text-slate-950">{value}</p>
      <p className="text-[0.68rem] font-bold text-slate-500">{label}</p>
    </div>
  );
}
