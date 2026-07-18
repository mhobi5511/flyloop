import Link from "next/link";
import { after } from "next/server";
import { notFound, redirect } from "next/navigation";
import { CalendarDays, CheckCircle2, Clock3, MapPin, Users } from "lucide-react";
import { Avatar } from "@/components/Avatar";
import { Badge } from "@/components/Badge";
import { CampPreferencesSummary } from "@/components/CampPreferencesSummary";
import { CampTunnelTimeSummary } from "@/components/CampTunnelTimeSummary";
import { CampTunnelTimeSettings } from "@/components/CampTunnelTimeSettings";
import { FollowButton } from "@/components/FollowButton";
import { FollowGuidance } from "@/components/FollowGuidance";
import { InterestButton } from "@/components/InterestButton";
import { NotificationReadSignal } from "@/components/NotificationReadSignal";
import { RequestCampRemovalButton } from "@/components/RequestCampRemovalButton";
import { ShareOpportunityButton } from "@/components/ShareOpportunityButton";
import { TimetableReminderButton } from "@/components/TimetableReminderButton";
import { participantActivityNotificationTypes } from "@/lib/notifications";
import {
  formatOpportunityDate,
  formatPriceAppliesToMinutes,
  formatSessionTimeRange,
  getCapacityLines,
  formatPrice,
  formatOpportunityType,
  getOpportunityShareText,
  getPublicOpportunityUrl,
  isOpportunityFull,
  isLastMinuteOpportunity,
  isCoachManagedTunnelTimeOpportunity,
} from "@/lib/opportunities";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getCurrentUser } from "@/lib/supabase/auth";
import { mapOpportunity, type HomeFeedRow } from "@/lib/supabase/mappers";
import {
  calculateEstimatedCost,
  formatTimetableDate,
  formatTimetableTime,
} from "@/lib/timetable";
import type { InterestStatus, TunnelTimeStatus } from "@/lib/types";

type OpportunityDetailRow = HomeFeedRow & {
  coach_profile_image_url?: string | null;
};

type BookingRow = {
  id: string;
  slot_id: string;
  minutes: number;
  is_final: boolean;
  opportunity_time_slots:
    | {
        slot_date: string;
        start_time: string;
      }
    | Array<{
        slot_date: string;
        start_time: string;
      }>
    | null;
};

const opportunityDetailSelect =
  "id,type,booking_mode,title,coach_id,tunnel_id,start_date,end_date,registration_deadline,tunnel_time_mode,session_start,session_end,price,currency,total_capacity,available_spots,min_minutes_or_hours,description,languages,disciplines,skill_level,status,contact_method,created_by,created_at,updated_at,is_last_minute,tunnel_name,tunnel_country,tunnel_city,coach_name,coach_follow_id,coach_profile_image_url,tunnel_region,tunnel_latitude,tunnel_longitude,has_published_timetable";

