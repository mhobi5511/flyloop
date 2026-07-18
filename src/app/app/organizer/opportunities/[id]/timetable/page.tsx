import Link from "next/link";
import { notFound } from "next/navigation";
import { AppShell } from "@/components/AppShell";
import { CampTimetableEditor } from "@/components/CampTimetableEditor";
import { formatDateRange, formatOpportunityType } from "@/lib/opportunities";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getCurrentUser } from "@/lib/supabase/auth";
import type { OpportunityType } from "@/lib/types";

type TimetableOpportunity = {
  id: string;
  title: string;
  type: OpportunityType;
  start_date: string;
  end_date: string;
};

type TimetableSlotRow = {
  id: string;
  slot_date: string;
  start_time: string;
  duration_minutes: number;
  capacity: number;
};

export default async function OrganizerTimetablePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await getCurrentUser();

  const [{ data: profile }, { data: opportunity }, { data: slotRows }] =
    await Promise.all([
      supabase
        .from("profiles")
        .select("is_organizer,wants_to_create_opportunities")
        .eq("id", user?.id)
        .maybeSingle(),
      supabase
        .from("opportunities")
        .select("id,title,type,start_date,end_date")
        .eq("id", id)
        .eq("created_by", user?.id)
        .maybeSingle(),
      supabase
        .from("opportunity_time_slots")
        .select("id,slot_date,start_time,duration_minutes,capacity")
        .eq("opportunity_id", id)
        .order("slot_date", { ascending: true })
        .order("start_time", { ascending: true }),
    ]);

  if (!opportunity) {
    notFound();
  }

  const canCreate =
    profile?.is_organizer === true ||
    profile?.wants_to_create_opportunities === true;
  const currentOpportunity = opportunity as TimetableOpportunity;
  if (currentOpportunity.type === "huck_jam") {
    notFound();
  }
  const initialSlots = ((slotRows ?? []) as TimetableSlotRow[]).map((slot) => ({
    id: slot.id,
    slotDate: slot.slot_date,
    startTime: slot.start_time,
    durationMinutes: slot.duration_minutes,
    capacity: slot.capacity,
  }));

  return (
    <AppShell active="dashboard" canCreate={canCreate}>
      <div className="mx-auto max-w-2xl">
        <Link
          href={`/app/organizer/opportunities/${id}`}
          className="text-sm font-bold text-sky-700"
        >
          Back to opportunity
        </Link>

        <header className="mt-4">
          <div className="flex flex-wrap items-center gap-1.5 text-[0.68rem] font-black uppercase">
            <span className="rounded-full bg-sky-50 px-2 py-0.5 text-sky-700">
              {formatOpportunityType(currentOpportunity.type)}
            </span>
            <span className="rounded-full bg-slate-100 px-2 py-0.5 text-slate-500">
              {formatDateRange(
                currentOpportunity.start_date,
                currentOpportunity.end_date,
              )}
            </span>
          </div>
          <h1 className="mt-2 text-2xl font-black tracking-tight">
            Camp Timetable
          </h1>
          <p className="mt-1 text-sm font-semibold text-slate-600">
            {currentOpportunity.title}
          </p>
        </header>

        <div className="mt-4">
          <CampTimetableEditor
            opportunityId={currentOpportunity.id}
            opportunityStartDate={currentOpportunity.start_date}
            initialSlots={initialSlots}
          />
        </div>
      </div>
    </AppShell>
  );
}
