import Link from "next/link";
import { notFound } from "next/navigation";
import { AppShell } from "@/components/AppShell";
import { CampApplyPreferencesForm } from "@/components/CampApplyPreferencesForm";
import { CampPreferencesSummary } from "@/components/CampPreferencesSummary";
import { CampTunnelTimeSummary } from "@/components/CampTunnelTimeSummary";
import { NotificationReadSignal } from "@/components/NotificationReadSignal";
import { SlotBookingSelector } from "@/components/SlotBookingSelector";
import { participantActivityNotificationTypes } from "@/lib/notifications";
import {
  formatDateRange,
  formatOpportunityType,
  isOpportunityFull,
  isCoachManagedTunnelTimeOpportunity,
} from "@/lib/opportunities";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { mapOpportunity, type HomeFeedRow } from "@/lib/supabase/mappers";
import type { InterestStatus, TunnelTimeStatus } from "@/lib/types";

type SlotAvailabilityRow = {
  id: string;
  slot_date: string;
  start_time: string;
  duration_minutes: number;
  capacity: number;
  booked_count: number;
  remaining_capacity: number;
  user_has_booking: boolean;
  release_requested_at: string | null;
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
      .select("status,interest_type,self_booking_enabled,tunnel_time_status,tunnel_account_email")
      .eq("opportunity_id", id)
      .eq("athlete_id", user.id)
      .maybeSingle(),
  ]);

  if (!row) {
    notFound();
  }

  const opportunity = mapOpportunity(row as HomeFeedRow);
  const isFull = isOpportunityFull(opportunity);
  const requiresCoachManagedTunnelTime =
    isCoachManagedTunnelTimeOpportunity(opportunity);
  const viewerInterestStatus =
    (viewerInterest?.status as InterestStatus | undefined) ?? undefined;
  const viewerHasTimetableReminder =
    viewerInterest?.interest_type === "timetable_reminder";
  const viewerSelfBookingEnabled =
    viewerInterest?.self_booking_enabled === true;
  const viewerApplicationStatus =
    viewerHasTimetableReminder || viewerInterestStatus === "withdrawn"
      ? undefined
      : viewerInterestStatus;
  const { data: campPreferenceRows } =
    opportunity.type === "camp" && user
      ? await supabase
          .from("camp_day_preferences")
          .select("day_id,preferred_minutes")
          .eq("opportunity_id", opportunity.id)
          .eq("participant_id", user.id)
          .order("day_id", { ascending: true })
      : { data: [] };
  const { count: publishedSlotCount } = await supabase
    .from("opportunity_time_slots")
    .select("id", { count: "exact", head: true })
    .eq("opportunity_id", opportunity.id)
    .eq("is_published", true);
  const hasPublishedTimetable = (publishedSlotCount ?? 0) > 0;

  await supabase
    .from("notifications")
    .update({ read: true })
    .eq("user_id", user.id)
    .eq("opportunity_id", opportunity.id)
    .in("type", [...participantActivityNotificationTypes])
    .eq("read", false);

  if (opportunity.type === "camp") {
    const shouldShowSelfBookingSlots =
      viewerApplicationStatus === "accepted" &&
      viewerSelfBookingEnabled &&
      hasPublishedTimetable;
    const { data: bookingRows } = shouldShowSelfBookingSlots
      ? await supabase
          .from("opportunity_slot_bookings")
          .select("slot_id,release_requested_at")
          .eq("opportunity_id", opportunity.id)
          .eq("user_id", user.id)
      : { data: [] };
    const { data: slotRows, error: slotError } = shouldShowSelfBookingSlots
      ? await supabase.rpc("get_published_opportunity_slots", {
          target_opportunity_id: opportunity.id,
        })
      : { data: null, error: null };

    if (slotError) {
      console.error("Camp self-booking slot lookup failed", slotError);
      notFound();
    }

    const releaseRequestBySlotId = new Map(
      ((bookingRows ?? []) as Array<{
        slot_id: string;
        release_requested_at: string | null;
      }>).map((booking) => [booking.slot_id, booking.release_requested_at]),
    );

    const slots =
      ((slotRows ?? []) as SlotAvailabilityRow[]).map((slot) => ({
        id: slot.id,
        slotDate: slot.slot_date,
        startTime: slot.start_time,
        durationMinutes: slot.duration_minutes,
        capacity: slot.capacity,
        bookedCount: slot.booked_count,
        remainingCapacity: slot.remaining_capacity,
        userHasBooking: slot.user_has_booking,
        releaseRequestedAt: releaseRequestBySlotId.get(slot.id) ?? slot.release_requested_at,
      })) ?? [];
    const changesClosed = areBookingChangesClosed(
      opportunity.registrationDeadline,
      opportunity.startDate,
    );

    return (
      <AppShell active="home">
        <NotificationReadSignal />
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
          </header>

          <div className="mt-4">
            {viewerApplicationStatus ? (
              <div className="grid gap-4 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
                <div>
                  <p className="text-sm font-black text-slate-950">
                    {viewerApplicationStatus === "accepted"
                      ? viewerSelfBookingEnabled
                        ? "Your spot is confirmed."
                        : "Your coach will assign your flight times."
                      : "Application sent"}
                  </p>
                  <p className="mt-1 text-sm font-semibold text-slate-600">
                    {viewerApplicationStatus === "accepted"
                      ? viewerSelfBookingEnabled
                        ? "Choose from the published slots below."
                        : "Your coach will publish or assign your timetable manually."
                      : "Your preferences were sent to the coach."}
                  </p>
                </div>
                {shouldShowSelfBookingSlots ? (
                  <SlotBookingSelector
                    opportunityId={opportunity.id}
                    price={opportunity.price}
                    priceAppliesToMinutes={opportunity.minMinutesOrHours}
                    currency={opportunity.currency}
                    slots={slots}
                    selfBookingEnabled={viewerSelfBookingEnabled}
                    tunnelTimeMode={opportunity.tunnelTimeMode}
                    initialTunnelTimeStatus={
                      (viewerInterest?.tunnel_time_status as TunnelTimeStatus | null) ??
                      null
                    }
                    initialTunnelAccountEmail={viewerInterest?.tunnel_account_email ?? null}
                    changesClosed={changesClosed}
                  />
                ) : null}
                <CampPreferencesSummary
                  campStartDate={opportunity.startDate}
                  campEndDate={opportunity.endDate}
                  preferences={(campPreferenceRows ?? []).map((preference) => ({
                    dayId: preference.day_id,
                    preferredMinutes: preference.preferred_minutes,
                  }))}
                />
                {!requiresCoachManagedTunnelTime ? (
                  <CampTunnelTimeSummary
                    status={viewerInterest?.tunnel_time_status as TunnelTimeStatus | null}
                    accountEmail={viewerInterest?.tunnel_account_email ?? null}
                  />
                ) : null}
              </div>
            ) : (
              <CampApplyPreferencesForm
                opportunityId={opportunity.id}
                campStartDate={opportunity.startDate}
                campEndDate={opportunity.endDate}
                tunnelTimeMode={opportunity.tunnelTimeMode}
                isFull={isFull}
              />
            )}
          </div>
        </div>
      </AppShell>
    );
  }

  const canBook =
    (viewerApplicationStatus === "accepted" && viewerSelfBookingEnabled) ||
    (opportunity.bookingMode === "direct_time_booking" &&
      (!viewerApplicationStatus || viewerHasTimetableReminder) &&
      opportunity.status === "published" &&
      !isFull);

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
  const changesClosed = areBookingChangesClosed(
    opportunity.registrationDeadline,
    opportunity.startDate,
  );

  return (
    <AppShell active="home">
      <NotificationReadSignal />
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
            initialTunnelTimeStatus={
              (viewerInterest?.tunnel_time_status as TunnelTimeStatus | null) ?? null
            }
            initialTunnelAccountEmail={viewerInterest?.tunnel_account_email ?? null}
            changesClosed={changesClosed}
          />
        </div>
      </div>
    </AppShell>
  );
}

function areBookingChangesClosed(
  registrationDeadline: string | null,
  startDate: string,
) {
  const closesOn = registrationDeadline || startDate;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const closeDate = new Date(`${closesOn}T00:00:00`);
  closeDate.setHours(0, 0, 0, 0);

  return today.getTime() > closeDate.getTime();
}
