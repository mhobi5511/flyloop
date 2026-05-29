import Image from "next/image";
import { notFound } from "next/navigation";
import { MapPin, Users } from "lucide-react";
import { AppShell } from "@/components/AppShell";
import { OpportunityCard } from "@/components/OpportunityCard";
import { opportunities, tunnels } from "@/lib/demo-data";

export function generateStaticParams() {
  return tunnels.map((tunnel) => ({ id: tunnel.id }));
}

export default async function TunnelProfilePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const tunnel = tunnels.find((item) => item.id === id);

  if (!tunnel) {
    notFound();
  }

  const tunnelOpportunities = opportunities.filter(
    (opportunity) => opportunity.tunnelId === tunnel.id,
  );

  return (
    <AppShell active="home">
      <section className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm">
        <Image
          src={tunnel.imageUrl}
          alt=""
          width={1200}
          height={440}
          className="h-44 w-full object-cover"
        />
        <div className="p-5">
          <p className="flex items-center gap-2 text-sm font-bold text-sky-700">
            <MapPin size={17} />
            {tunnel.city}, {tunnel.country}
          </p>
          <h1 className="mt-2 text-3xl font-black tracking-tight">
            {tunnel.name}
          </h1>
          <div className="mt-4 flex items-center gap-2 text-sm font-semibold text-slate-600">
            <Users size={17} className="text-sky-700" />
            {tunnel.followers.toLocaleString("en")} followers · {tunnel.distanceKm} km away
          </div>
          <div className="mt-5 flex flex-wrap gap-2">
            {tunnel.amenities.map((amenity) => (
              <span
                key={amenity}
                className="rounded-full bg-slate-100 px-3 py-1 text-xs font-bold text-slate-600"
              >
                {amenity}
              </span>
            ))}
          </div>
        </div>
      </section>

      <section className="mt-8">
        <h2 className="text-xl font-bold tracking-tight">Opportunities here</h2>
        <div className="mt-4 grid gap-3 md:grid-cols-2">
          {tunnelOpportunities.map((opportunity) => (
            <OpportunityCard key={opportunity.id} opportunity={opportunity} />
          ))}
        </div>
      </section>
    </AppShell>
  );
}
