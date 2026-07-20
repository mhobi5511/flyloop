import { notFound } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import type { TimetableSlot } from "@/lib/timetable";

export type TimetableExportOpportunity = {
  id: string;
  type: string;
  title: string;
  price: number | string;
  currency: string;
  priceAppliesToMinutes: string | null;
  tunnelName: string;
};

type ExportOpportunityRow = {
  id: string;
  type: string;
  title: string;
  price: number | string;
  currency: string;
  min_minutes_or_hours: string | null;
  tunnel_profiles:
    | { name: string | null }
    | Array<{ name: string | null }>
    | null;
};

type ExportSlotRow = {
  id: string;
  slot_date: string;
  start_time: string;
  duration_minutes: number;
  capacity: number;
  opportunity_slot_bookings:
    | Array<{
        id: string;
        minutes: number;
        rotation_minutes: number | string | null;
        user_id: string | null;
        participant_profile_id: string | null;
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
      }>
    | null;
};

export async function getOrganizerTimetableExport(opportunityId: string) {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    notFound();
  }

  const { data: opportunity } = await supabase
    .from("opportunities")
    .select("id,type,title,price,currency,min_minutes_or_hours,tunnel_profiles(name)")
    .eq("id", opportunityId)
    .eq("created_by", user.id)
    .maybeSingle();

  if (!opportunity) {
    notFound();
  }

  const { data: slotRows } = await supabase
    .from("opportunity_time_slots")
    .select("id,slot_date,start_time,duration_minutes,capacity,opportunity_slot_bookings(id,minutes,rotation_minutes,user_id,participant_profile_id,profiles!opportunity_slot_bookings_user_id_fkey(full_name,phone,whatsapp_number),participant_profiles!opportunity_slot_bookings_participant_profile_id_fkey(id,user_id,full_name,phone))")
    .eq("opportunity_id", opportunityId)
    .order("slot_date", { ascending: true })
    .order("start_time", { ascending: true });

  const opportunityRow = opportunity as ExportOpportunityRow;
  if (opportunityRow.type === "huck_jam") {
    notFound();
  }
  const tunnel = Array.isArray(opportunityRow.tunnel_profiles)
    ? opportunityRow.tunnel_profiles[0]
    : opportunityRow.tunnel_profiles;

  const currentOpportunity: TimetableExportOpportunity = {
    id: opportunityRow.id,
    type: opportunityRow.type,
    title: opportunityRow.title,
    price: opportunityRow.price,
    currency: opportunityRow.currency,
    priceAppliesToMinutes: opportunityRow.min_minutes_or_hours,
    tunnelName: tunnel?.name ?? "Tunnel to be confirmed",
  };

  const slots = ((slotRows ?? []) as ExportSlotRow[]).map(
    (slot): TimetableSlot => ({
      id: slot.id,
      slotDate: slot.slot_date,
      startTime: slot.start_time,
      durationMinutes: slot.duration_minutes,
      capacity: slot.capacity,
      bookings: (slot.opportunity_slot_bookings ?? []).map((booking) => {
        const profile = Array.isArray(booking.profiles)
          ? booking.profiles[0]
          : booking.profiles;
        const participantProfile = Array.isArray(booking.participant_profiles)
          ? booking.participant_profiles[0]
          : booking.participant_profiles;

        return {
          id: booking.id,
          minutes: booking.minutes,
          rotationMinutes:
            booking.rotation_minutes === null
              ? null
              : Number(booking.rotation_minutes),
          userId: booking.participant_profile_id ?? participantProfile?.id ?? booking.user_id ?? "",
          athleteName: participantProfile?.full_name ?? profile?.full_name ?? "",
          athletePhone:
            participantProfile?.phone ?? profile?.whatsapp_number ?? profile?.phone ?? "",
        };
      }),
    }),
  );

  return { opportunity: currentOpportunity, slots };
}

export function filenameFor(value: string) {
  return (
    value
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/(^-|-$)/g, "")
      .slice(0, 80) || "opportunity"
  );
}
