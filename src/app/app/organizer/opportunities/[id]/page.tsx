import Link from "next/link";
import { notFound } from "next/navigation";
import { AtSign, MessageCircle } from "lucide-react";
import { AppShell } from "@/components/AppShell";
import { ApplicantStatusActions } from "@/components/ApplicantStatusActions";
import { Badge } from "@/components/Badge";
import { formatDateRange, formatOpportunityType } from "@/lib/opportunities";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import type { InterestStatus, OpportunityStatus, OpportunityType } from "@/lib/types";

type OrganizerOpportunity = {
  id: string;
  title: string;
  type: OpportunityType;
  status: OpportunityStatus;
  start_date: string;
  end_date: string;
  total_capacity: number;
  available_spots: number;
  description: string | null;
  tunnel_profiles: { name: string } | Array<{ name: string }> | null;
};

type ApplicantRow = {
  id: string;
  status: InterestStatus;
  created_at: string;
  profiles:
    | {
        full_name: string;
        country: string | null;
        phone: string | null;
        whatsapp_number: string | null;
        instagram_handle: string | null;
      }
    | Array<{
        full_name: string;
        country: string | null;
        phone: string | null;
        whatsapp_number: string | null;
        instagram_handle: string | null;
      }>
    | null;
};

export default async function OrganizerOpportunityPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const [{ data: profile }, { data: opportunity }] = await Promise.all([
    supabase
      .from("profiles")
      .select("wants_to_create_opportunities")
      .eq("id", user?.id)
      .maybeSingle(),
    supabase
      .from("opportunities")
      .select("id,title,type,status,start_date,end_date,total_capacity,available_spots,description,tunnel_profiles(name)")
      .eq("id", id)
      .eq("created_by", user?.id)
      .maybeSingle(),
  ]);

  if (!opportunity) {
    notFound();
  }

  const { data: applicants } = await supabase
    .from("opportunity_interests")
    .select("id,status,created_at,profiles!opportunity_interests_athlete_id_fkey(full_name,country,phone,whatsapp_number,instagram_handle)")
    .eq("opportunity_id", id)
    .order("created_at", { ascending: false });
  const canCreate = profile?.wants_to_create_opportunities === true;
  const currentOpportunity = opportunity as OrganizerOpportunity;
  const tunnel = Array.isArray(currentOpportunity.tunnel_profiles)
    ? currentOpportunity.tunnel_profiles[0]
    : currentOpportunity.tunnel_profiles;
  const applicantRows = (applicants ?? []) as ApplicantRow[];

  return (
    <AppShell active="dashboard" canCreate={canCreate}>
      <Link href="/app/dashboard" className="text-sm font-bold text-sky-700">
        Back to Organizer
      </Link>
      <section className="mt-4 rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="flex flex-wrap items-center gap-2">
          <Badge tone={currentOpportunity.type === "camp" ? "blue" : "green"}>
            {formatOpportunityType(currentOpportunity.type)}
          </Badge>
          <Badge tone={currentOpportunity.status === "published" ? "slate" : "red"}>
            {currentOpportunity.status}
          </Badge>
        </div>
        <h1 className="mt-3 text-3xl font-black tracking-tight">
          {currentOpportunity.title}
        </h1>
        <div className="mt-4 grid gap-2 text-sm font-semibold text-slate-600 sm:grid-cols-2">
          <p>Tunnel: {tunnel?.name ?? "Tunnel"}</p>
          <p>Date: {formatDateRange(currentOpportunity.start_date, currentOpportunity.end_date)}</p>
          <p>
            Spots: {currentOpportunity.available_spots} /{" "}
            {currentOpportunity.total_capacity} open
          </p>
          <p>Applicants: {applicantRows.length}</p>
        </div>
        {currentOpportunity.description ? (
          <p className="mt-4 text-sm leading-6 text-slate-600">
            {currentOpportunity.description}
          </p>
        ) : null}
      </section>

      <section className="mt-6">
        <h2 className="text-2xl font-black tracking-tight">Applicants</h2>
        <div className="mt-4 grid gap-4">
          {applicantRows.map((applicant) => {
            const profile = Array.isArray(applicant.profiles)
              ? applicant.profiles[0]
              : applicant.profiles;
            const phone = profile?.whatsapp_number ?? profile?.phone ?? "";
            const instagram = profile?.instagram_handle ?? "";

            return (
              <article
                key={applicant.id}
                className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm"
              >
                <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <h3 className="font-black text-slate-950">
                        {profile?.full_name ?? "Applicant"}
                      </h3>
                      <Badge tone={statusTone(applicant.status)}>
                        {statusLabel(applicant.status)}
                      </Badge>
                    </div>
                    <div className="mt-2 grid gap-1 text-sm text-slate-600">
                      <p>{profile?.country ?? "Country not set"}</p>
                      <p>Submitted: {formatSubmittedDate(applicant.created_at)}</p>
                      <p>Phone: {phone || "Not provided"}</p>
                    </div>
                    <div className="mt-3 flex flex-wrap gap-2">
                      {phone ? (
                        <a
                          href={`https://wa.me/${phone.replace(/\D/g, "")}`}
                          className="inline-flex h-10 items-center gap-2 rounded-xl bg-emerald-500 px-3 text-sm font-bold text-white"
                        >
                          <MessageCircle size={16} /> WhatsApp
                        </a>
                      ) : null}
                      {instagram ? (
                        <a
                          href={`https://instagram.com/${instagram}`}
                          className="inline-flex h-10 items-center gap-2 rounded-xl border border-slate-200 px-3 text-sm font-bold text-slate-700"
                        >
                          <AtSign size={16} /> Instagram
                        </a>
                      ) : null}
                    </div>
                  </div>
                  <ApplicantStatusActions
                    interestId={applicant.id}
                    currentStatus={applicant.status}
                  />
                </div>
              </article>
            );
          })}
        </div>
        {applicantRows.length === 0 ? (
          <p className="mt-4 rounded-2xl border border-slate-200 bg-white p-4 text-sm text-slate-600">
            No applicants yet.
          </p>
        ) : null}
      </section>
    </AppShell>
  );
}

function formatSubmittedDate(value: string) {
  return new Intl.DateTimeFormat("en", {
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(new Date(value));
}

function statusLabel(status: InterestStatus) {
  return status === "waitlist"
    ? "Waitlist"
    : status.charAt(0).toUpperCase() + status.slice(1);
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
