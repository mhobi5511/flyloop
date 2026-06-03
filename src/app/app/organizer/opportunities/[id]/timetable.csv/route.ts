import { notFound } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import {
  getTimetableOverviewRows,
  type TimetableSlot,
} from "@/lib/timetable";

type ExportOpportunity = {
  id: string;
  title: string;
  price: number | string;
  currency: string;
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

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    notFound();
  }

  const { data: opportunity } = await supabase
    .from("opportunities")
    .select("id,title,price,currency")
    .eq("id", id)
    .eq("created_by", user.id)
    .maybeSingle();

  if (!opportunity) {
    notFound();
  }

  const { data: slotRows } = await supabase
    .from("opportunity_time_slots")
    .select("id,slot_date,start_time,duration_minutes,capacity,opportunity_slot_bookings(id,minutes,user_id,profiles!opportunity_slot_bookings_user_id_fkey(full_name,phone,whatsapp_number))")
    .eq("opportunity_id", id)
    .order("slot_date", { ascending: true })
    .order("start_time", { ascending: true });

  const currentOpportunity = opportunity as ExportOpportunity;
  const timetableSlots = ((slotRows ?? []) as ExportSlotRow[]).map(
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
  const rows = getTimetableOverviewRows(
    timetableSlots,
    Number(currentOpportunity.price),
  );
  const csv = [
    [
      "Opportunity Name",
      "Date",
      "Start Time",
      "Duration Minutes",
      "Athlete Name",
      "Athlete Email if available",
      "Athlete Phone if available",
      "Status",
      "Estimated Price",
    ],
    ...rows.map((row) => [
      currentOpportunity.title,
      row.slotDate,
      row.startTime.slice(0, 5),
      String(row.durationMinutes),
      row.athleteName,
      row.athleteEmail,
      row.athletePhone,
      row.status,
      row.status === "booked"
        ? `${formatCsvMoney(row.estimatedPrice)} ${currentOpportunity.currency}`
        : "",
    ]),
  ]
    .map((row) => row.map(escapeCsvCell).join(","))
    .join("\n");

  return new Response(csv, {
    headers: {
      "Content-Disposition": `attachment; filename="${filenameFor(currentOpportunity.title)}-timetable.csv"`,
      "Content-Type": "text/csv; charset=utf-8",
    },
  });
}

function escapeCsvCell(value: string) {
  return `"${value.replaceAll('"', '""')}"`;
}

function filenameFor(value: string) {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "")
    .slice(0, 80) || "opportunity";
}

function formatCsvMoney(value: number) {
  return new Intl.NumberFormat("en", {
    maximumFractionDigits: 2,
  }).format(value);
}
