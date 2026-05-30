import type { Opportunity } from "@/lib/types";

export type HomeFeedRow = {
  id: string;
  type: "camp" | "huck_jam";
  title: string;
  coach_id: string | null;
  tunnel_id: string;
  start_date: string;
  end_date: string;
  registration_deadline: string | null;
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
  created_at?: string;
  updated_at?: string;
  is_last_minute?: boolean;
  feed_priority?: number;
  tunnel_name?: string | null;
  tunnel_country?: string | null;
  tunnel_city?: string | null;
  coach_name?: string | null;
};

export function mapOpportunity(row: HomeFeedRow): Opportunity {
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
    languages: row.languages ?? [],
    disciplines: row.disciplines ?? [],
    skillLevel: row.skill_level ?? null,
    status: row.status,
    contactMethod:
      row.contact_method === "instagram" || row.contact_method === "email"
        ? row.contact_method
        : "whatsapp",
    createdBy: row.created_by,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}
