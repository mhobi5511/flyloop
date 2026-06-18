"use server";

import { revalidatePath } from "next/cache";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { sendNewTunnelNotification } from "@/lib/email/tunnel-notifications";
import { sendPendingPushNotificationsForOpportunity } from "@/lib/push";
import { supportsCampTunnelTimeModeColumn } from "@/lib/camp-tunnel-time-mode";
import { regions } from "@/lib/location";
import type {
  BookingMode,
  CampTunnelTimeMode,
  OpportunityType,
} from "@/lib/types";

const supportedCurrencies = ["EUR", "CHF", "USD", "PLN", "GBP"] as const;
type Currency = (typeof supportedCurrencies)[number];

const uuidPattern =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

type PublishOpportunityInput = {
  type: OpportunityType;
  bookingMode: BookingMode;
  title: string;
  tunnelId: string;
  startDate: string;
  endDate: string;
  registrationDeadline: string;
  tunnelTimeMode: CampTunnelTimeMode;
  sessionStart: string;
  sessionEnd: string;
  price: number;
  currency: string;
  totalCapacity: number;
  minMinutesOrHours: string;
  description: string;
  languages: string;
  disciplines: string;
  skillLevel: string;
};

export type OpportunityFormInput = PublishOpportunityInput;

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
type SupabaseServerClient = Awaited<ReturnType<typeof createSupabaseServerClient>>;

