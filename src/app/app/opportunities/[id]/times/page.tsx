import Link from "next/link";
import { notFound } from "next/navigation";
import { AppShell } from "@/components/AppShell";
import { SlotBookingSelector } from "@/components/SlotBookingSelector";
import { formatDateRange, formatOpportunityType } from "@/lib/opportunities";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { mapOpportunity, type HomeFeedRow } from "@/lib/supabase/mappers";
import type { InterestStatus } from "@/lib/types";

type SlotAvailabilityRow = {
  id: string;
  slot_date: string;
  start_time: string;
  duration_minutes: number;
  capacity: number;
  booked_count: number;
  remaining_capacity: number;
  user_has_booking: boolean;
};

export default async function SlotBookingPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    notFound();
  }

  const [{ data: row }, { data: viewerInterest }] = await Promise.all([
    supabase
      .from("published_opportunities_with_context")
      .select("*")
      .eq("id", id)
      .maybeSingle(),
    supabase
      .from("opportunity_interests")
      .select("status,interest_type")
      .eq("opportunity_id", id)
      .eq("athlete_id", user.id)
      .maybeSingle(),
  ]);

  if (!row) {
    notFound();
  }

  const opportunity = mapOpportunity(row as HomeFeedRow);
  if (opportunity.type === "huck_jam") {
    notFound();
  }
  const viewerInterestStatus =
    (viewerInterest?.status as InterestStatus | undefined) ?? undefined;
  const viewerHasTimetableReminder =
    viewerInterest?.interest_type === "timetable_reminder";
  const canBook =
    viewerInterestStatus === "accepted" ||
    (opportunity.bookingMode === "direct_time_booking" &&
      (!viewerInterestStatus || viewerHasTimetableReminder) &&
      opportunity.status === "published" &&
      opportunity.availableSpots > 0);

  if (!canBook) {
    notFound();
  }

  const { data: slotRows, error: slotError } = await supabase.rpc(
    "get_published_opportunity_slots",
    { target_opportunity_id: opportunity.id },
  );

  if (slotError) {
    console.error("Slot availability lookup failed", slotError);
    notFound();
  }

  const slots = ((slotRows ?? []) as SlotAvailabilityRow[]).map((slot) => ({
    id: slot.id,
    slotDate: slot.slot_date,
    startTime: slot.start_time,
    durationMinutes: slot.duration_minutes,
    capacity: slot.capacity,
    bookedCount: slot.booked_count,
    remainingCapacity: slot.remaining_capacity,
    userHasBooking: slot.user_has_booking,
  }));

  return (
    <AppShell active="home">
      <div className="mx-auto max-w-2xl">
        <Link
          href={`/app/opportunities/${opportunity.id}`}
          className="text-sm font-bold text-sky-700"
        >
          Back to opportunity
        </Link>

        <header className="mt-4">
          <div className="flex flex-wrap items-center gap-1.5 text-[0.68rem] font-black uppercase">
            <span className="rounded-full bg-sky-50 px-2 py-0.5 text-sky-700">
              {formatOpportunityType(opportunity.type)}
            </span>
            <span className="rounded-full bg-slate-100 px-2 py-0.5 text-slate-500">
              {formatDateRange(opportunity.startDate, opportunity.endDate)}
            </span>
          </div>
          <h1 className="mt-2 text-2xl font-black tracking-tight">
            Select Times
          </h1>
          <p className="mt-1 text-sm font-semibold text-slate-600">
            {opportunity.title}
          </p>
        </header>

        <div className="mt-4">
          <SlotBookingSelector
            opportunityId={opportunity.id}
            price={opportunity.price}
            priceAppliesToMinutes={opportunity.minMinutesOrHours}
            currency={opportunity.currency}
            slots={slots}
          />
        </div>
      </div>
    </AppShell>
  );
}
