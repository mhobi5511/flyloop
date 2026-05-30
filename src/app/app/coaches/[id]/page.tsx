import { notFound } from "next/navigation";
import { AtSign } from "lucide-react";
import { AppShell } from "@/components/AppShell";
import { Avatar } from "@/components/Avatar";
import { FollowButton } from "@/components/FollowButton";
import { OpportunityCard } from "@/components/OpportunityCard";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { mapOpportunity, type HomeFeedRow } from "@/lib/supabase/mappers";

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

export default async function CoachProfilePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createSupabaseServerClient();
  const { data } = await supabase
    .from("coach_profiles")
    .select("id,user_id,bio,disciplines,languages,achievements,instagram_handle,profiles(full_name,country,instagram_handle,profile_image_url)")
    .eq("id", id)
    .maybeSingle();

  if (!data) {
    notFound();
  }

  const coach = data as CoachProfileRow;
  const profile = Array.isArray(coach.profiles)
    ? coach.profiles[0]
    : coach.profiles;
  const { data: opportunityRows } = await supabase
    .from("published_opportunities_with_context")
    .select("*")
    .eq("coach_id", coach.id)
    .order("start_date", { ascending: true });
  const opportunities = ((opportunityRows ?? []) as HomeFeedRow[]).map(mapOpportunity);
  const instagram = coach.instagram_handle ?? profile?.instagram_handle;

  return (
    <AppShell active="profile">
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

      <section className="mt-8">
        <h2 className="text-xl font-bold tracking-tight">Posted opportunities</h2>
        <div className="mt-4 grid gap-3 md:grid-cols-2">
          {opportunities.map((opportunity) => (
            <OpportunityCard key={opportunity.id} opportunity={opportunity} />
          ))}
        </div>
      </section>
    </AppShell>
  );
}
