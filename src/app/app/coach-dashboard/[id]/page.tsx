import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { NotificationReadSignal } from "@/components/NotificationReadSignal";
import { CoachDashboardWorkspace } from "@/components/CoachDashboardWorkspace";
import {
  formatOpportunityDate,
  formatPriceAppliesToMinutes,
} from "@/lib/opportunities";
import { getFlyloopProfileHistories } from "@/lib/flyloop-history";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { coachNotificationTypes } from "@/lib/notifications";
import { normalizeCampTunnelTimeMode } from "@/lib/camp-tunnel-time-mode";
import { getTimetableSummary } from "@/lib/timetable";
import type {
  BookingMode,
  InterestStatus,
  OpportunityStatus,
  OpportunityType,
} from "@/lib/types";

export const metadata: Metadata = {
  title: "Coach Operations Dashboard",
};

type CoachProfileRow = {
  full_name: string | null;
  is_organizer: boolean | null;
  wants_to_create_opportunities: boolean | null;
};

type CoachOpportunityRow = {
  id: string;
  title: string;
  type: OpportunityType;
  booking_mode: BookingMode;
  tunnel_time_mode: string | null;
  status: OpportunityStatus;
  start_date: string;
  end_date: string;
  session_start: string | null;
  session_end: string | null;
  registration_deadline: string | null;
  total_capacity: number;
  available_spots: number;
  price: number | string;
  currency: string;
  min_minutes_or_hours: string | null;
  description: string | null;
  tunnel_id: string | null;
  tunnel_shared_at: string | null;
  created_at: string | null;
  updated_at: string | null;
  tunnel_profiles:
    | { name: string; city: string | null; country: string | null }
    | Array<{ name: string; city: string | null; country: string | null }>
    | null;
  opportunity_interests:
    | Array<{
        id: string;
        status: InterestStatus;
        self_booking_enabled: boolean | null;
        created_at: string | null;
        removal_requested_at: string | null;
        tunnel_time_status: string | null;
        tunnel_account_email: string | null;
        profiles:
          | {
              id: string;
              full_name: string | null;
              country: string | null;
              phone: string | null;
              whatsapp_number: string | null;
              instagram_handle: string | null;
        profile_image_url: string | null;
            }
          | Array<{
              id: string;
              full_name: string | null;
              country: string | null;
              phone: string | null;
              whatsapp_number: string | null;
              instagram_handle: string | null;
              profile_image_url: string | null;
            }>
          | null;
        participant_profiles:
          | {
              id: string;
              user_id: string | null;
              full_name: string | null;
              normalized_email: string | null;
              phone: string | null;
              status: "registered" | "guest" | "claim_pending" | "archived";
            }
          | Array<{
              id: string;
              user_id: string | null;
              full_name: string | null;
              normalized_email: string | null;
              phone: string | null;
              status: "registered" | "guest" | "claim_pending" | "archived";
            }>
          | null;
      }>
    | null;
  opportunity_dummy_participants:
    | Array<{
        id: string;
        display_name: string;
        phone: string | null;
        email: string | null;
        coach_note: string | null;
        label: string | null;
        created_at: string;
      }>
    | null;
  opportunity_time_slots:
    | Array<{
        id: string;
        slot_date: string;
        start_time: string;
        duration_minutes: number;
        capacity: number;
        is_published: boolean;
              opportunity_slot_bookings:
          | Array<{
              id: string;
              minutes: number;
              rotation_minutes: number | string | null;
              user_id: string | null;
              is_final: boolean;
              finalized_at: string | null;
              release_requested_at: string | null;
              participant_profile_id: string | null;
              dummy_participant_id: string | null;
              profiles:
                | {
                    full_name: string;
                    phone: string | null;
                    whatsapp_number: string | null;
                  }
                | Array<{
                    full_name: string;
                    phone: string | null;
                    whatsapp_number: string | null;
                  }>
                | null;
              participant_profiles:
                | {
                    id: string;
                    user_id: string | null;
                    full_name: string | null;
                    phone: string | null;
                  }
                | Array<{
                    id: string;
                    user_id: string | null;
                    full_name: string | null;
                    phone: string | null;
                  }>
                | null;
              opportunity_dummy_participants:
                | {
                    id: string;
                    display_name: string | null;
                    phone: string | null;
                  }
                | Array<{
                    id: string;
                    display_name: string | null;
                    phone: string | null;
                  }>
                | null;
            }>
          | null;
      }>
    | null;
};

