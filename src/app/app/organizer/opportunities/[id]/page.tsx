import Link from "next/link";
import { notFound } from "next/navigation";
import { AtSign, MessageCircle } from "lucide-react";
import { AppShell } from "@/components/AppShell";
import { ApplicantStatusActions } from "@/components/ApplicantStatusActions";
import {
  ApplicationStatusBadge,
  applicantBorderClass,
} from "@/components/ApplicationStatusBadge";
import { Badge } from "@/components/Badge";
import { Avatar } from "@/components/Avatar";
import { NotificationReadSignal } from "@/components/NotificationReadSignal";
import { OrganizerOpportunityActions } from "@/components/OrganizerOpportunityActions";
import {
  formatDateRange,
  formatOpportunityType,
  formatPrice,
} from "@/lib/opportunities";
import { phoneToWhatsAppPath } from "@/lib/phone";
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
  price: number | string;
  currency: string;
  description: string | null;
  tunnel_profiles:
    | { name: string; city: string | null; country: string | null }
    | Array<{ name: string; city: string | null; country: string | null }>
    | null;
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
        profile_image_url: string | null;
      }
    | Array<{
        full_name: string;
        country: string | null;
        phone: string | null;
        whatsapp_number: string | null;
          instagram_handle: string | null;
          profile_image_url: string | null;
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
      .select("is_organizer,wants_to_create_opportunities")
      .eq("id", user?.id)
      .maybeSingle(),
    supabase
      .from("opportunities")
      .select("id,title,type,status,start_date,end_date,total_capacity,available_spots,price,currency,description,tunnel_profiles(name,city,country)")
      .eq("id", id)
      .eq("created_by", user?.id)
      .maybeSingle(),
  ]);

  if (!opportunity) {
    notFound();
  }

  await supabase
    .from("notifications")
    .update({ read: true })
    .eq("user_id", user?.id)
    .eq("opportunity_id", id)
    .eq("type", "new_interest")
    .eq("read", false);

  const { data: applicants } = await supabase
    .from("opportunity_interests")
    .select("id,status,created_at,profiles!opportunity_interests_athlete_id_fkey(full_name,country,phone,whatsapp_number,instagram_handle,profile_image_url)")
    .eq("opportunity_id", id)
    .order("created_at", { ascending: false });
  const canCreate =
    profile?.is_organizer === true ||
    profile?.wants_to_create_opportunities === true;
  const currentOpportunity = opportunity as OrganizerOpportunity;
  const applicantRows = (applicants ?? []) as ApplicantRow[];

  return (
    <AppShell active="dashboard" canCreate={canCreate}>
      <NotificationReadSignal />
      <Link href="/app/dashboard" className="text-sm font-bold text-sky-700">
        Back to Coachings
      </Link>
      <section className="mt-3 rounded-2xl border border-slate-200 bg-white p-3 shadow-sm sm:p-4">
        <div className="grid gap-3 lg:grid-cols-[1fr_200px] lg:items-start">
          <div>
            <div className="flex flex-wrap items-center gap-1.5">
              <Badge tone={currentOpportunity.type === "camp" ? "blue" : "green"}>
                {formatOpportunityType(currentOpportunity.type)}
              </Badge>
            </div>
            <h1 className="mt-2 text-xl font-black tracking-tight sm:text-2xl">
              {currentOpportunity.title}
            </h1>
            <div className="mt-2 flex flex-wrap gap-x-3 gap-y-1 text-sm font-semibold text-slate-600">
              <p>
                {formatDateRange(
                  currentOpportunity.start_date,
                  currentOpportunity.end_date,
                )}
              </p>
              <p>
                {currentOpportunity.available_spots}/
                {currentOpportunity.total_capacity} open
              </p>
              <p>
                {formatPrice(
                  Number(currentOpportunity.price),
                  currentOpportunity.currency,
                )}
              </p>
            </div>
          </div>
          <OrganizerOpportunityActions opportunityId={currentOpportunity.id} />
        </div>
      </section>

      <section className="mt-4">
        <h2 className="text-xl font-black tracking-tight">Applicants</h2>
        <div className="mt-2 grid gap-2">
          {applicantRows.map((applicant) => {
            const profile = Array.isArray(applicant.profiles)
              ? applicant.profiles[0]
              : applicant.profiles;
            const phone = profile?.whatsapp_number ?? profile?.phone ?? "";
            const instagram = profile?.instagram_handle ?? "";

            return (
              <article
                key={applicant.id}
                className={`rounded-xl border border-slate-200 bg-white p-2.5 shadow-sm ${applicantBorderClass(applicant.status)}`}
              >
                <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                  <div className="min-w-0">
                    <div className="flex min-w-0 gap-2.5">
                      <Avatar
                        name={profile?.full_name}
                        imageUrl={profile?.profile_image_url}
                        size="sm"
                      />
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <h3 className="font-black text-slate-950">
                            {profile?.full_name ?? "Applicant"}
                          </h3>
                          <ApplicationStatusBadge status={applicant.status} />
                        </div>
                        <div className="mt-1 grid gap-0.5 text-xs text-slate-600">
                          <p>{profile?.country ?? "Country not set"}</p>
                          <p>Phone: {phone || "Not provided"}</p>
                        </div>
                      </div>
                    </div>
                    <div className="mt-2 flex flex-wrap gap-1.5">
                      {phone ? (
                        <a
                          href={`https://wa.me/${phoneToWhatsAppPath(phone)}`}
                          className="inline-flex h-8 items-center gap-1.5 rounded-lg bg-emerald-500 px-2.5 text-xs font-bold text-white"
                        >
                          <MessageCircle size={14} /> WhatsApp
                        </a>
                      ) : null}
                      {instagram ? (
                        <a
                          href={`https://instagram.com/${instagram}`}
                          className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-slate-200 px-2.5 text-xs font-bold text-slate-700"
                        >
                          <AtSign size={14} /> Instagram
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
