import { createSupabaseAdminClient } from "@/lib/supabase/admin-client";

const tunnelDashboardOrigin =
  process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/$/, "") ?? "https://flyloop.one";

export type TunnelDashboardSlotBooking = {
  id: string;
  userId: string;
  participantName: string;
  participantEmail: string;
  participantPhone: string;
  minutes: number;
  rotationMinutes: number | null;
};

export type TunnelDashboardSlot = {
  id: string;
  slotDate: string;
  startTime: string;
  durationMinutes: number;
  bookings: TunnelDashboardSlotBooking[];
};

export type TunnelDashboardParticipant = {
  id: string;
  name: string;
  email: string;
  phone: string;
  tunnelTimeStatus: "owns_tunnel_time" | "needs_tunnel_time" | null;
  tunnelAccountEmail: string;
  totalBookedMinutes: number;
  slots: {
    id: string;
    slotDate: string;
    startTime: string;
    minutes: number;
    rotationMinutes: number | null;
  }[];
};

export type TunnelDashboardEvent = {
  id: string;
  eventType: "booked" | "removed" | "rotation_changed";
  participantId: string;
  participantName: string;
  slotDate: string;
  startTime: string;
  minutes: number;
  previousRotationMinutes: number | null;
  newRotationMinutes: number | null;
  createdAt: string;
};

export type TunnelDashboardData = {
  secret: string;
  loadedAt: string;
  latestEventAt: string | null;
  opportunity: {
    id: string;
    title: string;
    startDate: string;
    endDate: string;
    totalCapacity: number;
  };
  coach: {
    name: string;
    email: string;
    phone: string;
  };
  tunnel: {
    name: string;
    city: string;
    country: string;
  };
  stats: {
    totalParticipants: number;
    totalBookedMinutes: number;
  };
  slots: TunnelDashboardSlot[];
  participants: TunnelDashboardParticipant[];
  events: TunnelDashboardEvent[];
};

type DashboardLinkRow = {
  opportunity_id: string;
  secret: string;
};

type OpportunityRow = {
  id: string;
  title: string;
  type: "camp" | "huck_jam";
  start_date: string;
  end_date: string;
  total_capacity: number;
  created_by: string;
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
  tunnel_profiles:
    | { name: string | null; city: string | null; country: string | null }
    | Array<{ name: string | null; city: string | null; country: string | null }>
    | null;
};

