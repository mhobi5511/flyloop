import Link from "next/link";
import { notFound } from "next/navigation";
import { AppShell } from "@/components/AppShell";
import {
  CreateOpportunityForm,
  type TunnelOption,
} from "@/components/CreateOpportunityForm";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import type { BookingMode, OpportunityType } from "@/lib/types";

type OpportunityEditRow = {
  id: string;
  type: OpportunityType;
  booking_mode: BookingMode | null;
  title: string;
  tunnel_id: string;
  start_date: string;
  end_date: string;
  registration_deadline: string | null;
  session_start: string | null;
  session_end: string | null;
  price: number | string;
  currency: string;
  total_capacity: number;
  min_minutes_or_hours: string | null;
  description: string | null;
  languages: string[] | null;
  disciplines: string[] | null;
  skill_level: string | null;
};

export default async function EditOrganizerOpportunityPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const [{ data: profile }, { data: tunnelRows }, { data: opportunity }] =
    await Promise.all([
      supabase
        .from("profiles")
        .select("is_organizer,wants_to_create_opportunities")
        .eq("id", user?.id)
        .maybeSingle(),
      supabase
        .from("tunnel_profiles")
        .select("id,name,city,country")
        .order("name", { ascending: true }),
      supabase
        .from("opportunities")
        .select("id,type,booking_mode,title,tunnel_id,start_date,end_date,registration_deadline,session_start,session_end,price,currency,total_capacity,min_minutes_or_hours,description,languages,disciplines,skill_level")
        .eq("id", id)
        .eq("created_by", user?.id)
        .maybeSingle(),
    ]);

  if (!opportunity) {
    notFound();
  }

  const canCreate =
    profile?.is_organizer === true ||
    profile?.wants_to_create_opportunities === true;
  const row = opportunity as OpportunityEditRow;
  const tunnels = ((tunnelRows ?? []) as TunnelOption[]).map((tunnel) => ({
    id: tunnel.id,
    name: tunnel.name,
    city: tunnel.city,
    country: tunnel.country,
  }));

  return (
    <AppShell active="dashboard" canCreate={canCreate}>
      <div className="mx-auto max-w-3xl">
        <Link
          href={`/app/organizer/opportunities/${id}`}
          className="text-sm font-bold text-sky-700"
        >
          Back to opportunity
        </Link>
        <h1 className="mt-4 text-3xl font-black tracking-tight">
          Edit opportunity
        </h1>
        <CreateOpportunityForm
          tunnels={tunnels}
          mode="edit"
          initialOpportunity={{
            id: row.id,
            type: row.type,
            bookingMode:
              row.booking_mode ??
              "approval_required",
            title: row.title,
            tunnelId: row.tunnel_id,
            startDate: row.start_date,
            endDate: row.end_date,
            registrationDeadline: row.registration_deadline ?? row.start_date,
            sessionStart: row.session_start ?? "",
            sessionEnd: row.session_end ?? "",
            price: Number(row.price),
            currency: row.currency,
            totalCapacity: row.total_capacity,
            minMinutesOrHours: row.min_minutes_or_hours ?? "",
            description: row.description ?? "",
            languages: (row.languages ?? []).join(", "),
            disciplines: (row.disciplines ?? []).join(", "),
            skillLevel: row.skill_level ?? "",
          }}
        />
      </div>
    </AppShell>
  );
}
