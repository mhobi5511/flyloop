import { redirect } from "next/navigation";
import { CoachDashboardWorkspace } from "@/components/CoachDashboardWorkspace";
import { organizerActivityNotificationTypes } from "@/lib/notifications";
import {
  formatOpportunityDate,
  formatSessionTimeRange,
} from "@/lib/opportunities";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getTunnelDashboardUrl } from "@/lib/tunnel-dashboard";
import {
  getTimetableSummary,
  type TimetableSlot,
} from "@/lib/timetable";
import type {
  BookingMode,
  InterestStatus,
  OpportunityStatus,
  OpportunityType,
} from "@/lib/types";

type CoachDashboardSearchParams = {
  camp?: string | string[];
};

type OpportunityRow = {
  id: string;
  title: string;
  type: OpportunityType;
  booking_mode: BookingMode;
  status: OpportunityStatus;
  start_date: string;
  end_date: string;
  registration_deadline: string | null;
  session_start: string | null;
  session_end: string | null;
  total_capacity: number;
  available_spots: number;
  price: number | string;
  currency: string;
  min_minutes_or_hours: string | null;
  description: string | null;
  tunnel_id: string;
  tunnel_profiles:
    | { name: string; city: string | null; country: string | null }
    | Array<{ name: string; city: string | null; country: string | null }>
    | null;
  opportunity_interests:
    | Array<{
        id: string;
        status: InterestStatus;
        created_at: string | null;
        removal_requested_at: string | null;
        tunnel_time_status: string | null;
        tunnel_account_email: string | null;
        interest_type: string | null;
        profiles:
          | {
              id: string;
              full_name: string | null;
              phone: string | null;
              whatsapp_number: string | null;
              country: string | null;
              profile_image_url: string | null;
            }
          | Array<{
              id: string;
              full_name: string | null;
              phone: string | null;
              whatsapp_number: string | null;
              country: string | null;
              profile_image_url: string | null;
            }>
          | null;
      }>
    | null;
};

type TunnelDashboardLinkRow = {
  opportunity_id: string;
  secret: string;
};

type SlotRow = {
  id: string;
  opportunity_id: string;
  slot_date: string;
  start_time: string;
  duration_minutes: number;
  capacity: number;
  opportunity_slot_bookings:
    | Array<{
        id: string;
        minutes: number;
        rotation_minutes: number | string | null;
        user_id: string;
        is_final: boolean;
        release_requested_at: string | null;
        profiles:
          | {
              full_name: string | null;
              phone: string | null;
              whatsapp_number: string | null;
            }
          | Array<{
              full_name: string | null;
              phone: string | null;
              whatsapp_number: string | null;
            }>
          | null;
      }>
    | null;
};

type CampPreferenceRow = {
  opportunity_id: string;
  participant_id: string;
  day_id: number;
  preferred_minutes: number;
};