type SlotRow = {
  id: string;
  slot_date: string;
  start_time: string;
  duration_minutes: number;
  opportunity_slot_bookings:
    | Array<{
        id: string;
        user_id: string | null;
        participant_profile_id: string | null;
        dummy_participant_id: string | null;
        minutes: number;
        rotation_minutes: number | string | null;
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
};

type EventRow = {
  id: string;
  event_type: "booked" | "removed" | "rotation_changed";
  user_id: string | null;
  dummy_participant_id: string | null;
  slot_date: string;
  start_time: string;
  minutes: number;
  previous_rotation_minutes: number | string | null;
  new_rotation_minutes: number | string | null;
  created_at: string;
  profiles:
    | { full_name: string | null }
    | Array<{ full_name: string | null }>
    | null;
  opportunity_dummy_participants:
    | { id: string; display_name: string | null }
    | Array<{ id: string; display_name: string | null }>
    | null;
};

type InterestRow = {
  athlete_id: string | null;
  participant_profile_id: string | null;
  tunnel_time_status: "owns_tunnel_time" | "needs_tunnel_time" | null;
  tunnel_account_email: string | null;
  updated_at: string;
};

export async function getTunnelDashboardData(secret: string) {
  const supabase = createSupabaseAdminClient();

  if (!supabase) {
    return null;
  }

  const cleanSecret = secret.trim();

  if (!/^[a-f0-9]{48}$/i.test(cleanSecret)) {
    return null;
  }

  const { data: link } = await supabase
    .from("opportunity_tunnel_dashboard_links")
    .select("opportunity_id,secret")
    .eq("secret", cleanSecret)
    .maybeSingle();

  if (!link) {
    return null;
  }

  return loadDashboardForLink(link as DashboardLinkRow);
}

export async function getTunnelDashboardLatestEventAt(secret: string) {
  const supabase = createSupabaseAdminClient();

  if (!supabase || !/^[a-f0-9]{48}$/i.test(secret)) {
    return undefined;
  }

  const { data: link } = await supabase
    .from("opportunity_tunnel_dashboard_links")
    .select("opportunity_id")
    .eq("secret", secret)
    .maybeSingle();

  if (!link) {
    return undefined;
  }

  const [{ data: latestEvent }, { data: latestInterest }] = await Promise.all([
    supabase
      .from("opportunity_slot_booking_events")
      .select("created_at")
      .eq("opportunity_id", link.opportunity_id)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle(),
    supabase
      .from("opportunity_interests")
      .select("updated_at")
      .eq("opportunity_id", link.opportunity_id)
      .eq("status", "accepted")
      .neq("interest_type", "timetable_reminder")
      .order("updated_at", { ascending: false })
      .limit(1)
      .maybeSingle(),
  ]);

  return latestIso(latestEvent?.created_at, latestInterest?.updated_at);
}

export function getTunnelDashboardUrl(secret: string) {
  return `${tunnelDashboardOrigin}/tunnel-dashboard/${secret}`;
}

async function loadDashboardForLink(link: DashboardLinkRow) {
  const supabase = createSupabaseAdminClient();

  if (!supabase) {
    return null;
  }

  const [
    { data: opportunity },
    { data: slots },
    { data: events },
    { data: acceptedInterests },
  ] = await Promise.all([
    supabase
      .from("opportunities")
      .select("id,title,type,start_date,end_date,total_capacity,created_by,profiles!opportunities_created_by_fkey(full_name,phone,whatsapp_number),tunnel_profiles(name,city,country)")
      .eq("id", link.opportunity_id)
      .eq("type", "camp")
      .maybeSingle(),
    supabase
      .from("opportunity_time_slots")
      .select("id,slot_date,start_time,duration_minutes,opportunity_slot_bookings(id,user_id,participant_profile_id,dummy_participant_id,minutes,rotation_minutes,profiles!opportunity_slot_bookings_user_id_fkey(full_name,phone,whatsapp_number),participant_profiles!opportunity_slot_bookings_participant_profile_id_fkey(id,user_id,full_name,phone),opportunity_dummy_participants!opportunity_slot_bookings_dummy_participant_id_fkey(id,display_name,phone))")
      .eq("opportunity_id", link.opportunity_id)
      .eq("is_published", true)
      .order("slot_date", { ascending: true })
      .order("start_time", { ascending: true }),
    supabase
      .from("opportunity_slot_booking_events")
      .select("id,event_type,user_id,dummy_participant_id,slot_date,start_time,minutes,previous_rotation_minutes,new_rotation_minutes,created_at,profiles!opportunity_slot_booking_events_user_id_fkey(full_name),opportunity_dummy_participants!opportunity_slot_booking_events_dummy_participant_id_fkey(id,display_name)")
      .eq("opportunity_id", link.opportunity_id)
      .order("created_at", { ascending: false })
      .limit(100),
    supabase
      .from("opportunity_interests")
      .select("athlete_id,participant_profile_id,tunnel_time_status,tunnel_account_email,updated_at")
      .eq("opportunity_id", link.opportunity_id)
      .eq("status", "accepted")
      .neq("interest_type", "timetable_reminder"),
  ]);

  if (!opportunity) {
    return null;
  }

  const userEmails = await getUserEmails([
    opportunity.created_by,
    ...collectParticipantIds((slots ?? []) as SlotRow[]),
  ]);
  const normalizedSlots = normalizeSlots((slots ?? []) as SlotRow[], userEmails);
  const eventRows = ((events ?? []) as EventRow[]).slice().reverse();
  const tunnelTimeByParticipant = getTunnelTimeByParticipant(
    (acceptedInterests ?? []) as InterestRow[],
  );
  const participants = getParticipants(normalizedSlots, tunnelTimeByParticipant);
  const totalBookedMinutes = participants.reduce(
    (total, participant) => total + participant.totalBookedMinutes,
    0,
  );
  const opportunityRow = opportunity as OpportunityRow;
  const coach = firstRelation(opportunityRow.profiles);
  const tunnel = firstRelation(opportunityRow.tunnel_profiles);

  return {
    secret: link.secret,
    loadedAt: new Date().toISOString(),
    latestEventAt: latestIso(
      eventRows.at(-1)?.created_at,
      latestAcceptedInterestUpdate((acceptedInterests ?? []) as InterestRow[]),
    ),
    opportunity: {
      id: opportunity.id,
      title: opportunity.title,
      startDate: opportunity.start_date,
      endDate: opportunity.end_date,
      totalCapacity: opportunity.total_capacity,
    },
    coach: {
      name: coach?.full_name ?? "Coach",
      email: userEmails.get(opportunity.created_by) ?? "",
      phone: coach?.whatsapp_number ?? coach?.phone ?? "",
    },
    tunnel: {
      name: tunnel?.name ?? "Tunnel",
      city: tunnel?.city ?? "",
      country: tunnel?.country ?? "",
    },
    stats: {
      totalParticipants:
        ((acceptedInterests ?? []) as InterestRow[]).length || participants.length,
      totalBookedMinutes,
    },
    slots: normalizedSlots,
    participants,
    events: normalizeEvents(eventRows),
  } satisfies TunnelDashboardData;
}

function latestAcceptedInterestUpdate(rows: InterestRow[]) {
  return rows.reduce<string | null>((latest, row) => {
    if (!latest) {
      return row.updated_at;
    }

    return new Date(row.updated_at).getTime() > new Date(latest).getTime()
      ? row.updated_at
      : latest;
  }, null);
}

function latestIso(...values: Array<string | null | undefined>) {
  const validValues = values.filter((value): value is string => Boolean(value));

  if (validValues.length === 0) {
    return null;
  }

  return validValues.sort(
    (a, b) => new Date(b).getTime() - new Date(a).getTime(),
  )[0];
}

function normalizeSlots(rows: SlotRow[], participantEmails: Map<string, string>) {
  return rows.map((slot): TunnelDashboardSlot => {
    const bookings = slot.opportunity_slot_bookings ?? [];

    return {
      id: slot.id,
      slotDate: slot.slot_date,
      startTime: slot.start_time,
      durationMinutes: slot.duration_minutes,
      bookings: bookings.map((booking) => {
        const profile = Array.isArray(booking.profiles)
          ? booking.profiles[0]
          : booking.profiles;
        const participantProfile = Array.isArray(booking.participant_profiles)
          ? booking.participant_profiles[0]
          : booking.participant_profiles;
        const dummy = Array.isArray(booking.opportunity_dummy_participants)
          ? booking.opportunity_dummy_participants[0]
          : booking.opportunity_dummy_participants;
        const participantId =
          booking.dummy_participant_id ??
          booking.participant_profile_id ??
          participantProfile?.id ??
          booking.user_id ??
          "";

        return {
          id: booking.id,
          userId: participantId,
          participantName:
            dummy?.display_name ??
            participantProfile?.full_name ?? profile?.full_name ?? "Participant",
          participantEmail: booking.user_id ? participantEmails.get(booking.user_id) ?? "" : "",
          participantPhone:
            dummy?.phone ??
            participantProfile?.phone ?? profile?.whatsapp_number ?? profile?.phone ?? "",
          minutes: booking.minutes,
          rotationMinutes:
            booking.rotation_minutes === null
              ? null
              : Number(booking.rotation_minutes),
        };
      }),
    };
  });
}

function getParticipants(
  slots: TunnelDashboardSlot[],
  tunnelTimeByParticipant: Map<
    string,
    {
      tunnelTimeStatus: TunnelDashboardParticipant["tunnelTimeStatus"];
      tunnelAccountEmail: string;
    }
  >,
) {
  const participantMap = new Map<string, TunnelDashboardParticipant>();

  for (const slot of slots) {
    for (const booking of slot.bookings) {
      const participant =
        participantMap.get(booking.userId) ??
        ({
          id: booking.userId,
          name: booking.participantName,
          email: booking.participantEmail,
          phone: booking.participantPhone,
          tunnelTimeStatus:
            tunnelTimeByParticipant.get(booking.userId)?.tunnelTimeStatus ?? null,
          tunnelAccountEmail:
            tunnelTimeByParticipant.get(booking.userId)?.tunnelAccountEmail ?? "",
          totalBookedMinutes: 0,
          slots: [],
        } satisfies TunnelDashboardParticipant);

      participant.totalBookedMinutes += booking.minutes;
      participant.slots.push({
        id: booking.id,
        slotDate: slot.slotDate,
        startTime: slot.startTime,
        minutes: booking.minutes,
        rotationMinutes: booking.rotationMinutes,
      });
      participantMap.set(booking.userId, participant);
    }
  }

  return [...participantMap.values()]
    .map((participant) => ({
      ...participant,
      slots: participant.slots.sort((a, b) =>
        `${a.slotDate} ${a.startTime}`.localeCompare(`${b.slotDate} ${b.startTime}`),
      ),
    }))
    .sort((a, b) => a.name.localeCompare(b.name));
}

function getTunnelTimeByParticipant(rows: InterestRow[]) {
  return new Map(
    rows
      .map((row) => {
        const participantId = row.participant_profile_id ?? row.athlete_id;

        if (!participantId) {
          return null;
        }

        return [
          participantId,
          {
            tunnelTimeStatus: row.tunnel_time_status,
            tunnelAccountEmail: row.tunnel_account_email ?? "",
          },
        ] as const;
      })
      .filter((entry): entry is readonly [
        string,
        {
          tunnelTimeStatus: TunnelDashboardParticipant["tunnelTimeStatus"];
          tunnelAccountEmail: string;
        },
      ] => Boolean(entry)),
  );
}

function normalizeEvents(rows: EventRow[]) {
  return rows.map((event): TunnelDashboardEvent => {
    const profile = Array.isArray(event.profiles) ? event.profiles[0] : event.profiles;
    const dummy = Array.isArray(event.opportunity_dummy_participants)
      ? event.opportunity_dummy_participants[0]
      : event.opportunity_dummy_participants;

    return {
      id: event.id,
      eventType: event.event_type,
      participantId: event.dummy_participant_id ?? event.user_id ?? event.id,
      participantName: dummy?.display_name ?? profile?.full_name ?? "Participant",
      slotDate: event.slot_date,
      startTime: event.start_time,
      minutes: event.minutes,
      previousRotationMinutes:
        event.previous_rotation_minutes === null
          ? null
          : Number(event.previous_rotation_minutes),
      newRotationMinutes:
        event.new_rotation_minutes === null
          ? null
          : Number(event.new_rotation_minutes),
      createdAt: event.created_at,
    };
  });
}

function collectParticipantIds(rows: SlotRow[]) {
  return [
    ...new Set(
      rows.flatMap((slot) =>
        (slot.opportunity_slot_bookings ?? [])
          .map((booking) => booking.user_id)
          .filter((userId): userId is string => Boolean(userId)),
      ),
    ),
  ];
}

async function getUserEmails(userIds: string[]) {
  const supabase = createSupabaseAdminClient();
  const emails = new Map<string, string>();

  if (!supabase) {
    return emails;
  }

  const uniqueUserIds = [...new Set(userIds.filter(Boolean))];
  if (uniqueUserIds.length === 0) {
    return emails;
  }

  const { data, error } = await supabase.rpc("get_auth_user_emails", {
    target_user_ids: uniqueUserIds,
  });

  if (error) {
    console.error("Tunnel dashboard email batch lookup failed", error);
    return emails;
  }

  for (const user of (data ?? []) as Array<{ id: string; email: string | null }>) {
    if (user.email) {
      emails.set(user.id, user.email);
    }
  }

  return emails;
}

function firstRelation<T>(value: T | T[] | null | undefined) {
  return Array.isArray(value) ? value[0] : value;
}
