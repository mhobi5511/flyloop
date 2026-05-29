import Image from "next/image";
import { notFound } from "next/navigation";
import { AtSign, MessageCircle } from "lucide-react";
import { AppShell } from "@/components/AppShell";
import { OpportunityCard } from "@/components/OpportunityCard";
import { coaches, opportunities } from "@/lib/demo-data";

export function generateStaticParams() {
  return coaches.map((coach) => ({ id: coach.id }));
}

export default async function CoachProfilePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const coach = coaches.find((item) => item.id === id);

  if (!coach) {
    notFound();
  }

  const coachOpportunities = opportunities.filter(
    (opportunity) => opportunity.coachId === coach.id,
  );

  return (
    <AppShell active="profile">
      <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="flex items-start gap-4">
          <Image
            src={coach.avatarUrl}
            alt=""
            width={96}
            height={96}
            className="size-24 rounded-3xl object-cover"
          />
          <div>
            <p className="text-sm font-bold text-sky-700">{coach.country}</p>
            <h1 className="text-3xl font-black tracking-tight">{coach.name}</h1>
            <p className="mt-2 text-sm leading-6 text-slate-600">
              {coach.headline}
            </p>
          </div>
        </div>
        <p className="mt-5 text-sm leading-6 text-slate-600">{coach.bio}</p>
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
        <div className="mt-5 grid gap-3 sm:grid-cols-2">
          <a
            href={`https://instagram.com/${coach.instagram}`}
            className="flex h-12 items-center justify-center gap-2 rounded-xl border border-slate-200 font-bold text-slate-700"
          >
            <AtSign size={18} /> Instagram
          </a>
          <a
            href={`https://wa.me/${coach.whatsapp.replace(/\D/g, "")}`}
            className="flex h-12 items-center justify-center gap-2 rounded-xl bg-sky-600 font-bold text-white"
          >
            <MessageCircle size={18} /> WhatsApp
          </a>
        </div>
      </section>

      <section className="mt-8">
        <h2 className="text-xl font-bold tracking-tight">Posted opportunities</h2>
        <div className="mt-4 grid gap-3 md:grid-cols-2">
          {coachOpportunities.map((opportunity) => (
            <OpportunityCard key={opportunity.id} opportunity={opportunity} />
          ))}
        </div>
      </section>
    </AppShell>
  );
}
