import Link from "next/link";
import { AppShell } from "@/components/AppShell";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export default async function AdminPage() {
  const supabase = await createSupabaseServerClient();
  const [{ count: opportunitiesCount }, { count: interestsCount }, { count: profilesCount }] =
    await Promise.all([
      supabase.from("opportunities").select("*", { count: "exact", head: true }),
      supabase
        .from("opportunity_interests")
        .select("*", { count: "exact", head: true }),
      supabase.from("profiles").select("*", { count: "exact", head: true }),
    ]);
  const { data: opportunities } = await supabase
    .from("opportunities")
    .select("id,title,status,start_date,available_spots")
    .order("created_at", { ascending: false })
    .limit(25);
  const { data: interests } = await supabase
    .from("opportunity_interests")
    .select("id,status,created_at,opportunities(title),profiles(full_name)")
    .order("created_at", { ascending: false })
    .limit(25);

  return (
    <AppShell active="dashboard">
      <div className="mx-auto max-w-5xl">
        <h1 className="text-3xl font-black tracking-tight">Admin</h1>
        <p className="mt-2 text-sm leading-6 text-slate-600">
          Review live Flyloop records from Supabase.
        </p>

        <div className="mt-5 grid grid-cols-3 gap-3">
          <Metric label="Profiles" value={profilesCount ?? 0} />
          <Metric label="Opportunities" value={opportunitiesCount ?? 0} />
          <Metric label="Interests" value={interestsCount ?? 0} />
        </div>

        <section className="mt-6 rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
          <h2 className="text-xl font-bold tracking-tight">Opportunities</h2>
          <div className="mt-4 grid gap-3">
            {(opportunities ?? []).map((opportunity) => (
              <Link
                key={opportunity.id}
                href={`/app/opportunities/${opportunity.id}`}
                className="rounded-2xl border border-slate-200 p-4"
              >
                <p className="font-bold text-slate-950">{opportunity.title}</p>
                <p className="mt-1 text-sm text-slate-600">
                  {opportunity.status} · {opportunity.start_date} ·{" "}
                  {opportunity.available_spots} open spots
                </p>
              </Link>
            ))}
          </div>
        </section>

        <section className="mt-6 rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
          <h2 className="text-xl font-bold tracking-tight">Interests</h2>
          <div className="mt-4 grid gap-3">
            {(interests ?? []).map((interest) => {
              const opportunity = Array.isArray(interest.opportunities)
                ? interest.opportunities[0]
                : interest.opportunities;
              const profile = Array.isArray(interest.profiles)
                ? interest.profiles[0]
                : interest.profiles;

              return (
                <div
                  key={interest.id}
                  className="rounded-2xl border border-slate-200 p-4"
                >
                  <p className="font-bold text-slate-950">
                    {opportunity?.title ?? "Opportunity"}
                  </p>
                  <p className="mt-1 text-sm text-slate-600">
                    {profile?.full_name ?? "Athlete"} · {interest.status}
                  </p>
                </div>
              );
            })}
          </div>
        </section>
      </div>
    </AppShell>
  );
}

function Metric({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
      <p className="text-2xl font-black text-sky-700">{value}</p>
      <p className="text-sm font-bold text-slate-600">{label}</p>
    </div>
  );
}
