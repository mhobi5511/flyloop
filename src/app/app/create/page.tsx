import Link from "next/link";
import { AppShell } from "@/components/AppShell";
import {
  CreateOpportunityForm,
  type InheritedCoachProfile,
  type TunnelOption,
} from "@/components/CreateOpportunityForm";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getCurrentUser } from "@/lib/supabase/auth";

export default async function CreateOpportunityPage() {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await getCurrentUser();

  const [{ data: profile }, { data: coachProfile }, { data: tunnelRows }] = await Promise.all([
    supabase
      .from("profiles")
      .select("full_name,is_organizer,wants_to_create_opportunities")
      .eq("id", user?.id)
      .maybeSingle(),
    supabase
      .from("coach_profiles")
      .select("languages,disciplines")
      .eq("user_id", user?.id)
      .maybeSingle(),
    supabase
      .from("tunnel_profiles")
      .select("id,name,city,country")
      .order("name", { ascending: true }),
  ]);
  const canCreate =
    profile?.is_organizer === true ||
    profile?.wants_to_create_opportunities === true;
  const tunnels = ((tunnelRows ?? []) as TunnelOption[]).map((tunnel) => ({
    id: tunnel.id,
    name: tunnel.name,
    city: tunnel.city,
    country: tunnel.country,
  }));
  const inheritedCoachProfile: InheritedCoachProfile = {
    languages: coachProfile?.languages ?? [],
    disciplines: coachProfile?.disciplines ?? [],
  };

  return (
    <AppShell active="create" canCreate={canCreate}>
      <div className="mx-auto max-w-3xl">
        <h1 className="text-3xl font-black tracking-tight">Create opportunity</h1>
        {canCreate ? (
          <CreateOpportunityForm
            tunnels={tunnels}
            inheritedCoachProfile={inheritedCoachProfile}
            organizerName={profile?.full_name ?? undefined}
          />
        ) : (
          <div className="mt-5 rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
            <h2 className="text-xl font-black tracking-tight">
              Enable organizer mode
            </h2>
            <p className="mt-2 text-sm leading-6 text-slate-600">
              Turn on organizer mode in your profile to publish camps or Huck Jams.
            </p>
            <Link
              href="/app/profile"
              className="mt-4 inline-flex h-11 items-center rounded-xl bg-sky-600 px-4 text-sm font-bold text-white"
            >
              Open profile
            </Link>
          </div>
        )}
      </div>
    </AppShell>
  );
}
