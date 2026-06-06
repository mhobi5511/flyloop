import { createSupabaseAdminClient } from "@/lib/supabase/admin";

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
        user_id: string;
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
      }>
    | null;
};

type EventRow = {
  id: string;
  event_type: "booked" | "removed" | "rotation_changed";
  user_id: string;
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
};

type InterestRow = {
  athlete_id: string;
  tunnel_time_status: "owns_tunnel_time" | "needs_tunnel_time" | null;
  tunnel_account_email: string | null;
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

  const { data: latestEvent } = await supabase
    .from("opportunity_slot_booking_events")
    .select("created_at")
    .eq("opportunity_id", link.opportunity_id)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  return latestEvent?.created_at ?? null;
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
    { data: latestEvent },
  ] = await Promise.all([
    supabase
      .from("opportunities")
      .select("id,title,type,start_date,end_date,total_capacity,created_by,profiles!opportunities_created_by_fkey(full_name,phone,whatsapp_number),tunnel_profiles(name,city,country)")
      .eq("id", link.opportunity_id)
      .eq("type", "camp")
      .maybeSingle(),
    supabase
      .from("opportunity_time_slots")
      .select("id,slot_date,start_time,duration_minutes,opportunity_slot_bookings(id,user_id,minutes,rotation_minutes,profiles!opportunity_slot_bookings_user_id_fkey(full_name,phone,whatsapp_number))")
      .eq("opportunity_id", link.opportunity_id)
      .eq("is_published", true)
      .order("slot_date", { ascending: true })
      .order("start_time", { ascending: true }),
    supabase
      .from("opportunity_slot_booking_events")
      .select("id,event_type,user_id,slot_date,start_time,minutes,previous_rotation_minutes,new_rotation_minutes,created_at,profiles!opportunity_slot_booking_events_user_id_fkey(full_name)")
      .eq("opportunity_id", link.opportunity_id)
      .order("created_at", { ascending: true }),
    supabase
      .from("opportunity_interests")
      .select("athlete_id,tunnel_time_status,tunnel_account_email")
      .eq("opportunity_id", link.opportunity_id)
      .eq("status", "accepted")
      .neq("interest_type", "timetable_reminder"),
    supabase
      .from("opportunity_slot_booking_events")
      .select("created_at")
      .eq("opportunity_id", link.opportunity_id)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle(),
  ]);

  if (!opportunity) {
    return null;
  }

  const userEmails = await getUserEmails([
    opportunity.created_by,
    ...collectParticipantIds((slots ?? []) as SlotRow[]),
  ]);
  const normalizedSlots = normalizeSlots((slots ?? []) as SlotRow[], userEmails);
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
    latestEventAt: latestEvent?.created_at ?? null,
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
    events: normalizeEvents((events ?? []) as EventRow[]),
  } satisfies TunnelDashboardData;
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

        return {
          id: booking.id,
          userId: booking.user_id,
          participantName: profile?.full_name ?? "Participant",
          participantEmail: participantEmails.get(booking.user_id) ?? "",
          participantPhone: profile?.whatsapp_number ?? profile?.phone ?? "",
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
    rows.map((row) => [
      row.athlete_id,
      {
        tunnelTimeStatus: row.tunnel_time_status,
        tunnelAccountEmail: row.tunnel_account_email ?? "",
      },
    ]),
  );
}

function normalizeEvents(rows: EventRow[]) {
  return rows.map((event): TunnelDashboardEvent => {
    const profile = Array.isArray(event.profiles) ? event.profiles[0] : event.profiles;

    return {
      id: event.id,
      eventType: event.event_type,
      participantId: event.user_id,
      participantName: profile?.full_name ?? "Participant",
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
        (slot.opportunity_slot_bookings ?? []).map((booking) => booking.user_id),
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

  await Promise.all(
    [...new Set(userIds)].map(async (userId) => {
      const { data } = await supabase.auth.admin.getUserById(userId);

      if (data.user?.email) {
        emails.set(userId, data.user.email);
      }
    }),
  );

  return emails;
}

function firstRelation<T>(value: T | T[] | null | undefined) {
  return Array.isArray(value) ? value[0] : value;
}
