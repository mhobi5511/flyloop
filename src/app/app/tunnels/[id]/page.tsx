import { notFound } from "next/navigation";
import Image from "next/image";
import { MapPin } from "lucide-react";
import { OpportunityCard } from "@/components/OpportunityCard";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { mapOpportunity, type HomeFeedRow } from "@/lib/supabase/mappers";
import { isOptimizableSupabaseImage } from "@/lib/image-url";

const tunnelOpportunitySelect =
  "id,type,booking_mode,title,coach_id,tunnel_id,start_date,end_date,registration_deadline,tunnel_time_mode,session_start,session_end,price,currency,total_capacity,available_spots,min_minutes_or_hours,description,languages,disciplines,skill_level,status,contact_method,created_by,created_at,updated_at,is_last_minute,tunnel_name,tunnel_country,tunnel_city,coach_name,coach_follow_id,tunnel_region,tunnel_latitude,tunnel_longitude";

export default async function TunnelProfilePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createSupabaseServerClient();
  const today = new Date().toISOString().slice(0, 10);
  const [tunnelResult, opportunityResult] = await Promise.all([
    supabase
      .from("tunnel_profiles")
      .select("id,name,city,country,description,size,website,header_image_url")
      .eq("id", id)
      .maybeSingle(),
    supabase
      .from("published_opportunities_with_context")
      .select(tunnelOpportunitySelect)
      .eq("tunnel_id", id)
      .gte("end_date", today)
      .order("start_date", { ascending: true }),
  ]);
  const tunnel = tunnelResult.data;

  if (!tunnel) {
    notFound();
  }

  const opportunityRows = opportunityResult.data;
  const opportunities = ((opportunityRows ?? []) as HomeFeedRow[]).map(mapOpportunity);

  return (
    <>
      <section className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm">
        {tunnel.header_image_url ? (
          isOptimizableSupabaseImage(tunnel.header_image_url) ? (
            <div className="relative h-44 w-full">
              <Image
                src={tunnel.header_image_url}
                alt=""
                fill
                sizes="(max-width: 1024px) 100vw, 1024px"
                fetchPriority="high"
                className="object-cover"
              />
            </div>
          ) : (
            // Arbitrary legacy header URLs remain supported outside Flyloop storage.
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={tunnel.header_image_url}
              alt=""
              loading="eager"
              decoding="async"
              className="h-44 w-full object-cover"
            />
          )
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
    </>
  );
}