type PublicUserProfileRow = {
  id: string;
  full_name: string | null;
  country: string | null;
  city: string | null;
  bio: string | null;
  profile_image_url: string | null;
  instagram_handle: string | null;
  website_url: string | null;
  youtube_url: string | null;
  home_tunnel_name: string | null;
  home_tunnel_city: string | null;
  home_tunnel_country: string | null;
};

type PreferenceRow = {
  opportunity_id: string;
  participant_id: string;
  participant_profile_id: string | null;
  dummy_participant_id: string | null;
  day_id: number;
  preferred_minutes: number;
};

type CoachDashboardWorkspaceProps = Parameters<typeof CoachDashboardWorkspace>[0];
type CampWorkspace = CoachDashboardWorkspaceProps["camps"][number];

export default async function CoachWorkspaceCampPage({
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
    redirect("/login?next=/app/coach-dashboard");
  }

  const [profileResult, opportunityResult] = await Promise.all([
      supabase
        .from("profiles")
        .select("full_name,is_organizer,wants_to_create_opportunities")
        .eq("id", user.id)
        .maybeSingle(),
      supabase
        .from("opportunities")
        .select(
          "id,title,type,booking_mode,tunnel_time_mode,status,start_date,end_date,session_start,session_end,registration_deadline,total_capacity,available_spots,price,currency,min_minutes_or_hours,description,tunnel_id,tunnel_shared_at,created_at,updated_at,tunnel_profiles(name,city,country),opportunity_interests(id,status,self_booking_enabled,created_at,removal_requested_at,tunnel_time_status,tunnel_account_email,profiles!opportunity_interests_athlete_id_fkey(id,full_name,country,phone,whatsapp_number,instagram_handle,profile_image_url),participant_profiles!opportunity_interests_participant_profile_id_fkey(id,user_id,full_name,normalized_email,phone,status)),opportunity_dummy_participants(id,display_name,phone,email,coach_note,label,created_at),opportunity_time_slots(id,slot_date,start_time,duration_minutes,capacity,is_published,opportunity_slot_bookings(id,minutes,rotation_minutes,user_id,participant_profile_id,dummy_participant_id,is_final,finalized_at,release_requested_at,profiles!opportunity_slot_bookings_user_id_fkey(full_name,phone,whatsapp_number),participant_profiles!opportunity_slot_bookings_participant_profile_id_fkey(id,user_id,full_name,phone),opportunity_dummy_participants!opportunity_slot_bookings_dummy_participant_id_fkey(id,display_name,phone)))",
        )
        .eq("id", id)
        .eq("created_by", user.id)
        .maybeSingle(),
    ]);

  if (profileResult.error) {
    const profileError = formatSupabaseError(profileResult.error);
    if (profileError) {
      console.error("Coach workspace profile lookup failed", profileError);
    }
  }

  if (opportunityResult.error) {
    const opportunityError = formatSupabaseError(opportunityResult.error);
    if (opportunityError) {
      console.error("Coach workspace opportunity lookup failed", opportunityError);
    }
  }

  const profile = (profileResult.data ?? null) as CoachProfileRow | null;
  const canCreate =
    profile?.is_organizer === true ||
    profile?.wants_to_create_opportunities === true;

  if (!canCreate) {
    redirect("/app/dashboard");
  }

  const { error: markReadError } = await supabase
    .from("notifications")
    .update({ read: true })
    .eq("user_id", user.id)
    .eq("read", false)
    .in("type", [...coachNotificationTypes]);

  if (markReadError) {
    console.error("Coach workspace read-state update failed", markReadError);
  }

  const opportunity = (opportunityResult.data ?? null) as CoachOpportunityRow | null;

  if (!opportunity) {
    notFound();
  }

  const selectedCamp = await toCampWorkspace(opportunity, supabase);

  const camps = [selectedCamp];
  return (
    <>
      <CoachDashboardWorkspace
        selectedCampId={id}
        camps={camps}
      />
      <NotificationReadSignal />
    </>
  );
}