export default async function OpportunityDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createSupabaseServerClient();

  const [opportunityResult, userResult] = await Promise.all([
    supabase
      .from("published_opportunities_with_context")
      .select(opportunityDetailSelect)
      .eq("id", id)
      .maybeSingle(),
    getCurrentUser(),
  ]);
  const row = opportunityResult.data;

  if (!row) {
    notFound();
  }

  const user = userResult.data.user;
  const opportunityRow = row as OpportunityDetailRow;
  const opportunity = mapOpportunity(opportunityRow);
  const isHuckJam = opportunity.type === "huck_jam";
  const isCamp = opportunity.type === "camp";
  const requiresCoachManagedTunnelTime =
    isCoachManagedTunnelTimeOpportunity(opportunity);
  const isOrganizer = user?.id === opportunity.createdBy;
  if (isOrganizer) {
    redirect(`/app/organizer/opportunities/${opportunity.id}`);
  }

  const followTargets = [
    { target_type: "tunnel", target_id: opportunity.tunnelId },
    opportunity.coachFollowId
      ? { target_type: "coach", target_id: opportunity.coachFollowId }
      : null,
  ].filter(
    (target): target is { target_type: "tunnel" | "coach"; target_id: string } =>
      Boolean(target),
  );
  const [
    viewerInterestResult,
    campPreferencesResult,
    bookingResult,
    followResult,
  ] = user
    ? await Promise.all([
        supabase
          .from("opportunity_interests")
          .select("id,status,interest_type,self_booking_enabled,removal_requested_at,tunnel_time_status,tunnel_account_email")
          .eq("opportunity_id", opportunity.id)
          .eq("athlete_id", user.id)
          .maybeSingle(),
        isCamp
          ? supabase
              .from("camp_day_preferences")
              .select("day_id,preferred_minutes")
              .eq("opportunity_id", opportunity.id)
              .eq("participant_id", user.id)
              .order("day_id", { ascending: true })
          : Promise.resolve({ data: [], error: null }),
        !isHuckJam
          ? supabase
              .from("opportunity_slot_bookings")
              .select(
                "id,slot_id,minutes,is_final,opportunity_time_slots(slot_date,start_time)",
              )
              .eq("opportunity_id", opportunity.id)
              .eq("user_id", user.id)
              .eq("is_final", true)
              .order("created_at", { ascending: true })
          : Promise.resolve({ data: [], error: null }),
        followTargets.length > 0
          ? supabase
              .from("follows")
              .select("target_type,target_id")
              .eq("follower_id", user.id)
              .in(
                "target_id",
                followTargets.map((target) => target.target_id),
              )
          : Promise.resolve({ data: [], error: null }),
      ])
    : [
        { data: null, error: null },
        { data: [], error: null },
        { data: [], error: null },
        { data: [], error: null },
      ];

  if (viewerInterestResult.error) {
    console.error("Opportunity viewer interest lookup failed", viewerInterestResult.error);
  }
  if (campPreferencesResult.error) {
    console.error("Opportunity camp preference lookup failed", campPreferencesResult.error);
  }
  if (bookingResult.error) {
    console.error("Opportunity booking lookup failed", bookingResult.error);
  }
  if (followResult.error) {
    console.error("Opportunity follow lookup failed", followResult.error);
  }

  const viewerInterest = viewerInterestResult.data;
  const campPreferenceRows = campPreferencesResult.data ?? [];
  const bookingRows = bookingResult.data ?? [];
  const followRows = followResult.data ?? [];
  const viewerInterestStatus =
    (viewerInterest?.status as InterestStatus | undefined) ?? undefined;
  const viewerHasTimetableReminder =
    viewerInterest?.interest_type === "timetable_reminder";
  const viewerSelfBookingEnabled =
    viewerInterest?.self_booking_enabled === true;
  const viewerTunnelTimeStatus =
    (viewerInterest?.tunnel_time_status as TunnelTimeStatus | null | undefined) ??
    null;
  const viewerTunnelAccountEmail =
    (viewerInterest?.tunnel_account_email as string | null | undefined) ?? null;
  const viewerApplicationStatus = viewerHasTimetableReminder
    ? undefined
    : viewerInterestStatus === "withdrawn"
      ? undefined
      : viewerInterestStatus;
  if (user) {
    after(async () => {
      const { error: markReadError } = await supabase
        .from("notifications")
        .update({ read: true })
        .eq("user_id", user.id)
        .eq("opportunity_id", opportunity.id)
        .in("type", [...participantActivityNotificationTypes])
        .eq("read", false);

      if (markReadError) {
        console.error("Opportunity notification read update failed", markReadError);
      }
    });
  }
  const followedKeys = new Set(
    (followRows ?? []).map(
      (follow) => `${follow.target_type}:${follow.target_id}`,
    ),
  );
  const followsTunnel = followedKeys.has(`tunnel:${opportunity.tunnelId}`);
  const followsCoach = opportunity.coachFollowId
    ? followedKeys.has(`coach:${opportunity.coachFollowId}`)
    : false;
  const hasPublishedTimetable = opportunity.hasPublishedTimetable === true;
  const isAccepted = viewerApplicationStatus === "accepted";
  const canRequestCampRemoval =
    !isHuckJam && isAccepted && Boolean(viewerInterest?.id);
  const canManageParticipation =
    !isHuckJam && isAccepted && Boolean(viewerInterest?.id);
  const isDeclined = viewerApplicationStatus === "declined";
  const isWaitlisted = viewerApplicationStatus === "waitlist";
  const isBlockedFromBooking = isDeclined || isWaitlisted;
  const isFull = isOpportunityFull(opportunity);
  const isUnavailable = opportunity.status !== "published" || isFull;
  const canDirectBook =
    !isHuckJam &&
    opportunity.bookingMode === "direct_time_booking" &&
    !isBlockedFromBooking &&
    (!viewerApplicationStatus ||
      viewerApplicationStatus === "accepted" ||
      viewerHasTimetableReminder);
  const canCampSelfBook =
    isCamp &&
    hasPublishedTimetable &&
    viewerApplicationStatus === "accepted" &&
    viewerSelfBookingEnabled;
  const canSelectTimes =
    (!isHuckJam && !isCamp && canDirectBook && !isUnavailable) || canCampSelfBook;
  const bookedTimes = ((bookingRows ?? []) as BookingRow[])
    .map((booking) => {
      const slot = Array.isArray(booking.opportunity_time_slots)
        ? booking.opportunity_time_slots[0]
        : booking.opportunity_time_slots;

      return slot
        ? {
            id: booking.id,
            slotId: booking.slot_id,
            date: slot.slot_date,
            time: slot.start_time,
            minutes: booking.minutes,
            isFinal: booking.is_final,
          }
        : null;
    })
    .filter(
      (
        booking,
      ): booking is {
        id: string;
        slotId: string;
        date: string;
        time: string;
        minutes: number;
        isFinal: boolean;
      } =>
        Boolean(booking),
    )
    .sort((a, b) => `${a.date} ${a.time}`.localeCompare(`${b.date} ${b.time}`));
  const bookedMinutes = bookedTimes.reduce(
    (total, booking) => total + booking.minutes,
    0,
  );
  const bookedEstimate = calculateEstimatedCost(
    opportunity.price,
    bookedMinutes,
    opportunity.minMinutesOrHours,
  );
  const hasBookedSlots = bookedTimes.length > 0;
  const bookedTimesByDay = groupBookedTimesByDay(bookedTimes);
  const showAcceptedNextAction = canSelectTimes && isAccepted && !hasBookedSlots;
  const showBookedStatus = canSelectTimes && isAccepted && hasBookedSlots;
  const canShowCampApply =
    isCamp &&
    !viewerApplicationStatus &&
    (opportunity.status === "published" || isFull);
  const sessionRange = formatSessionTimeRange(
    opportunity.sessionStart,
    opportunity.sessionEnd,
  );

  const isLastMinute =
    opportunity.isLastMinute ?? isLastMinuteOpportunity(opportunity);
  const description = getMeaningfulDescription(opportunity.description);
  const personLabel =
    opportunity.type === "camp" && opportunity.coachName ? "Coach" : "Organizer";
  const profileUserId = opportunity.coachFollowId ?? opportunity.createdBy;
  const publicUrl = getPublicOpportunityUrl(opportunity.id);
  const shareLabel = `Share ${formatOpportunityType(opportunity.type)}`;
  const shareText = getOpportunityShareText(opportunity, publicUrl);
  const detailRows = getDetailRows({
    description,
    skillLevel: opportunity.skillLevel,
    disciplines: opportunity.disciplines,
    languages: opportunity.languages,
    minMinutesOrHours: opportunity.minMinutesOrHours,
    registrationDeadline: opportunity.registrationDeadline,
    opportunityType: opportunity.type,
  });
  const capacityLines = getCapacityLines(opportunity);
  const tunnelTimeBadgeLabel = requiresCoachManagedTunnelTime
    ? "Must Buy Tunnel Time"
    : "";

  return (
    <>
      <NotificationReadSignal />
      <div className="grid gap-3 lg:grid-cols-[1fr_300px]">
        <article className="rounded-2xl border border-slate-200 bg-white p-3 shadow-sm sm:p-5">
          <div className="flex flex-wrap gap-1.5">
            <Badge tone={opportunity.type === "camp" ? "blue" : "green"}>
              {formatOpportunityType(opportunity.type)}
            </Badge>
            {requiresCoachManagedTunnelTime ? (
              <Badge tone="amber">{tunnelTimeBadgeLabel}</Badge>
            ) : null}
            {isLastMinute ? <Badge tone="amber">Last-minute opportunity</Badge> : null}
            {isFull ? <Badge tone="slate">Full</Badge> : null}
            <Badge tone={isUnavailable ? "red" : "slate"}>
              {opportunity.status}
            </Badge>
          </div>

          <h1 className="mt-2 text-2xl font-black leading-tight tracking-tight sm:text-4xl">
            {opportunity.title}
          </h1>

          {requiresCoachManagedTunnelTime ? (
            <div className="mt-3 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-amber-950">
              <p className="text-xs font-black uppercase tracking-wide text-amber-700">
                Tunnel time requirement
              </p>
              <p className="mt-1 text-sm font-semibold leading-6">
                Tunnel time for this camp must be purchased through the coach.
                Existing tunnel time at this tunnel cannot be used for this opportunity.
              </p>
            </div>
          ) : null}

          <div className="mt-2 grid gap-1.5 rounded-xl bg-slate-50 px-3 py-2 text-sm font-bold text-slate-800">
            <p className="flex items-center gap-2">
              <CalendarDays size={16} className="text-sky-700" />
              {formatOpportunityDate(
                opportunity.type,
                opportunity.startDate,
                opportunity.endDate,
              )}
            </p>
            <p className="flex items-center gap-2">
              <Users size={16} className="text-sky-700" />
              {capacityLines[0]}
            </p>
            {capacityLines[1] ? (
              <p className="flex items-center gap-2">
                <Clock3 size={16} className="text-sky-700" />
                {capacityLines[1]}
              </p>
            ) : null}
            {sessionRange ? (
              <p className="flex items-center gap-2">
                <Clock3 size={16} className="text-sky-700" />
                Session: {sessionRange}
              </p>
            ) : null}
          </div>

          {showAcceptedNextAction ? (
            <div className="mt-4 rounded-2xl border border-sky-200 bg-sky-50 px-4 py-3">
              <p className="text-xs font-black uppercase tracking-wide text-sky-700">
                You&apos;re accepted
              </p>
              <div className="mt-1.5 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <p className="text-base font-black text-slate-950">
                  Next step: select your flying times.
                </p>
                <Link
                  href={`/app/opportunities/${opportunity.id}/times`}
                  className="inline-flex h-11 items-center justify-center gap-2 rounded-xl bg-sky-600 px-4 text-sm font-black text-white transition hover:bg-sky-700"
                >
                  <Clock3 size={17} /> Select Times
                </Link>
              </div>
            </div>
          ) : showBookedStatus ? (
            <div className="mt-4 rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3">
              <div className="flex items-start gap-2">
                <CheckCircle2 size={19} className="mt-0.5 shrink-0 text-emerald-700" />
                <div className="min-w-0 flex-1">
                  <p className="text-xs font-black uppercase tracking-wide text-emerald-700">
                    You&apos;re in
                  </p>
                  <div className="mt-1.5 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                    <p className="text-base font-black text-slate-950">
                      Your flying times are saved as draft.
                    </p>
                    <Link
                      href={`/app/opportunities/${opportunity.id}/times`}
                      className="inline-flex h-11 items-center justify-center gap-2 rounded-xl bg-emerald-600 px-4 text-sm font-black text-white transition hover:bg-emerald-700"
                    >
                      <Clock3 size={17} /> Edit Times
                    </Link>
                  </div>
                </div>
              </div>
            </div>
          ) : null}

          {isCamp && isAccepted ? (
            hasPublishedTimetable ? (
              <div className="mt-4 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
                <div className="flex items-start gap-2">
                  <CheckCircle2 size={19} className="mt-0.5 shrink-0 text-emerald-700" />
                  <div className="min-w-0 flex-1">
                    <p className="text-xs font-black uppercase tracking-wide text-emerald-700">
                      Your timetable is published
                    </p>
                    <p className="mt-1 text-base font-black text-slate-950">
                      Your final flight times are below.
                    </p>
                    {hasBookedSlots ? (
                      <div className="mt-3 grid gap-3">
                        {bookedTimesByDay.map((day) => (
                          <section
                            key={day.date}
                            className="rounded-xl border border-slate-200 bg-slate-50 p-3"
                          >
                            <h4 className="text-sm font-black text-slate-950">
                              {formatTimetableDate(day.date)}
                            </h4>
                            <div className="mt-2 grid gap-1.5">
                              {day.bookings.map((booking) => (
                                <div
                                  key={booking.id}
                                  className="flex items-center justify-between gap-3 rounded-lg bg-white px-3 py-2"
                                >
                                  <p className="text-sm font-black text-slate-950">
                                    {formatTimetableTime(booking.time)}
                                  </p>
                                  <p className="text-xs font-semibold text-slate-500">
                                    {booking.minutes} min
                                  </p>
                                </div>
                              ))}
                            </div>
                          </section>
                        ))}
                      </div>
                    ) : (
                      <p className="mt-3 rounded-xl border border-dashed border-slate-200 bg-slate-50 px-3 py-2 text-sm font-semibold text-slate-600">
                        No final flight times are assigned yet.
                      </p>
                    )}
                    {isCamp ? (
                      <div className="mt-4">
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
                            status={viewerTunnelTimeStatus}
                            accountEmail={viewerTunnelAccountEmail}
                          />
                        ) : null}
                      </div>
                    ) : null}
                  </div>
                </div>
              </div>
            ) : (
              <StatusMessage message="Your spot is confirmed. The timetable will be available later." />
            )
          ) : null}

          {!showAcceptedNextAction && !showBookedStatus ? (
            isDeclined ? (
              <StatusMessage message="Your application was declined." />
            ) : isWaitlisted ? (
              <StatusMessage message="You are on the waitlist." />
            ) : isHuckJam && isAccepted ? (
              <StatusMessage message="You're in. Your spot is confirmed." />
            ) : !isCamp && isAccepted && !hasPublishedTimetable ? (
              <StatusMessage message="You are accepted. The timetable is not available yet." />
            ) : isCamp && viewerApplicationStatus && !hasPublishedTimetable ? (
              <div className="mt-4 grid gap-4 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
                <div>
                  <p className="text-sm font-black text-slate-950">
                    {viewerApplicationStatus === "accepted"
                      ? "Your spot is confirmed."
                      : "Application sent"}
                  </p>
                  <p className="mt-1 text-sm font-semibold text-slate-600">
                    {viewerApplicationStatus === "accepted"
                      ? "The timetable will be available later."
                      : "Your preferences were sent to the coach."}
                  </p>
                </div>
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
                    status={viewerTunnelTimeStatus}
                    accountEmail={viewerTunnelAccountEmail}
                  />
                ) : null}
              </div>
            ) : canShowCampApply ? (
              <div className="mt-4 rounded-2xl border border-sky-200 bg-sky-50 p-4 shadow-sm sm:p-5">
                <div className="flex flex-col gap-4">
                  <div>
                    <p className="text-xs font-black uppercase tracking-wide text-sky-700">
                      Apply to join
                    </p>
                    <p className="mt-1 text-base font-black text-slate-950">
                      Choose your flying preferences and submit your application.
                    </p>
                    <p className="mt-1 text-sm font-semibold text-slate-600">
                      This camp still requires coach approval before any timetable is visible.
                    </p>
                    {requiresCoachManagedTunnelTime ? (
                      <p className="mt-2 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-sm font-semibold leading-6 text-amber-900">
                        Tunnel time must be purchased through the coach for this camp.
                      </p>
                    ) : null}
                    {isFull ? (
                      <p className="mt-2 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-sm font-semibold leading-6 text-amber-900">
                        This camp has already reached its participant capacity.
                        You can still apply, but there is a high likelihood that
                        your application will be placed on the waitlist or declined.
                        You may continue if you wish.
                      </p>
                    ) : null}
                  </div>
                  <Link
                    href={`/app/opportunities/${opportunity.id}/times`}
                    className="inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-xl bg-sky-600 px-5 py-3 text-base font-black text-white transition hover:bg-sky-700 sm:text-lg"
                  >
                    Apply with preferences
                  </Link>
                </div>
              </div>
            ) : !isCamp && opportunity.bookingMode === "approval_required" ? (
              <div className="mt-4">
                <InterestButton
                  key={opportunity.id}
                  opportunityId={opportunity.id}
                  disabled={false}
                  initialStatus={viewerApplicationStatus ?? null}
                  compact
                  isFull={isFull}
                />
              </div>
            ) : !isCamp && !hasPublishedTimetable && !isUnavailable ? (
              <div className="mt-4">
                <TimetableReminderButton
                  opportunityId={opportunity.id}
                  initialReminderSet={viewerHasTimetableReminder}
                />
              </div>
            ) : null
          ) : null}

          <div className="mt-4 flex flex-col gap-3 rounded-xl border border-slate-200 px-3 py-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex min-w-0 items-center gap-3">
              <Link href={`/app/users/${profileUserId}`} className="shrink-0">
                <Avatar
                  name={opportunity.coachName ?? personLabel}
                  imageUrl={opportunityRow.coach_profile_image_url}
                  size="md"
                />
              </Link>
              <div className="min-w-0">
                <Link
                  href={`/app/users/${profileUserId}`}
                  className="block truncate text-base font-black text-slate-900 hover:text-sky-700"
                >
                  {opportunity.coachName ?? personLabel}
                </Link>
                <p className="mt-0.5 text-xs font-bold uppercase text-slate-400">
                  {personLabel}
                </p>
              </div>
            </div>
            {opportunity.coachFollowId && !isOrganizer ? (
              <div className="shrink-0">
                <FollowButton
                  key={`coach:${opportunity.coachFollowId}`}
                  targetType="coach"
                  targetId={opportunity.coachFollowId}
                  label={personLabel === "Coach" ? "Follow Coach" : "Follow Organizer"}
                  initialFollowing={followsCoach}
                  userId={user?.id}
                />
              </div>
            ) : null}
          </div>

          <div className="mt-3 flex flex-col gap-2 rounded-xl border border-slate-200 px-3 py-2.5 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex min-w-0 items-start gap-2 text-sky-700">
              <MapPin size={17} className="mt-0.5 shrink-0" />
              <div className="min-w-0">
                <Link
                  className="block truncate text-sm font-black text-slate-900"
                  href={`/app/tunnels/${opportunity.tunnelId}`}
                >
                  {opportunity.tunnelName}
                </Link>
                <p className="text-xs font-semibold text-slate-600">
                  {formatLocation(opportunity.tunnelCity, opportunity.tunnelCountry)}
                </p>
              </div>
            </div>
            {!isOrganizer ? (
              <div className="shrink-0">
                <FollowButton
                  key={`tunnel:${opportunity.tunnelId}`}
                  targetType="tunnel"
                  targetId={opportunity.tunnelId}
                  label="Follow Tunnel"
                  initialFollowing={followsTunnel}
                  userId={user?.id}
                />
              </div>
            ) : null}
          </div>

          <div className="mt-3 rounded-2xl bg-sky-50 px-4 py-4 text-sky-800">
            <p className="text-xs font-black uppercase tracking-wide text-sky-700">
              {isHuckJam ? "Participation Fee" : "Price"}
            </p>
            <p className="mt-1 text-3xl font-black tracking-tight text-slate-950">
              {formatPrice(opportunity.price, opportunity.currency)}
            </p>
            <p className="mt-0.5 text-sm font-bold text-sky-800">
              {isHuckJam
                ? "Participation Fee"
                : `per ${formatPriceAppliesToMinutes(
                    opportunity.minMinutesOrHours,
                  )} min`}
            </p>
          </div>

          {canSelectTimes && hasBookedSlots ? (
            <div className="mt-3 rounded-2xl border border-slate-200 bg-white p-3">
              <div>
                <p className="text-xs font-black uppercase text-slate-500">
                  Your saved times
                </p>
                <p className="mt-1 text-xs font-semibold text-slate-500">
                  Modify your selections via &apos;Edit Times&apos;.
                </p>
                <div className="mt-2 flex flex-wrap gap-2">
                  {bookedTimes.map((booking) => (
                    <span
                      key={booking.id}
                      className="rounded-full bg-sky-50 px-2.5 py-1 text-xs font-black text-sky-700"
                    >
                      {formatBookedTime(booking.date, booking.time)}
                    </span>
                  ))}
                </div>
                <div className="mt-3 rounded-xl bg-slate-50 p-3">
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <p className="text-xs font-black uppercase text-slate-500">
                        Your saved time
                      </p>
                      <p className="mt-1 text-lg font-black text-slate-950">
                        {bookedMinutes} min
                      </p>
                    </div>
                    <div>
                      <p className="text-xs font-black uppercase text-slate-500">
                        Estimated total
                      </p>
                      <p className="mt-1 text-lg font-black text-slate-950">
                        {formatEstimatedPrice(bookedEstimate, opportunity.currency)}
                      </p>
                    </div>
                  </div>
                  <p className="mt-2 text-xs font-semibold leading-5 text-slate-500">
                    This is an estimate based on your selected times and may change.
                  </p>
                </div>
              </div>
            </div>
          ) : null}

          {canSelectTimes && !isAccepted ? (
            <div className="mt-3 rounded-2xl border border-slate-200 bg-white p-3">
              <Link
                href={`/app/opportunities/${opportunity.id}/times`}
                className="flex h-11 w-full items-center justify-center gap-2 rounded-xl bg-sky-600 px-4 text-sm font-black text-white transition hover:bg-sky-700"
              >
                <Clock3 size={17} /> Select Times
              </Link>
            </div>
          ) : null}

          <div className="mt-3 flex flex-wrap gap-2">
            <ShareOpportunityButton
              label={shareLabel}
              shareText={shareText}
              url={publicUrl}
              compact
            />
          </div>

          {canManageParticipation && viewerInterest?.id ? (
            <details className="mt-2 rounded-xl border border-slate-200 bg-white px-3 py-2">
              <summary className="cursor-pointer list-none text-sm font-black text-slate-900">
                Manage Participation v
              </summary>
              <div className="mt-3 grid gap-3">
                {!requiresCoachManagedTunnelTime ? (
                  <CampTunnelTimeSettings
                    opportunityId={opportunity.id}
                    initialStatus={viewerTunnelTimeStatus}
                    initialAccountEmail={viewerTunnelAccountEmail}
                  />
                ) : null}
                {canRequestCampRemoval ? (
                  <div className="rounded-2xl border border-slate-200 bg-white p-3">
                    <h3 className="text-sm font-black text-slate-950">
                      Leave Camp
                    </h3>
                    <RequestCampRemovalButton
                      interestId={viewerInterest.id}
                      initialRequested={Boolean(viewerInterest.removal_requested_at)}
                      embedded
                    />
                  </div>
                ) : null}
              </div>
            </details>
          ) : null}

          {detailRows.length > 0 ? (
            <details className="mt-2 rounded-xl border border-slate-200 bg-white px-3 py-2">
              <summary className="cursor-pointer list-none text-sm font-black text-slate-900">
                Additional Information v
              </summary>
              <div className="mt-2 grid gap-1.5 text-sm leading-5 text-slate-600">
                {detailRows.map((row) => (
                  <p key={row.label}>
                    <span className="font-bold text-slate-800">{row.label}:</span>{" "}
                    {row.value}
                  </p>
                ))}
              </div>
            </details>
          ) : null}

          <FollowGuidance
            opportunityId={opportunity.id}
            show={Boolean(
              user &&
                !isOrganizer &&
                (!followsTunnel || (opportunity.coachFollowId && !followsCoach)),
            )}
          />

        </article>

        <aside className="hidden content-start gap-4 lg:grid">
          <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
            <p className="text-sm font-bold text-slate-500">Contact</p>
            <p className="mt-2 text-sm leading-6 text-slate-600">
              Contact happens outside Flyloop via{" "}
              {opportunity.contactMethod === "whatsapp" ? "WhatsApp" : "Instagram"}.
            </p>
          </div>
        </aside>
      </div>
    </>
  );
}

