import { getFeedSections } from "./opportunities";
import { isSupabaseConfigured, supabase } from "./supabase";
import type { Opportunity } from "./types";

type HomeFeedRow = {
  id: string;
  type: "camp" | "huck_jam";
  title: string;
  coach_id: string | null;
  tunnel_id: string;
  start_date: string;
  end_date: string;
  registration_deadline: string;
  price: number | string;
  currency: string;
  total_capacity: number;
  available_spots: number;
  min_minutes_or_hours: string | null;
  description: string | null;
  languages: string[];
  disciplines: string[];
  skill_level: string | null;
  status: "draft" | "published" | "full" | "cancelled";
  contact_method: "whatsapp" | "instagram" | "email" | string;
  created_by: string;
  is_last_minute: boolean;
  feed_priority: number;
  tunnel_name: string | null;
  tunnel_country: string | null;
  tunnel_city: string | null;
  coach_name: string | null;
};

function mapHomeFeedRow(row: HomeFeedRow): Opportunity {
  return {
    id: row.id,
    type: row.type,
    title: row.title,
    coachId: row.coach_id ?? undefined,
    coachName: row.coach_name ?? undefined,
    tunnelId: row.tunnel_id,
    tunnelName: row.tunnel_name ?? undefined,
    tunnelCity: row.tunnel_city ?? undefined,
    tunnelCountry: row.tunnel_country ?? undefined,
    isLastMinute: row.is_last_minute,
    startDate: row.start_date,
    endDate: row.end_date,
    registrationDeadline: row.registration_deadline,
    price:
      typeof row.price === "string" ? Number.parseFloat(row.price) : row.price,
    currency: row.currency,
    totalCapacity: row.total_capacity,
    availableSpots: row.available_spots,
    minMinutesOrHours: row.min_minutes_or_hours ?? undefined,
    description: row.description ?? "",
    languages: row.languages,
    disciplines: row.disciplines,
    skillLevel: row.skill_level ?? "All levels",
    status: row.status,
    contactMethod:
      row.contact_method === "instagram" || row.contact_method === "email"
        ? row.contact_method
        : "whatsapp",
    createdBy: row.created_by,
  };
}

export async function getHomeFeedSections() {
  if (!isSupabaseConfigured || !supabase) {
    return getFeedSections();
  }

  const { data, error } = await supabase.rpc("get_home_feed");

  if (error || !data) {
    console.warn("Supabase home feed fallback:", error?.message);
    return getFeedSections();
  }

  const rows = data as HomeFeedRow[];
  const opportunities = rows.map(mapHomeFeedRow);

  return {
    lastMinute: opportunities.filter((_, index) => rows[index].is_last_minute),
    nearUser: opportunities.filter((_, index) => rows[index].feed_priority === 2),
    followedCoaches: opportunities.filter(
      (_, index) => rows[index].feed_priority === 3,
    ),
    followedTunnels: opportunities.filter(
      (_, index) => rows[index].feed_priority === 4,
    ),
  };
}
