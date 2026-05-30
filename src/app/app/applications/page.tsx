import Link from "next/link";
import { AppShell } from "@/components/AppShell";
import { Badge } from "@/components/Badge";
import { WithdrawApplicationButton } from "@/components/WithdrawApplicationButton";
import { formatDateRange, formatOpportunityType } from "@/lib/opportunities";
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

const statusLabels: Record<InterestStatus, string> = {
  pending: "Pending",
  accepted: "Accepted",
  declined: "Declined",
  waitlist: "Waitlist",
};

export default async function ApplicationsPage() {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const [{ data: profile }, { data: applications }] = await Promise.all([
    supabase
      .from("profiles")
      .select("wants_to_join_opportunities,wants_to_create_opportunities")
      .eq("id", user?.id)
      .maybeSingle(),
    supabase
      .from("opportunity_interests")
      .select("id,status,created_at,opportunities(id,title,type,start_date,end_date,tunnel_profiles(name,city,country),coach_profiles(profiles(full_name)),profiles!opportunities_created_by_fkey(full_name))")
      .eq("athlete_id", user?.id)
      .order("created_at", { ascending: false }),
  ]);
  const rows = (applications ?? []) as ApplicationRow[];
  const canCreate = profile?.wants_to_create_opportunities === true;
  const canJoin = profile?.wants_to_join_opportunities !== false;

  return (
    <AppShell active="applications" canCreate={canCreate} canJoin={canJoin}>
      <div>
        <h1 className="text-3xl font-black tracking-tight">Applications</h1>
        <p className="mt-2 text-sm leading-6 text-slate-600">
          Track the opportunities where you have sent interest.
        </p>
      </div>

      <div className="mt-5 grid gap-4 md:grid-cols-2">
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
          const coachProfile = Array.isArray(opportunity.coach_profiles)
            ? opportunity.coach_profiles[0]
            : opportunity.coach_profiles;
          const coachUserProfile = Array.isArray(coachProfile?.profiles)
            ? coachProfile?.profiles[0]
            : coachProfile?.profiles;
          const organizerProfile = Array.isArray(opportunity.profiles)
            ? opportunity.profiles[0]
            : opportunity.profiles;
          const organizerName =
            coachUserProfile?.full_name ?? organizerProfile?.full_name ?? "Organizer";

          return (
            <article
              key={application.id}
              className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm"
            >
              <div className="flex flex-wrap items-center gap-2">
                <Badge tone={opportunity.type === "camp" ? "blue" : "green"}>
                  {formatOpportunityType(opportunity.type)}
                </Badge>
                <Badge tone={statusTone(application.status)}>
                  {statusLabels[application.status]}
                </Badge>
              </div>
              <Link
                href={`/app/opportunities/${opportunity.id}`}
                className="mt-3 block text-xl font-black tracking-tight text-slate-950"
              >
                {opportunity.title}
              </Link>
              <div className="mt-3 grid gap-1 text-sm text-slate-600">
                <p>Organizer: {organizerName}</p>
                <p>
                  Tunnel: {tunnel?.name ?? "Tunnel"}
                  {tunnel ? `, ${formatLocation(tunnel.city, tunnel.country)}` : ""}
                </p>
                <p>Date: {formatDateRange(opportunity.start_date, opportunity.end_date)}</p>
                <p>Sent: {formatSubmittedDate(application.created_at)}</p>
              </div>
              <p className="mt-4 rounded-xl bg-slate-50 p-3 text-sm font-semibold text-slate-700">
                {contactHint(application.status)}
              </p>
              {application.status === "pending" || application.status === "waitlist" ? (
                <div className="mt-4">
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

function formatLocation(city?: string | null, country?: string | null) {
  if (city && country) {
    return `${city}, ${country}`;
  }

  return city ?? country ?? "Location to be confirmed";
}

function formatSubmittedDate(value: string) {
  return new Intl.DateTimeFormat("en", {
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(new Date(value));
}

function statusTone(status: InterestStatus) {
  if (status === "accepted") {
    return "green";
  }

  if (status === "declined") {
    return "red";
  }

  if (status === "waitlist") {
    return "amber";
  }

  return "slate";
}

function contactHint(status: InterestStatus) {
  if (status === "accepted") {
    return "You have already been accepted. If you can no longer join, please contact the organizer directly via WhatsApp or Instagram.";
  }

  if (status === "declined") {
    return "This application was declined.";
  }

  if (status === "waitlist") {
    return "You are on the waitlist. The organizer can contact you if a spot opens.";
  }

  return "Your application is pending. The organizer can review and contact you directly.";
}
