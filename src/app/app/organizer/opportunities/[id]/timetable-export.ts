import { notFound } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import type { TimetableSlot } from "@/lib/timetable";

export type TimetableExportOpportunity = {
  id: string;
  title: string;
  price: number | string;
  currency: string;
  tunnelName: string;
};

type ExportOpportunityRow = {
  id: string;
  title: string;
  price: number | string;
  currency: string;
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
        user_id: string;
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
    .select("id,title,price,currency,tunnel_profiles(name)")
    .eq("id", opportunityId)
    .eq("created_by", user.id)
    .maybeSingle();

  if (!opportunity) {
    notFound();
  }

  const { data: slotRows } = await supabase
    .from("opportunity_time_slots")
    .select("id,slot_date,start_time,duration_minutes,capacity,opportunity_slot_bookings(id,minutes,user_id,profiles!opportunity_slot_bookings_user_id_fkey(full_name,phone,whatsapp_number))")
    .eq("opportunity_id", opportunityId)
    .order("slot_date", { ascending: true })
    .order("start_time", { ascending: true });

  const opportunityRow = opportunity as ExportOpportunityRow;
  const tunnel = Array.isArray(opportunityRow.tunnel_profiles)
    ? opportunityRow.tunnel_profiles[0]
    : opportunityRow.tunnel_profiles;

  const currentOpportunity: TimetableExportOpportunity = {
    id: opportunityRow.id,
    title: opportunityRow.title,
    price: opportunityRow.price,
    currency: opportunityRow.currency,
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

        return {
          id: booking.id,
          minutes: booking.minutes,
          userId: booking.user_id,
          athleteName: profile?.full_name ?? "",
          athletePhone: profile?.whatsapp_number ?? profile?.phone ?? "",
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