function cleanText(value: string) {
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function normalizeTextArray(value: unknown) {
  return Array.isArray(value)
    ? value
        .filter((item): item is string => typeof item === "string")
        .map((item) => item.trim())
        .filter(Boolean)
    : [];
}

async function getInheritedCoachProfile(
  supabase: SupabaseServerClient,
  userId: string,
) {
  const { data } = await supabase
    .from("coach_profiles")
    .select("languages,disciplines")
    .eq("user_id", userId)
    .maybeSingle();

  return {
    languages: normalizeTextArray(data?.languages),
    disciplines: normalizeTextArray(data?.disciplines),
  };
}

function isValidDate(value: string) {
  return /^\d{4}-\d{2}-\d{2}$/.test(value) && !Number.isNaN(Date.parse(value));
}

function isValidTime(value: string) {
  return /^\d{2}:\d{2}$/.test(value);
}

function resolveRegistrationDeadline(
  registrationDeadline: string,
  startDate: string,
) {
  const trimmedDeadline = registrationDeadline.trim();
  return trimmedDeadline.length > 0 ? trimmedDeadline : startDate;
}

function isValidPriceAppliesToMinutes(value: string) {
  const trimmed = value.trim();

  if (!/^\d+(\.\d+)?$/.test(trimmed)) {
    return false;
  }

  const minutes = Number(trimmed);
  return Number.isFinite(minutes) && minutes > 0;
}

function priceAppliesToErrorMessage() {
  return "Please enter a valid number of minutes, for example 60.";
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
    .select("full_name,is_organizer,wants_to_create_opportunities,is_admin")
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

  if (
    profile?.is_organizer !== true &&
    profile?.wants_to_create_opportunities !== true
  ) {
    return {
      ok: false,
      message: "Enable organizer mode in your profile first.",
    };
  }

  if (input.type !== "camp" && input.type !== "huck_jam") {
    return { ok: false, message: "Please choose an opportunity type." };
  }

  if (
    input.type === "camp" &&
    input.tunnelTimeMode !== "athletes_may_use_own_tunnel_time" &&
    input.tunnelTimeMode !== "tunnel_time_must_be_purchased_through_coach"
  ) {
    return { ok: false, message: "Please choose a tunnel time mode." };
  }

  const bookingMode: BookingMode = "approval_required";

  if (!uuidPattern.test(input.tunnelId)) {
    return { ok: false, message: "Please select a tunnel before publishing." };
  }

  if (!isValidDate(input.startDate)) {
    return {
      ok: false,
      message:
        input.type === "huck_jam"
          ? "Please select an event date."
          : "Please select a start date.",
    };
  }

  if (input.type === "camp" && !isValidDate(input.endDate)) {
    return { ok: false, message: "Please select an end date." };
  }

  if (
    input.type === "camp" &&
    new Date(input.endDate) < new Date(input.startDate)
  ) {
    return {
      ok: false,
      message: "End date must be the same as or after the start date.",
    };
  }

  const registrationDeadline = resolveRegistrationDeadline(
    input.registrationDeadline,
    input.startDate,
  );

  if (
    !isValidDate(registrationDeadline) ||
    new Date(registrationDeadline) >
      new Date(input.startDate)
  ) {
    return {
      ok: false,
      message:
        input.type === "huck_jam"
          ? "Registration deadline must be on or before the event date."
          : "Registration deadline must be on or before the start date.",
    };
  }

  if (input.type === "huck_jam") {
    if (!isValidTime(input.sessionStart) || !isValidTime(input.sessionEnd)) {
      return { ok: false, message: "Please enter valid session times." };
    }

    if (input.sessionEnd <= input.sessionStart) {
      return { ok: false, message: "Session end must be after session start." };
    }
  }

  if (!Number.isFinite(input.price) || input.price < 0) {
    return { ok: false, message: "Please enter a valid price." };
  }

  if (
    input.type === "camp" &&
    !isValidPriceAppliesToMinutes(input.minMinutesOrHours)
  ) {
    return { ok: false, message: priceAppliesToErrorMessage() };
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
    : `${input.type === "camp" ? "Camp" : "Huck Jam"} with ${
        profile?.full_name ?? user.email?.split("@")[0] ?? "Flyloop organizer"
      }`;
  const inheritedCoachProfile = await getInheritedCoachProfile(supabase, user.id);
  const supportsTunnelTimeMode = await supportsCampTunnelTimeModeColumn(supabase);
  const tunnelTimeModeValue =
    input.type === "camp"
      ? input.tunnelTimeMode
      : "athletes_may_use_own_tunnel_time";

  const insertPayload: Record<string, unknown> = {
    type: input.type,
    booking_mode: bookingMode,
    title,
    coach_id: null,
    tunnel_id: input.tunnelId,
    start_date: input.startDate,
    end_date: input.type === "huck_jam" ? input.startDate : input.endDate,
    registration_deadline: registrationDeadline,
    session_start: input.type === "huck_jam" ? input.sessionStart : null,
    session_end: input.type === "huck_jam" ? input.sessionEnd : null,
    price: input.price,
    currency: input.currency,
    total_capacity: input.totalCapacity,
    available_spots: input.totalCapacity,
    min_minutes_or_hours:
      input.type === "huck_jam" ? null : input.minMinutesOrHours.trim(),
    description: cleanText(input.description),
    languages: inheritedCoachProfile.languages,
    disciplines: inheritedCoachProfile.disciplines,
    skill_level: cleanText(input.skillLevel),
    status: "published",
    contact_method: "whatsapp",
    created_by: user.id,
  };

  if (supportsTunnelTimeMode) {
    insertPayload.tunnel_time_mode = tunnelTimeModeValue;
  }

  const { data, error } = await supabase
    .from("opportunities")
    .insert(insertPayload)
    .select("id")
    .single();

  if (error) {
    return { ok: false, message: friendlyPublishError(error) };
  }

  const pushResult = await sendPendingPushNotificationsForOpportunity(data.id, [
    "new_opportunity",
  ]);
  console.log("Server push trigger completed", {
    context: "new_opportunity",
    opportunityId: data.id,
    result: pushResult,
  });

  revalidatePath("/app");
  revalidatePath("/app/dashboard");
  revalidatePath("/app/coach-dashboard");

  return { ok: true, data: { id: data.id } };
}

export async function updateOpportunity(
  opportunityId: string,
  input: PublishOpportunityInput,
): Promise<ActionResult<{ id: string }>> {
  const { supabase, user, profile } = await getAuthenticatedOrganizer();

  if (!user) {
    return { ok: false, message: "Please log in again before saving." };
  }

  if (
    profile?.is_organizer !== true &&
    profile?.wants_to_create_opportunities !== true
  ) {
    return {
      ok: false,
      message: "Enable organizer mode in your profile first.",
    };
  }

  if (!uuidPattern.test(opportunityId)) {
    return { ok: false, message: "Opportunity not found." };
  }

  if (input.type !== "camp" && input.type !== "huck_jam") {
    return { ok: false, message: "Please choose an opportunity type." };
  }

  if (
    input.type === "camp" &&
    input.tunnelTimeMode !== "athletes_may_use_own_tunnel_time" &&
    input.tunnelTimeMode !== "tunnel_time_must_be_purchased_through_coach"
  ) {
    return { ok: false, message: "Please choose a tunnel time mode." };
  }

  const bookingMode: BookingMode = "approval_required";

  if (!uuidPattern.test(input.tunnelId)) {
    return { ok: false, message: "Please select a tunnel before saving." };
  }

  if (
    !isValidDate(input.startDate) ||
    (input.type === "camp" && !isValidDate(input.endDate))
  ) {
    return { ok: false, message: "Please select valid dates." };
  }

  if (
    input.type === "camp" &&
    new Date(input.endDate) < new Date(input.startDate)
  ) {
    return {
      ok: false,
      message: "End date must be the same as or after the start date.",
    };
  }

  const registrationDeadline = resolveRegistrationDeadline(
    input.registrationDeadline,
    input.startDate,
  );

  if (
    !isValidDate(registrationDeadline) ||
    new Date(registrationDeadline) >
      new Date(input.startDate)
  ) {
    return {
      ok: false,
      message:
        input.type === "huck_jam"
          ? "Registration deadline must be on or before the event date."
          : "Registration deadline must be on or before the start date.",
    };
  }

  if (input.type === "huck_jam") {
    if (!isValidTime(input.sessionStart) || !isValidTime(input.sessionEnd)) {
      return { ok: false, message: "Please enter valid session times." };
    }

    if (input.sessionEnd <= input.sessionStart) {
      return { ok: false, message: "Session end must be after session start." };
    }
  }

  if (!Number.isFinite(input.price) || input.price < 0) {
    return { ok: false, message: "Please enter a valid price." };
  }

  if (
    input.type === "camp" &&
    !isValidPriceAppliesToMinutes(input.minMinutesOrHours)
  ) {
    return { ok: false, message: priceAppliesToErrorMessage() };
  }

  if (!isSupportedCurrency(input.currency)) {
    return { ok: false, message: "Please choose a valid currency." };
  }

  if (!Number.isInteger(input.totalCapacity) || input.totalCapacity < 1) {
    return { ok: false, message: "Please enter a valid capacity." };
  }

  const { data: existing, error: existingError } = await supabase
    .from("opportunities")
    .select("id,created_by,total_capacity,available_spots")
    .eq("id", opportunityId)
    .eq("created_by", user.id)
    .maybeSingle();

  if (existingError) {
    return { ok: false, message: friendlyPublishError(existingError) };
  }

  if (!existing) {
    return { ok: false, message: "Opportunity not found." };
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
    return { ok: false, message: "Please select a tunnel before saving." };
  }

  const acceptedResult = await supabase
    .from("opportunity_interests")
    .select("*", { count: "exact", head: true })
    .eq("opportunity_id", opportunityId)
    .eq("status", "accepted");
  const acceptedCount = acceptedResult.count ?? 0;

  if (input.totalCapacity < acceptedCount) {
    return {
      ok: false,
      message: `Capacity cannot be lower than ${acceptedCount} accepted applicants.`,
    };
  }

  const title = input.title.trim()
    ? input.title.trim()
    : `${input.type === "camp" ? "Camp" : "Huck Jam"} with ${
        profile?.full_name ?? user.email?.split("@")[0] ?? "Flyloop organizer"
      }`;
  const inheritedCoachProfile = await getInheritedCoachProfile(supabase, user.id);
  const supportsTunnelTimeMode = await supportsCampTunnelTimeModeColumn(supabase);
  const tunnelTimeModeValue =
    input.type === "camp"
      ? input.tunnelTimeMode
      : "athletes_may_use_own_tunnel_time";

  const updatePayload: Record<string, unknown> = {
    type: input.type,
    booking_mode: bookingMode,
    title,
    tunnel_id: input.tunnelId,
    start_date: input.startDate,
    end_date: input.type === "huck_jam" ? input.startDate : input.endDate,
    registration_deadline: registrationDeadline,
    session_start: input.type === "huck_jam" ? input.sessionStart : null,
    session_end: input.type === "huck_jam" ? input.sessionEnd : null,
    price: input.price,
    currency: input.currency,
    total_capacity: input.totalCapacity,
    available_spots: Math.max(input.totalCapacity - acceptedCount, 0),
    min_minutes_or_hours:
      input.type === "huck_jam" ? null : input.minMinutesOrHours.trim(),
    description: cleanText(input.description),
    languages: inheritedCoachProfile.languages,
    disciplines: inheritedCoachProfile.disciplines,
    skill_level: cleanText(input.skillLevel),
  };

  if (supportsTunnelTimeMode) {
    updatePayload.tunnel_time_mode = tunnelTimeModeValue;
  }

  const { error } = await supabase
    .from("opportunities")
    .update(updatePayload)
    .eq("id", opportunityId)
    .eq("created_by", user.id);

  if (error) {
    return { ok: false, message: friendlyPublishError(error) };
  }

  if (input.type === "huck_jam") {
    const { error: slotCleanupError } = await supabase
      .from("opportunity_time_slots")
      .delete()
      .eq("opportunity_id", opportunityId);

    if (slotCleanupError) {
      return { ok: false, message: friendlyPublishError(slotCleanupError) };
    }
  }

  const pushResult = await sendPendingPushNotificationsForOpportunity(opportunityId, [
    "new_opportunity",
  ]);
  console.log("Server push trigger completed", {
    context: "new_opportunity",
    opportunityId,
    result: pushResult,
  });

  revalidatePath("/app");
  revalidatePath("/app/dashboard");
  revalidatePath("/app/coach-dashboard");
  revalidatePath(`/app/organizer/opportunities/${opportunityId}`);
  revalidatePath(`/app/opportunities/${opportunityId}`);

  return { ok: true, data: { id: opportunityId } };
}

export async function publishDraftOpportunity(
  opportunityId: string,
): Promise<ActionResult<{ id: string }>> {
  const { supabase, user, profile } = await getAuthenticatedOrganizer();

  if (!user) {
    return { ok: false, message: "Please log in again before publishing." };
  }

  if (
    profile?.is_organizer !== true &&
    profile?.wants_to_create_opportunities !== true
  ) {
    return {
      ok: false,
      message: "Enable organizer mode in your profile first.",
    };
  }

  if (!uuidPattern.test(opportunityId)) {
    return { ok: false, message: "Opportunity not found." };
  }

  const { data: opportunity, error: lookupError } = await supabase
    .from("opportunities")
    .select("id,created_by,status,total_capacity")
    .eq("id", opportunityId)
    .eq("created_by", user.id)
    .maybeSingle();

  if (lookupError) {
    return { ok: false, message: friendlyPublishError(lookupError) };
  }

  if (!opportunity) {
    return { ok: false, message: "Opportunity not found." };
  }

  if (opportunity.status !== "draft") {
    return { ok: false, message: "Only draft opportunities can be published." };
  }

  const { error } = await supabase
    .from("opportunities")
    .update({
      status: "published",
      available_spots: opportunity.total_capacity,
    })
    .eq("id", opportunityId)
    .eq("created_by", user.id)
    .eq("status", "draft");

  if (error) {
    return { ok: false, message: friendlyPublishError(error) };
  }

  revalidatePath("/app");
  revalidatePath("/app/dashboard");
  revalidatePath("/app/coach-dashboard");
  revalidatePath(`/app/organizer/opportunities/${opportunityId}`);
  revalidatePath(`/app/opportunities/${opportunityId}`);

  return { ok: true, data: { id: opportunityId } };
}

export async function addTunnel(
  input: AddTunnelInput,
): Promise<ActionResult<{ id: string; name: string }>> {
  const { supabase, user, profile } = await getAuthenticatedOrganizer();

  if (!user) {
    return { ok: false, message: "Please log in again before adding a tunnel." };
  }

  if (profile?.is_admin !== true) {
    return {
      ok: false,
      message: "Only admins can add tunnels.",
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
