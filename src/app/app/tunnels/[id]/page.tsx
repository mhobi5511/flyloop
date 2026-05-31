import { notFound } from "next/navigation";
import { MapPin } from "lucide-react";
import { AppShell } from "@/components/AppShell";
import { OpportunityCard } from "@/components/OpportunityCard";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { mapOpportunity, type HomeFeedRow } from "@/lib/supabase/mappers";

export default async function TunnelProfilePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createSupabaseServerClient();
  const { data: tunnel } = await supabase
    .from("tunnel_profiles")
    .select("*")
    .eq("id", id)
    .maybeSingle();

  if (!tunnel) {
    notFound();
  }

  const { data: opportunityRows } = await supabase
    .from("published_opportunities_with_context")
    .select("*")
    .eq("tunnel_id", tunnel.id)
    .order("start_date", { ascending: true });
  const opportunities = ((opportunityRows ?? []) as HomeFeedRow[]).map(mapOpportunity);

  return (
    <AppShell active="home">
      <section className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm">
        {tunnel.header_image_url ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={tunnel.header_image_url}
            alt=""
            className="h-44 w-full object-cover"
          />
        ) : (
          <div className="h-44 bg-gradient-to-br from-sky-100 to-cyan-50" />
        )}
        <div className="p-5">
          <p className="flex items-center gap-2 text-sm font-bold text-sky-700">
            <MapPin size={17} />
            {tunnel.city}, {tunnel.country}
          </p>
          <h1 className="mt-2 text-3xl font-black tracking-tight">
            {tunnel.name}
          </h1>
          <p className="mt-4 text-sm leading-6 text-slate-600">
            {tunnel.description || "Tunnel profile details are coming soon."}
          </p>
          <div className="mt-5 flex flex-wrap gap-2">
            {tunnel.size ? (
              <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-bold text-slate-600">
                {tunnel.size}
              </span>
            ) : null}
            {tunnel.website ? (
              <a
                href={tunnel.website}
                className="rounded-full bg-sky-50 px-3 py-1 text-xs font-bold text-sky-700"
              >
                Website
              </a>
            ) : null}
          </div>
        </div>
      </section>

      <section className="mt-8">
        <h2 className="text-xl font-bold tracking-tight">Opportunities here</h2>
        <div className="mt-4 grid gap-3 md:grid-cols-2">
          {opportunities.map((opportunity) => (
            <OpportunityCard key={opportunity.id} opportunity={opportunity} />
          ))}
        </div>
      </section>
    </AppShell>
  );
}
