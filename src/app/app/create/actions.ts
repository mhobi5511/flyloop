"use server";

import { revalidatePath } from "next/cache";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { sendNewTunnelNotification } from "@/lib/email/tunnel-notifications";
import { regions } from "@/lib/location";
import type { OpportunityType } from "@/lib/types";

const supportedCurrencies = ["EUR", "CHF", "USD", "PLN", "GBP"] as const;
type Currency = (typeof supportedCurrencies)[number];

const uuidPattern =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

type PublishOpportunityInput = {
  type: OpportunityType;
  title: string;
  tunnelId: string;
  startDate: string;
  endDate: string;
  registrationDeadline: string;
  price: number;
  currency: string;
  totalCapacity: number;
  minMinutesOrHours: string;
  description: string;
  languages: string;
  disciplines: string;
  skillLevel: string;
};

type AddTunnelInput = {
  name: string;
  city: string;
  country: string;
  region: string;
  address: string;
  website: string;
  description: string;
};

type ActionResult<T = unknown> =
  | { ok: true; data: T }
  | { ok: false; message: string };

function cleanText(value: string) {
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function parseCsv(value: string) {
  const items = value
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);

  return items;
}

function isValidDate(value: string) {
  return /^\d{4}-\d{2}-\d{2}$/.test(value) && !Number.isNaN(Date.parse(value));
}

function isSupportedCurrency(value: string): value is Currency {
  return supportedCurrencies.includes(value as Currency);
}

function inferRegion(country: string) {
  const normalized = country.trim().toLowerCase();
  const europe = [
    "austria",
    "belgium",
    "france",
    "germany",
    "italy",
    "netherlands",
    "poland",
    "spain",
    "switzerland",
    "united kingdom",
  ];

  if (europe.includes(normalized)) {
    return "Europe";
  }

  if (["united states", "usa", "canada", "mexico"].includes(normalized)) {
    return "North America";
  }

  return null;
}

function cleanRegion(value: string, country: string) {
  const trimmed = value.trim();

  if (regions.some((region) => region === trimmed)) {
    return trimmed;
  }

  return inferRegion(country);
}

function friendlyPublishError(error: unknown) {
  console.error("Opportunity publish failed", error);
  return "Could not publish opportunity. Please check the required fields and try again.";
}

async function getAuthenticatedOrganizer() {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError || !user) {
    return { supabase, user: null, profile: null };
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("full_name,wants_to_create_opportunities")
    .eq("id", user.id)
    .maybeSingle();

  return { supabase, user, profile };
}

export async function publishOpportunity(
  input: PublishOpportunityInput,
): Promise<ActionResult<{ id: string }>> {
  const { supabase, user, profile } = await getAuthenticatedOrganizer();

  if (!user) {
    return { ok: false, message: "Please log in again before publishing." };
  }

  if (profile?.wants_to_create_opportunities !== true) {
    return {
      ok: false,
      message: "Enable creating opportunities in your profile first.",
    };
  }

  if (input.type !== "camp" && input.type !== "huck_jam") {
    return { ok: false, message: "Please choose an opportunity type." };
  }

  if (!uuidPattern.test(input.tunnelId)) {
    return { ok: false, message: "Please select a tunnel before publishing." };
  }

  if (!isValidDate(input.startDate)) {
    return { ok: false, message: "Please select a start date." };
  }

  if (!isValidDate(input.endDate)) {
    return { ok: false, message: "Please select an end date." };
  }

  if (new Date(input.endDate) < new Date(input.startDate)) {
    return {
      ok: false,
      message: "End date must be the same as or after the start date.",
    };
  }

  if (
    input.registrationDeadline &&
    (!isValidDate(input.registrationDeadline) ||
      new Date(input.registrationDeadline) > new Date(input.startDate))
  ) {
    return {
      ok: false,
      message: "Registration deadline must be on or before the start date.",
    };
  }

  if (!Number.isFinite(input.price) || input.price < 0) {
    return { ok: false, message: "Please enter a valid price." };
  }

  if (!isSupportedCurrency(input.currency)) {
    return { ok: false, message: "Please choose a valid currency." };
  }

  if (!Number.isInteger(input.totalCapacity) || input.totalCapacity < 1) {
    return { ok: false, message: "Please enter a valid capacity." };
  }

  const { data: tunnel, error: tunnelError } = await supabase
    .from("tunnel_profiles")
    .select("id,name")
    .eq("id", input.tunnelId)
    .maybeSingle();

  if (tunnelError) {
    return { ok: false, message: friendlyPublishError(tunnelError) };
  }

  if (!tunnel) {
    return { ok: false, message: "Please select a tunnel before publishing." };
  }

  const title = input.title.trim()
    ? input.title.trim()
    : input.type === "camp"
      ? `Camp with ${profile?.full_name ?? user.email?.split("@")[0] ?? "Flyloop organizer"}`
      : `Huck Jam at ${tunnel.name}`;

  const { data, error } = await supabase
    .from("opportunities")
    .insert({
      type: input.type,
      title,
      coach_id: null,
      tunnel_id: input.tunnelId,
      start_date: input.startDate,
      end_date: input.endDate,
      registration_deadline: input.registrationDeadline || null,
      price: input.price,
      currency: input.currency,
      total_capacity: input.totalCapacity,
      available_spots: input.totalCapacity,
      min_minutes_or_hours: cleanText(input.minMinutesOrHours),
      description: cleanText(input.description),
      languages: parseCsv(input.languages),
      disciplines: parseCsv(input.disciplines),
      skill_level: cleanText(input.skillLevel),
      status: "published",
      contact_method: "whatsapp",
      created_by: user.id,
    })
    .select("id")
    .single();

  if (error) {
    return { ok: false, message: friendlyPublishError(error) };
  }

  revalidatePath("/app");
  revalidatePath("/app/dashboard");

  return { ok: true, data: { id: data.id } };
}

export async function addTunnel(
  input: AddTunnelInput,
): Promise<ActionResult<{ id: string; name: string }>> {
  const { supabase, user, profile } = await getAuthenticatedOrganizer();

  if (!user) {
    return { ok: false, message: "Please log in again before adding a tunnel." };
  }

  if (profile?.wants_to_create_opportunities !== true) {
    return {
      ok: false,
      message: "Enable creating opportunities in your profile before adding a tunnel.",
    };
  }

  const name = input.name.trim();
  const city = input.city.trim();
  const country = input.country.trim();

  if (!name || !city || !country) {
    return { ok: false, message: "Please enter the tunnel name, city and country." };
  }

  const { data, error } = await supabase
    .from("tunnel_profiles")
    .insert({
      name,
      city,
      country,
      address: cleanText(input.address),
      website: cleanText(input.website),
      description: cleanText(input.description),
      verified: false,
      created_by: user.id,
      region: cleanRegion(input.region, country),
    })
    .select("id,name,city,country,address,website,created_at")
    .single();

  if (error) {
    console.error("Tunnel creation failed", error);
    return {
      ok: false,
      message: "Could not add tunnel. Please check the required fields and try again.",
    };
  }

  await sendNewTunnelNotification({
    name: data.name,
    city: data.city,
    country: data.country,
    address: data.address,
    website: data.website,
    addedByName: profile?.full_name ?? "Flyloop user",
    addedByEmail: user.email ?? null,
    timestamp: data.created_at ?? new Date().toISOString(),
  });

  revalidatePath("/app/create");

  return { ok: true, data: { id: data.id, name: data.name } };
}
