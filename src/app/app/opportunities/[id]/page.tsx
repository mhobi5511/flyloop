import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { CalendarDays, CheckCircle2, Clock3, MapPin, Users } from "lucide-react";
import { AppShell } from "@/components/AppShell";
import { Avatar } from "@/components/Avatar";
import { Badge } from "@/components/Badge";
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
} from "@/lib/opportunities";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { mapOpportunity, type HomeFeedRow } from "@/lib/supabase/mappers";
import { calculateEstimatedCost } from "@/lib/timetable";
import type { InterestStatus, TunnelTimeStatus } from "@/lib/types";

type OpportunityDetailRow = HomeFeedRow & {
  coach_profile_image_url?: string | null;
};

type BookingRow = {
  id: string;
  minutes: number;
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

export default async function OpportunityDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createSupabaseServerClient();

  const { data: row } = await supabase
    .from("published_opportunities_with_context")
    .select("*")
    .eq("id", id)
    .maybeSingle();

  if (!row) {
    notFound();
  }

  const {
    data: { user },
  } = await supabase.auth.getUser();
  const opportunityRow = row as OpportunityDetailRow;
  const opportunity = mapOpportunity(opportunityRow);
  const isHuckJam = opportunity.type === "huck_jam";
  const { data: viewerInterest } =
    user && user.id !== opportunity.createdBy
      ? await supabase
          .from("opportunity_interests")
          .select("id,status,interest_type,removal_requested_at,tunnel_time_status,tunnel_account_email")
          .eq("opportunity_id", opportunity.id)
          .eq("athlete_id", user.id)
          .maybeSingle()
      : { data: null };
  const viewerInterestStatus =
    (viewerInterest?.status as InterestStatus | undefined) ?? undefined;
  const viewerHasTimetableReminder =
    viewerInterest?.interest_type === "timetable_reminder";
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
  const isOrganizer = user?.id === opportunity.createdBy;
  if (isOrganizer) {
    redirect(`/app/organizer/opportunities/${opportunity.id}`);
  }

  if (user) {
    await supabase
      .from("notifications")
      .update({ read: true })
      .eq("user_id", user.id)
      .eq("opportunity_id", opportunity.id)
      .in("type", [...participantActivityNotificationTypes])
      .eq("read", false);
  }

  const [{ count: publishedSlotCount }, { data: bookingRows }] =
    user && !isHuckJam
      ? await Promise.all([
          supabase
            .from("opportunity_time_slots")
            .select("id", { count: "exact", head: true })
            .eq("opportunity_id", opportunity.id)
            .eq("is_published", true),
          supabase
            .from("opportunity_slot_bookings")
            .select("id,minutes,opportunity_time_slots(slot_date,start_time)")
            .eq("opportunity_id", opportunity.id)
            .eq("user_id", user.id)
            .order("created_at", { ascending: true }),
        ])
      : [{ count: 0 }, { data: [] }];
  const followTargets = [
    { target_type: "tunnel", target_id: opportunity.tunnelId },
    opportunity.coachFollowId
      ? { target_type: "coach", target_id: opportunity.coachFollowId }
      : null,
  ].filter(
    (target): target is { target_type: "tunnel" | "coach"; target_id: string } =>
      Boolean(target),
  );
  const { data: followRows } =
    user && followTargets.length > 0
      ? await supabase
          .from("follows")
          .select("target_type,target_id")
          .eq("follower_id", user.id)
          .in(
            "target_id",
            followTargets.map((target) => target.target_id),
          )
      : { data: [] };
  const followedKeys = new Set(
    (followRows ?? []).map(
      (follow) => `${follow.target_type}:${follow.target_id}`,
    ),
  );
  const followsTunnel = followedKeys.has(`tunnel:${opportunity.tunnelId}`);
  const followsCoach = opportunity.coachFollowId
    ? followedKeys.has(`coach:${opportunity.coachFollowId}`)
    : false;
  const hasPublishedTimetable = (publishedSlotCount ?? 0) > 0;
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
  const canSelectTimes =
    !isHuckJam &&
    hasPublishedTimetable &&
    (isAccepted || (canDirectBook && !isUnavailable));
  const bookedTimes = ((bookingRows ?? []) as BookingRow[])
    .map((booking) => {
      const slot = Array.isArray(booking.opportunity_time_slots)
        ? booking.opportunity_time_slots[0]
        : booking.opportunity_time_slots;

      return slot
        ? {
            id: booking.id,
            date: slot.slot_date,
            time: slot.start_time,
            minutes: booking.minutes,
          }
        : null;
    })
    .filter(
      (
        booking,
      ): booking is { id: string; date: string; time: string; minutes: number } =>
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
  const showAcceptedNextAction = canSelectTimes && isAccepted && !hasBookedSlots;
  const showBookedStatus = canSelectTimes && isAccepted && hasBookedSlots;
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

  return (
    <AppShell active="home">
      <NotificationReadSignal />
      <div className="grid gap-3 lg:grid-cols-[1fr_300px]">
        <article className="rounded-2xl border border-slate-200 bg-white p-3 shadow-sm sm:p-5">
          <div className="flex flex-wrap gap-1.5">
            <Badge tone={opportunity.type === "camp" ? "blue" : "green"}>
              {formatOpportunityType(opportunity.type)}
            </Badge>
            {isLastMinute ? <Badge tone="amber">Last-minute opportunity</Badge> : null}
            {isFull ? <Badge tone="slate">Full</Badge> : null}
            <Badge tone={isUnavailable ? "red" : "slate"}>
              {opportunity.status}
            </Badge>
          </div>

          <h1 className="mt-2 text-2xl font-black leading-tight tracking-tight sm:text-4xl">
            {opportunity.title}
          </h1>

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
                      Your flying times are booked.
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

          {!showAcceptedNextAction && !showBookedStatus ? (
            isDeclined ? (
              <StatusMessage message="Your application was declined." />
            ) : isWaitlisted ? (
              <StatusMessage message="You are on the waitlist." />
            ) : isHuckJam && isAccepted ? (
              <StatusMessage message="You're in. Your spot is confirmed." />
            ) : isAccepted && !hasPublishedTimetable ? (
              <StatusMessage message="You are accepted. The timetable is not available yet." />
            ) : opportunity.bookingMode === "approval_required" ? (
              <div className="mt-4">
                <InterestButton
                  opportunityId={opportunity.id}
                  disabled={isUnavailable}
                  initialStatus={viewerApplicationStatus}
                  compact
                />
              </div>
            ) : !hasPublishedTimetable && !isUnavailable ? (
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
                  targetType="coach"
                  targetId={opportunity.coachFollowId}
                  label={personLabel === "Coach" ? "Follow Coach" : "Follow Organizer"}
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
                  targetType="tunnel"
                  targetId={opportunity.tunnelId}
                  label="Follow Tunnel"
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
                  Your booked times
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
                        Your booked time
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
                <CampTunnelTimeSettings
                  opportunityId={opportunity.id}
                  initialStatus={viewerTunnelTimeStatus}
                  initialAccountEmail={viewerTunnelAccountEmail}
                />
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
    </AppShell>
  );
}

function formatLocation(city?: string, country?: string) {
  if (city && country) {
    return `${city}, ${country}`;
  }

  return city ?? country ?? "Location to be confirmed";
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
  const date = new Intl.DateTimeFormat("en", {
    month: "short",
    day: "numeric",
  }).format(new Date(`${dateValue}T00:00:00`));

  return `${date}, ${timeValue.slice(0, 5)}`;
}

function formatEstimatedPrice(value: number, currency: string) {
  const currencyLabel = currency === "EUR" ? "€" : currency;
  return `${new Intl.NumberFormat("en", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value)} ${currencyLabel}`;
}
