import Link from "next/link";
import { AtSign, MessageCircle, Plus } from "lucide-react";
import { AppShell } from "@/components/AppShell";
import { InterestStatusSupabaseSelect } from "@/components/InterestStatusSupabaseSelect";
import { formatDateRange, formatPrice } from "@/lib/opportunities";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import type { InterestStatus } from "@/lib/types";

type OpportunityRow = {
  id: string;
  title: string;
  start_date: string;
  end_date: string;
  price: number | string;
  currency: string;
  available_spots: number;
};

type InterestRow = {
  id: string;
  opportunity_id: string;
  status: InterestStatus;
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
      }>;
};

export default async function OrganizerDashboardPage() {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const { data: profile } = await supabase
    .from("profiles")
    .select("wants_to_create_opportunities")
    .eq("id", user?.id)
    .maybeSingle();

  if (!profile?.wants_to_create_opportunities) {
    return (
      <AppShell active="dashboard">
        <div className="mx-auto max-w-2xl rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
          <h1 className="text-3xl font-black tracking-tight">
            Organizer Dashboard
          </h1>
          <p className="mt-2 text-sm leading-6 text-slate-600">
            Enable creating opportunities in your profile to access organizer
            tools.
          </p>
          <Link
            href="/app/onboarding"
            className="mt-4 inline-flex h-11 items-center rounded-xl bg-sky-600 px-4 text-sm font-bold text-white"
          >
            Open profile
          </Link>
        </div>
      </AppShell>
    );
  }

  const { data: opportunities } = await supabase
    .from("opportunities")
    .select("id,title,start_date,end_date,price,currency,available_spots")
    .eq("created_by", user?.id)
    .order("start_date", { ascending: true });
  const opportunityRows = (opportunities ?? []) as OpportunityRow[];
  const opportunityIds = opportunityRows.map((opportunity) => opportunity.id);
  const { data: interests } =
    opportunityIds.length > 0
      ? await supabase
          .from("opportunity_interests")
          .select("id,opportunity_id,status,profiles!opportunity_interests_athlete_id_fkey(full_name,country,phone,whatsapp_number,instagram_handle)")
          .in("opportunity_id", opportunityIds)
          .order("created_at", { ascending: false })
      : { data: [] };

  const interestRows = (interests ?? []) as InterestRow[];

  return (
    <AppShell active="dashboard">
      <div className="grid gap-5 lg:grid-cols-[0.85fr_1.15fr]">
        <section>
          <div className="flex items-start justify-between gap-3">
            <div>
              <h1 className="text-3xl font-black tracking-tight">
                Organizer Dashboard
              </h1>
              <p className="mt-2 text-sm leading-6 text-slate-600">
                See demand signals and contact interested people externally.
              </p>
            </div>
            <Link
              href="/app/create"
              className="flex h-11 shrink-0 items-center gap-2 rounded-xl bg-sky-600 px-4 text-sm font-bold text-white"
            >
              <Plus size={17} /> Post Opportunity
            </Link>
          </div>

          <div className="mt-5 grid gap-3">
            {opportunityRows.map((opportunity) => (
              <Link
                key={opportunity.id}
                href={`/app/opportunities/${opportunity.id}`}
                className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm"
              >
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <p className="text-xs font-bold uppercase tracking-[0.16em] text-sky-600">
                      {formatDateRange(opportunity.start_date, opportunity.end_date)}
                    </p>
                    <h2 className="mt-1 font-bold text-slate-950">
                      {opportunity.title}
                    </h2>
                    <p className="mt-1 text-sm font-semibold text-slate-500">
                      {formatPrice(
                        typeof opportunity.price === "string"
                          ? Number.parseFloat(opportunity.price)
                          : opportunity.price,
                        opportunity.currency,
                      )}
                    </p>
                  </div>
                  <div className="rounded-xl bg-sky-50 px-3 py-2 text-sm font-bold text-sky-700">
                    {opportunity.available_spots} open
                  </div>
                </div>
              </Link>
            ))}
          </div>
        </section>

        <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-bold text-sky-700">Inbound interest</p>
              <h2 className="text-2xl font-black tracking-tight">People</h2>
            </div>
            <span className="rounded-full bg-slate-100 px-3 py-1 text-sm font-bold text-slate-700">
              {interestRows.length}
            </span>
          </div>

          <div className="mt-5 grid gap-4">
            {interestRows.map((interest) => {
              const athlete = Array.isArray(interest.profiles)
                ? interest.profiles[0]
                : interest.profiles;
              const opportunity = opportunityRows.find(
                (item) => item.id === interest.opportunity_id,
              );
              const phone = athlete?.whatsapp_number ?? athlete?.phone ?? "";
              const instagram = athlete?.instagram_handle ?? "";

              return (
                <div
                  key={interest.id}
                  className="rounded-2xl border border-slate-200 p-4"
                >
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <h3 className="font-bold text-slate-950">
                        {athlete?.full_name ?? "Interested user"}
                      </h3>
                      <p className="text-sm text-slate-600">
                        {athlete?.country ?? "Country not set"} - {opportunity?.title}
                      </p>
                    </div>
                    <InterestStatusSupabaseSelect
                      id={interest.id}
                      value={interest.status}
                    />
                  </div>

                  <div className="mt-4 grid gap-2 sm:grid-cols-2">
                    {phone ? (
                      <a
                        href={`https://wa.me/${phone.replace(/\D/g, "")}`}
                        className="flex h-11 items-center justify-center gap-2 rounded-xl bg-emerald-500 text-sm font-bold text-white"
                      >
                        <MessageCircle size={17} /> WhatsApp
                      </a>
                    ) : null}
                    {instagram ? (
                      <a
                        href={`https://instagram.com/${instagram}`}
                        className="flex h-11 items-center justify-center gap-2 rounded-xl border border-slate-200 text-sm font-bold text-slate-700"
                      >
                        <AtSign size={17} /> Instagram
                      </a>
                    ) : null}
                  </div>
                  <p className="mt-3 text-xs font-semibold text-slate-500">
                    Phone: {phone || "Not provided"}
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