function formatLocation(city?: string, country?: string) {
  if (city && country) {
    return `${city}, ${country}`;
  }

  return city ?? country ?? "Location to be confirmed";
}

function groupBookedTimesByDay(
  bookings: Array<{ id: string; date: string; time: string; minutes: number }>,
) {
  const groups = new Map<string, typeof bookings>();

  for (const booking of bookings) {
    const dayBookings = groups.get(booking.date) ?? [];
    dayBookings.push(booking);
    groups.set(booking.date, dayBookings);
  }

  return [...groups.entries()]
    .sort(([dateA], [dateB]) => dateA.localeCompare(dateB))
    .map(([date, dayBookings]) => ({
      date,
      bookings: dayBookings.sort((a, b) => a.time.localeCompare(b.time)),
    }));
}

function StatusMessage({ message }: { message: string }) {
  return (
    <div className="mt-4 rounded-2xl border border-slate-200 bg-slate-50 p-3 text-sm font-bold text-slate-700">
      {message}
    </div>
  );
}

function getMeaningfulDescription(description: string) {
  const trimmed = description.trim();

  if (
    !trimmed ||
    trimmed === "Camp published by a Flyloop organizer." ||
    trimmed === "Huck Jam published on Flyloop."
  ) {
    return "";
  }

  return trimmed;
}