async function toCampWorkspace(
  row: CoachOpportunityRow,
  supabase: Awaited<ReturnType<typeof createSupabaseServerClient>>,
): Promise<CampWorkspace> {
  const tunnel = firstRelation(row.tunnel_profiles);
  const interests = (row.opportunity_interests ?? []).filter(
    (interest) => interest.status !== "withdrawn",
  );
  const participantIds = [
    ...new Set(
      interests
        .map((interest) => firstRelation(interest.profiles)?.id)
        .filter((userId): userId is string => Boolean(userId)),
    ),
  ];
  const [publicProfilesResult, historyByParticipantId, preferencesResult] =
    await Promise.all([
      participantIds.length > 0
        ? supabase
            .from("public_user_profiles")
            .select(
              "id,full_name,country,city,bio,profile_image_url,instagram_handle,website_url,youtube_url,home_tunnel_name,home_tunnel_city,home_tunnel_country",
            )
            .in("id", participantIds)
        : Promise.resolve({ data: [], error: null }),
      getFlyloopProfileHistories(supabase, participantIds),
      supabase
        .from("camp_day_preferences")
        .select("opportunity_id,participant_id,participant_profile_id,dummy_participant_id,day_id,preferred_minutes")
        .eq("opportunity_id", row.id)
        .order("day_id", { ascending: true }),
    ]);

  if (publicProfilesResult.error) {
    console.error(
      "Coach workspace public profile lookup failed",
      publicProfilesResult.error,
    );
  }

  if (preferencesResult.error) {
    console.error(
      "Coach workspace day preference lookup failed",
      preferencesResult.error,
    );
  }

  const publicProfilesById = new Map(
    ((publicProfilesResult.data ?? []) as PublicUserProfileRow[]).map((profile) => [
      profile.id,
      profile,
    ]),
  );

  const registeredParticipants: CampWorkspace["participants"] = interests
    .map((interest) => {
      const profile = firstRelation(interest.profiles);
      const participantProfile = firstRelation(interest.participant_profiles);
      const participantProfileId = participantProfile?.id ?? profile?.id ?? interest.id;
      const accountUserId = participantProfile?.user_id ?? profile?.id ?? null;
      const publicProfile = accountUserId ? publicProfilesById.get(accountUserId) : null;
      const profileHistory = accountUserId ? historyByParticipantId.get(accountUserId) : null;
      const displayName =
        participantProfile?.full_name?.trim() ||
        profile?.full_name?.trim() ||
        "Participant";

      return {
        id: participantProfileId,
        interestId: interest.id,
        userId: participantProfileId,
        accountUserId,
        participantProfileId,
        dummyParticipantId: null,
        participantStatus: participantProfile?.status ?? "registered",
        isDummy: false,
        name: displayName,
        email: participantProfile?.normalized_email ?? "",
        phone: participantProfile?.phone ?? profile?.whatsapp_number ?? profile?.phone ?? "",
        coachNote: "",
        label: "",
        country: publicProfile?.country ?? profile?.country ?? "",
        city: publicProfile?.city ?? null,
        bio: publicProfile?.bio ?? null,
        instagramHandle: publicProfile?.instagram_handle ?? profile?.instagram_handle ?? null,
        websiteUrl: publicProfile?.website_url ?? null,
        youtubeUrl: publicProfile?.youtube_url ?? null,
        homeTunnelName: publicProfile?.home_tunnel_name ?? null,
        homeTunnelCity: publicProfile?.home_tunnel_city ?? null,
        homeTunnelCountry: publicProfile?.home_tunnel_country ?? null,
        profileImageUrl: publicProfile?.profile_image_url ?? profile?.profile_image_url ?? "",
        status: interest.status,
        selfBookingEnabled: interest.self_booking_enabled === true,
        createdAt: interest.created_at ?? new Date().toISOString(),
        removalRequestedAt: interest.removal_requested_at,
        tunnelTimeStatus: interest.tunnel_time_status,
        tunnelAccountEmail: interest.tunnel_account_email,
        profileStats: profileHistory?.stats ?? null,
      };
    });
  const dummyParticipants: CampWorkspace["participants"] = (
    row.opportunity_dummy_participants ?? []
  ).map((dummy) => ({
    id: dummy.id,
    interestId: dummy.id,
    userId: dummy.id,
    accountUserId: null,
    participantProfileId: "",
    dummyParticipantId: dummy.id,
    participantStatus: "dummy",
    isDummy: true,
    name: dummy.display_name?.trim() || "Planning participant",
    email: dummy.email ?? "",
    phone: dummy.phone ?? "",
    coachNote: dummy.coach_note ?? "",
    label: dummy.label ?? "",
    country: "",
    city: null,
    bio: null,
    instagramHandle: null,
    websiteUrl: null,
    youtubeUrl: null,
    homeTunnelName: null,
    homeTunnelCity: null,
    homeTunnelCountry: null,
    profileImageUrl: "",
    status: "accepted",
    selfBookingEnabled: false,
    createdAt: dummy.created_at,
    removalRequestedAt: null,
    tunnelTimeStatus: null,
    tunnelAccountEmail: null,
    profileStats: null,
  }));

  const participants = [...registeredParticipants, ...dummyParticipants]
    .sort((a, b) => statusRank(a.status) - statusRank(b.status) || a.name.localeCompare(b.name));

  const preferenceRows = (preferencesResult.data ?? []) as PreferenceRow[];

  const timetableSource = row.opportunity_time_slots ?? [];
  const timetableSlots = timetableSource.map((slot) => ({
    id: slot.id,
    slotDate: slot.slot_date,
    startTime: slot.start_time,
    durationMinutes: slot.duration_minutes,
    capacity: slot.capacity,
    isPublished: slot.is_published,
    bookings: (slot.opportunity_slot_bookings ?? []).map((booking) => {
      const bookingProfile = firstRelation(booking.profiles);
      const bookingParticipantProfile = firstRelation(booking.participant_profiles);
      const bookingDummy = firstRelation(booking.opportunity_dummy_participants);
      const bookingParticipantProfileId =
        booking.dummy_participant_id ??
        booking.participant_profile_id ??
        bookingParticipantProfile?.id ??
        booking.user_id ??
        booking.id;

      return {
        id: booking.id,
        minutes: booking.minutes,
        rotationMinutes:
          booking.rotation_minutes === null ? null : Number(booking.rotation_minutes),
        userId: bookingParticipantProfileId,
        dummyParticipantId: booking.dummy_participant_id,
        isDummy: Boolean(booking.dummy_participant_id),
        athleteName:
          bookingDummy?.display_name ??
          bookingParticipantProfile?.full_name ??
          bookingProfile?.full_name ??
          "Participant",
        athletePhone:
          bookingDummy?.phone ??
          bookingParticipantProfile?.phone ??
          bookingProfile?.whatsapp_number ??
          bookingProfile?.phone ??
          "",
        isFinal: booking.is_final,
        finalizedAt: booking.finalized_at,
        releaseRequestedAt: booking.release_requested_at,
      };
    }),
  }));

  const summary = getTimetableSummary(
    timetableSlots,
    Number(row.price),
    row.min_minutes_or_hours,
  );

  return {
    id: row.id,
    title: row.title,
    type: row.type,
    bookingMode: row.booking_mode,
    status: row.status,
    startDate: row.start_date,
    endDate: row.end_date,
    registrationDeadline: row.registration_deadline,
    sessionStart: row.session_start,
    sessionEnd: row.session_end,
    totalCapacity: row.total_capacity,
    availableSpots: row.available_spots,
    price: Number(row.price),
    currency: row.currency,
    priceAppliesToMinutes: formatPriceAppliesToMinutes(row.min_minutes_or_hours),
    description: row.description ?? "",
    tunnelId: row.tunnel_id ?? "",
    tunnelTimeMode: normalizeCampTunnelTimeMode(row.tunnel_time_mode),
    tunnelSharedAt: row.tunnel_shared_at,
    tunnelName: tunnel?.name ?? "Tunnel to be confirmed",
    tunnelLocation: formatLocation(tunnel?.city, tunnel?.country),
    dateLabel: formatOpportunityDate(row.type, row.start_date, row.end_date),
    participants,
    preferences: preferenceRows.map((preference) => ({
      opportunityId: preference.opportunity_id,
      participantId:
        preference.dummy_participant_id ??
        preference.participant_profile_id ??
        preference.participant_id,
      dayId: preference.day_id,
      preferredMinutes: preference.preferred_minutes,
    })),
    timetableSlots,
    summary: {
      totalSlots: summary.totalSlots,
      bookedSlots: summary.bookedSlots,
      openSlots: summary.openSlots,
      totalTimetableMinutes: summary.totalTimetableMinutes,
      totalBookedMinutes: summary.totalBookedMinutes,
      totalAvailableMinutes: summary.totalAvailableMinutes,
      estimatedRevenue: summary.estimatedRevenue,
    },
  };
}

function firstRelation<T>(value: T | T[] | null | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

function formatSupabaseError(error: unknown) {
  if (!error || typeof error !== "object") {
    return null;
  }

  const { message, code, details, hint } = error as {
    message?: string;
    code?: string;
    details?: string | null;
    hint?: string | null;
  };

  const parts = [message, details, hint, code ? `Code: ${code}` : null].filter(
    (value): value is string => Boolean(value),
  );

  return parts.length > 0 ? parts.join(" ") : null;
}

function statusRank(status: InterestStatus) {
  if (status === "pending") {
    return 0;
  }

  if (status === "accepted") {
    return 1;
  }

  if (status === "waitlist") {
    return 2;
  }

  return 3;
}

function formatLocation(city?: string | null, country?: string | null) {
  return [city, country].filter(Boolean).join(", ");
}