export default async function CoachDashboardPage({
  searchParams,
}: {
  searchParams?: Promise<CoachDashboardSearchParams>;
}) {
  const resolvedSearchParams = searchParams ? await searchParams : {};
  const selectedCampParam = Array.isArray(resolvedSearchParams.camp)
    ? resolvedSearchParams.camp[0]
    : resolvedSearchParams.camp;
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login?next=/app/coach-dashboard");
  }

  const [
    { data: profile },
    { data: coachProfile },
    opportunitiesResult,
    { data: notifications },
    { data: tunnels },
  ] = await Promise.all([
    supabase
      .from("profiles")
      .select("full_name,is_organizer,wants_to_create_opportunities")
      .eq("id", user.id)
      .maybeSingle(),
    supabase
      .from("coach_profiles")
      .select("languages,disciplines")
      .eq("user_id", user.id)
      .maybeSingle(),
    supabase
      .from("opportunities")
      .select("id,title,type,booking_mode,status,start_date,end_date,registration_deadline,session_start,session_end,total_capacity,available_spots,price,currency,min_minutes_or_hours,description,tunnel_id,tunnel_profiles(name,city,country),opportunity_interests(id,status,created_at,removal_requested_at,tunnel_time_status,tunnel_account_email,interest_type,profiles!opportunity_interests_athlete_id_fkey(id,full_name,phone,whatsapp_number,country,profile_image_url))")
      .eq("created_by", user.id)
      .order("start_date", { ascending: true }),
    supabase
      .from("notifications")
      .select("id,title,body,type,created_at,opportunity_id")
      .eq("user_id", user.id)
      .in("type", [...organizerActivityNotificationTypes])
      .order("created_at", { ascending: false }),
    supabase
      .from("tunnel_profiles")
      .select("id,name,city,country")
      .order("name", { ascending: true }),
  ]);

  const canCreate =
    profile?.is_organizer === true ||
    profile?.wants_to_create_opportunities === true;

  if (!canCreate) {
    redirect("/app/dashboard");
  }

  if (opportunitiesResult.error) {
    console.error("Coach dashboard opportunities lookup failed", opportunitiesResult.error);
  }

  const opportunityRows = (opportunitiesResult.data ?? []) as OpportunityRow[];
  const opportunityIds = opportunityRows.map((opportunity) => opportunity.id);
  const { data: preferenceRows, error: preferenceRowsError } =
    opportunityIds.length > 0
      ? await supabase
          .from("camp_day_preferences")
          .select("opportunity_id,participant_id,day_id,preferred_minutes")
          .in("opportunity_id", opportunityIds)
          .order("day_id", { ascending: true })
      : { data: [], error: null };
  const { data: slots, error: slotsError } =
    opportunityIds.length > 0
      ? await supabase
          .from("opportunity_time_slots")
          .select("id,opportunity_id,slot_date,start_time,duration_minutes,capacity,opportunity_slot_bookings(id,minutes,rotation_minutes,user_id,is_final,release_requested_at,profiles!opportunity_slot_bookings_user_id_fkey(full_name,phone,whatsapp_number))")
          .in("opportunity_id", opportunityIds)
          .order("slot_date", { ascending: true })
          .order("start_time", { ascending: true })
      : { data: [], error: null };
  const { data: tunnelDashboardLinks, error: tunnelDashboardLinksError } =
    opportunityIds.length > 0
      ? await supabase
          .from("opportunity_tunnel_dashboard_links")
          .select("opportunity_id,secret")
          .in("opportunity_id", opportunityIds)
      : { data: [], error: null };

  if (slotsError) {
    console.error("Coach dashboard slots lookup failed", slotsError);
  }
  if (preferenceRowsError) {
    console.error("Coach dashboard camp preferences lookup failed", preferenceRowsError);
  }
  if (tunnelDashboardLinksError) {
    console.error(
      "Coach dashboard tunnel links lookup failed",
      tunnelDashboardLinksError,
    );
  }

  const slotRows = (slots ?? []) as SlotRow[];
  const preferencesByOpportunity = groupPreferencesByOpportunity(
    (preferenceRows ?? []) as CampPreferenceRow[],
  );
  const tunnelDashboardLinkByOpportunityId = new Map(
    ((tunnelDashboardLinks ?? []) as TunnelDashboardLinkRow[]).map((link) => [
      link.opportunity_id,
      link,
    ]),
  );
  const missingTunnelDashboardCampIds = opportunityRows
    .filter(
      (opportunity) =>
        opportunity.type === "camp" &&
        !tunnelDashboardLinkByOpportunityId.has(opportunity.id),
    )
    .map((opportunity) => opportunity.id);

  if (missingTunnelDashboardCampIds.length > 0) {
    const createdLinks = await Promise.all(
      missingTunnelDashboardCampIds.map(async (opportunityId) => {
        const { data: createdLink, error } = await supabase
          .from("opportunity_tunnel_dashboard_links")
          .insert({ opportunity_id: opportunityId })
          .select("opportunity_id,secret")
          .single();

        if (error || !createdLink?.secret) {
          console.error("Coach dashboard tunnel link creation failed", {
            opportunityId,
            error,
          });
          return null;
        }

        return createdLink as TunnelDashboardLinkRow;
      }),
    );

    for (const link of createdLinks) {
      if (link) {
        tunnelDashboardLinkByOpportunityId.set(link.opportunity_id, link);
      }
    }
  }
  const workspaceCamps = opportunityRows.map((opportunity) => {
    const tunnel = Array.isArray(opportunity.tunnel_profiles)
      ? opportunity.tunnel_profiles[0]
      : opportunity.tunnel_profiles;
    const participants = (opportunity.opportunity_interests ?? [])
      .filter((interest) => interest.interest_type !== "timetable_reminder")
      .map((interest) => {
        const profileRow = Array.isArray(interest.profiles)
          ? interest.profiles[0]
          : interest.profiles;

        return {
          id: interest.id,
          userId: profileRow?.id ?? "",
          name: profileRow?.full_name ?? "Participant",
          email: "",
          phone: profileRow?.whatsapp_number ?? profileRow?.phone ?? "",
          country: profileRow?.country ?? "",
          profileImageUrl: profileRow?.profile_image_url ?? "",
          status: interest.status,
          createdAt: interest.created_at ?? "",
          removalRequestedAt: interest.removal_requested_at,
          tunnelTimeStatus: interest.tunnel_time_status,
          tunnelAccountEmail: interest.tunnel_account_email,
        };
      });
    const timetableSlots = slotRows
      .filter((slot) => slot.opportunity_id === opportunity.id)
      .map((slot): TimetableSlot => ({
        id: slot.id,
        slotDate: slot.slot_date,
        startTime: slot.start_time,
        durationMinutes: slot.duration_minutes,
        capacity: slot.capacity,
        isPublished: slot.is_published,
        bookings: (slot.opportunity_slot_bookings ?? []).map((booking) => {
          const bookingProfile = Array.isArray(booking.profiles)
            ? booking.profiles[0]
            : booking.profiles;

          return {
            id: booking.id,
            minutes: booking.minutes,
            rotationMinutes:
              booking.rotation_minutes === null
                ? null
                : Number(booking.rotation_minutes),
            userId: booking.user_id,
            athleteName: bookingProfile?.full_name ?? "Participant",
            athletePhone:
              bookingProfile?.whatsapp_number ?? bookingProfile?.phone ?? "",
            isFinal: booking.is_final,
            releaseRequestedAt: booking.release_requested_at,
          };
        }),
      }));
    const preferences = (preferencesByOpportunity.get(opportunity.id) ?? []).map(
      (preference) => ({
        opportunityId: preference.opportunity_id,
        participantId: preference.participant_id,
        dayId: preference.day_id,
        preferredMinutes: preference.preferred_minutes,
      }),
    );
    const summary = getTimetableSummary(
      timetableSlots,
      Number(opportunity.price),
      opportunity.min_minutes_or_hours,
    );
    const tunnelDashboardLink = tunnelDashboardLinkByOpportunityId.get(opportunity.id);
    const tunnelDashboardUrl =
      opportunity.type === "camp" && tunnelDashboardLink?.secret
        ? getTunnelDashboardUrl(tunnelDashboardLink.secret)
        : "";

    return {
      id: opportunity.id,
      title: opportunity.title,
      type: opportunity.type,
      bookingMode: opportunity.booking_mode,
      status: opportunity.status,
      startDate: opportunity.start_date,
      endDate: opportunity.end_date,
      registrationDeadline: opportunity.registration_deadline,
      sessionStart: opportunity.session_start,
      sessionEnd: opportunity.session_end,
      totalCapacity: opportunity.total_capacity,
      availableSpots: opportunity.available_spots,
      price: Number(opportunity.price),
      currency: opportunity.currency,
      priceAppliesToMinutes: opportunity.min_minutes_or_hours ?? "60",
      description: opportunity.description ?? "",
      tunnelId: opportunity.tunnel_id,
      tunnelName: tunnel?.name ?? "Tunnel to be confirmed",
      tunnelLocation: [tunnel?.city, tunnel?.country].filter(Boolean).join(", "),
      tunnelDashboardUrl,
      dateLabel: formatWorkspaceDateLabel({
        type: opportunity.type,
        startDate: opportunity.start_date,
        endDate: opportunity.end_date,
        sessionStart: opportunity.session_start,
        sessionEnd: opportunity.session_end,
      }),
      participants,
      preferences,
      timetableSlots,
      summary,
    };
  }).sort(compareWorkspaceOpportunities);
  const selectedCampId =
    workspaceCamps.find((camp) => camp.id === selectedCampParam)?.id ??
    getDefaultSelectedCampId(workspaceCamps) ??
    "";

  return (
    <CoachDashboardWorkspace
      key={selectedCampId || "empty"}
      coachName={profile?.full_name ?? "Coach"}
      selectedCampId={selectedCampId}
      camps={workspaceCamps}
      tunnels={tunnels ?? []}
      inheritedCoachProfile={{
        languages: coachProfile?.languages ?? [],
        disciplines: coachProfile?.disciplines ?? [],
      }}
      activity={(notifications ?? []).map((notification) => ({
        id: notification.id,
        title: notification.title ?? "Activity",
        body: notification.body ?? "",
        opportunityId: notification.opportunity_id ?? "",
        createdAt: notification.created_at ?? "",
      }))}
    />
  );
}