function getDetailRows({
  description,
  skillLevel,
  disciplines,
  languages,
  minMinutesOrHours,
  registrationDeadline,
  opportunityType,
}: {
  description: string;
  skillLevel: string | null;
  disciplines: string[];
  languages: string[];
  minMinutesOrHours?: string;
  registrationDeadline: string | null;
  opportunityType: "camp" | "huck_jam";
}) {
  const rows: Array<{ label: string; value: string }> = [];

  if (opportunityType === "camp" && minMinutesOrHours?.trim()) {
    rows.push({
      label: "Price applies to",
      value: `${formatPriceAppliesToMinutes(minMinutesOrHours)} min`,
    });
  }

  if (skillLevel?.trim()) {
    rows.push({ label: "Skill level", value: skillLevel });
  }

  if (languages.length > 0) {
    rows.push({ label: "Languages", value: languages.join(", ") });
  }

  if (disciplines.length > 0) {
    rows.push({ label: "Disciplines", value: disciplines.join(", ") });
  }

  if (registrationDeadline) {
    rows.push({
      label: "Registration",
      value: formatRegistrationDeadline(registrationDeadline),
    });
  }

  if (description) {
    rows.push({ label: "Description", value: description });
  }

  return rows;
}

function formatRegistrationDeadline(value: string) {
  const date = new Date(`${value}T00:00:00.000Z`);

  if (Number.isNaN(date.getTime())) {
    return "Registration date to be confirmed";
  }

  return `Registration closes ${new Intl.DateTimeFormat("en", {
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(date)}`;
}

function formatBookedTime(dateValue: string, timeValue: string) {
  return timeValue.slice(0, 5);
}

function formatEstimatedPrice(value: number, currency: string) {
  const currencyLabel = currency === "EUR" ? "€" : currency;
  return `${new Intl.NumberFormat("en", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value)} ${currencyLabel}`;
}
