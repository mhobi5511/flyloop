import { notFound } from "next/navigation";
import { AtSign, ChevronDown } from "lucide-react";
import { Avatar } from "@/components/Avatar";
import { FollowButton } from "@/components/FollowButton";
import { OpportunityCard } from "@/components/OpportunityCard";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { mapOpportunity, type HomeFeedRow } from "@/lib/supabase/mappers";
import {
  isOpportunityCompleted,
  isOpportunityCurrent,
} from "@/lib/opportunity-lifecycle";
import type { Opportunity } from "@/lib/types";

type CoachProfileRow = {
  id: string;
  bio: string | null;
  disciplines: string[];
  languages: string[];
  achievements: string[];
  instagram_handle: string | null;
  user_id: string;
  profiles:
    | {
        full_name: string;
        country: string | null;
        instagram_handle: string | null;
        profile_image_url: string | null;
      }
    | Array<{
        full_name: string;
        country: string | null;
        instagram_handle: string | null;
        profile_image_url: string | null;
      }>;
};

const coachOpportunitySelect =
  "id,type,booking_mode,title,coach_id,tunnel_id,start_date,end_date,registration_deadline,tunnel_time_mode,session_start,session_end,price,currency,total_capacity,available_spots,min_minutes_or_hours,description,languages,disciplines,skill_level,status,contact_method,created_by,created_at,updated_at,is_last_minute,tunnel_name,tunnel_country,tunnel_city,coach_name,coach_follow_id,tunnel_region,tunnel_latitude,tunnel_longitude";

export default async function CoachProfilePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createSupabaseServerClient();
  const [coachResult, opportunityResult] = await Promise.all([
    supabase
      .from("coach_profiles")
      .select("id,user_id,bio,disciplines,languages,achievements,instagram_handle,profiles(full_name,country,instagram_handle,profile_image_url)")
      .eq("id", id)
      .maybeSingle(),
    supabase
      .from("published_opportunities_with_context")
      .select(coachOpportunitySelect)
      .eq("coach_id", id)
      .order("start_date", { ascending: true }),
  ]);
  const data = coachResult.data;

  if (!data) {
    notFound();
  }

  const coach = data as CoachProfileRow;
  const profile = Array.isArray(coach.profiles)
    ? coach.profiles[0]
    : coach.profiles;
  const opportunityRows = opportunityResult.data;
  const opportunities = ((opportunityRows ?? []) as HomeFeedRow[]).map(mapOpportunity);
  const now = new Date();
  const upcomingOpportunities = opportunities
    .filter((opportunity) => isOpportunityCurrent(opportunity, now))
    .sort(compareUpcomingOpportunities);
  const visibleUpcomingOpportunities = upcomingOpportunities.slice(0, 4);
  const extraUpcomingOpportunities = upcomingOpportunities.slice(4);
  const pastOpportunities = opportunities
    .filter((opportunity) => isOpportunityCompleted(opportunity, now))
    .sort((a, b) => getOpportunitySortDate(b).localeCompare(getOpportunitySortDate(a)));
  const instagram = coach.instagram_handle ?? profile?.instagram_handle;

  return (
    <>
      <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="flex items-start gap-4">
          <Avatar
            name={profile?.full_name}
            imageUrl={profile?.profile_image_url}
            size="lg"
          />
          <div>
            <p className="text-sm font-bold text-sky-700">
              {profile?.country ?? "Coach"}
            </p>
            <h1 className="text-3xl font-black tracking-tight">
              {profile?.full_name}
            </h1>
            <p className="mt-2 text-sm leading-6 text-slate-600">
              {coach.languages.join(", ")}
            </p>
            <div className="mt-4">
              <FollowButton
                targetType="coach"
                targetId={coach.user_id}
                label="Follow coach"
              />
            </div>
          </div>
        </div>
        <p className="mt-5 text-sm leading-6 text-slate-600">
          {coach.bio || "This coach has not added a bio yet."}
        </p>
        <div className="mt-5 flex flex-wrap gap-2">
          {coach.disciplines.map((discipline) => (
            <span
              key={discipline}
              className="rounded-full bg-sky-50 px-3 py-1 text-xs font-bold text-sky-700"
            >
              {discipline}
            </span>
          ))}
        </div>
        {instagram ? (
          <a
            href={`https://instagram.com/${instagram}`}
            className="mt-5 flex h-12 items-center justify-center gap-2 rounded-xl border border-slate-200 font-bold text-slate-700"
          >
            <AtSign size={18} /> Instagram
          </a>
        ) : null}
      </section>

      <section className="mt-6 rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <p className="text-sm font-bold uppercase tracking-[0.14em] text-sky-700">
              Coach Hub
            </p>
            <h2 className="text-2xl font-black tracking-tight">
              Upcoming Opportunities
            </h2>
          </div>
          {upcomingOpportunities.length > 0 ? (
            <p className="rounded-full bg-sky-50 px-3 py-1 text-xs font-black text-sky-700">
              {upcomingOpportunities.length} upcoming
            </p>
          ) : null}
        </div>

        {upcomingOpportunities.length > 0 ? (
          <>
            <div className="mt-4 grid gap-3 md:grid-cols-2">
              {visibleUpcomingOpportunities.map((opportunity) => (
                <OpportunityCard
                  key={opportunity.id}
                  opportunity={opportunity}
                  dense
                  showViewCta
                />
              ))}
            </div>

            {extraUpcomingOpportunities.length > 0 ? (
              <details className="group mt-3">
                <summary className="inline-flex h-10 cursor-pointer list-none items-center gap-2 rounded-xl border border-slate-200 px-3 text-sm font-black text-slate-700 transition hover:bg-slate-50">
                  View all upcoming
                  <ChevronDown
                    size={16}
                    className="transition group-open:rotate-180"
                  />
                </summary>
                <div className="mt-3 grid gap-3 md:grid-cols-2">
                  {extraUpcomingOpportunities.map((opportunity) => (
                    <OpportunityCard
                      key={opportunity.id}
                      opportunity={opportunity}
                      dense
                      showViewCta
                    />
                  ))}
                </div>
              </details>
            ) : null}
          </>
        ) : (
          <p className="mt-4 rounded-2xl bg-slate-50 p-4 text-sm font-bold text-slate-500">
            No upcoming opportunities yet.
          </p>
        )}
      </section>

      {pastOpportunities.length > 0 ? (
        <section className="mt-8">
          <h2 className="text-xl font-bold tracking-tight">Past opportunities</h2>
          <div className="mt-4 grid gap-3 md:grid-cols-2">
            {pastOpportunities.map((opportunity) => (
              <OpportunityCard key={opportunity.id} opportunity={opportunity} />
            ))}
          </div>
        </section>
      ) : null}
    </>
  );
}

function compareUpcomingOpportunities(a: Opportunity, b: Opportunity) {
  return getOpportunitySortDate(a).localeCompare(getOpportunitySortDate(b));
}

function getOpportunitySortDate(opportunity: Opportunity) {
  return opportunity.startDate;
}