function compareWorkspaceOpportunities(
  a: { startDate: string; endDate: string },
  b: { startDate: string; endDate: string },
) {
  const today = new Date().toISOString().slice(0, 10);
  const aUpcoming = a.endDate >= today;
  const bUpcoming = b.endDate >= today;

  if (aUpcoming !== bUpcoming) {
    return aUpcoming ? -1 : 1;
  }

  return aUpcoming
    ? Date.parse(a.startDate) - Date.parse(b.startDate)
    : Date.parse(b.endDate) - Date.parse(a.endDate);
}

function getDefaultSelectedCampId(camps: Array<{ id: string; endDate: string }>) {
  const today = new Date().toISOString().slice(0, 10);
  return camps.find((camp) => camp.endDate >= today)?.id ?? camps[0]?.id;
}

function groupPreferencesByOpportunity(rows: CampPreferenceRow[]) {
  const groups = new Map<string, CampPreferenceRow[]>();

  for (const row of rows) {
    const dayRows = groups.get(row.opportunity_id) ?? [];
    dayRows.push(row);
    groups.set(row.opportunity_id, dayRows);
  }

  return groups;
}

function formatWorkspaceDateLabel({
  type,
  startDate,
  endDate,
  sessionStart,
  sessionEnd,
}: {
  type: "camp" | "huck_jam";
  startDate: string;
  endDate: string;
  sessionStart: string | null;
  sessionEnd: string | null;
}) {
  const dateLabel = formatOpportunityDate(type, startDate, endDate);
  const sessionRange =
    type === "huck_jam" ? formatSessionTimeRange(sessionStart, sessionEnd) : "";

  return sessionRange ? `${dateLabel}, ${sessionRange}` : dateLabel;
}
