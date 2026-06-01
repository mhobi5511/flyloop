"use server";

import { revalidatePath } from "next/cache";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import type { InterestStatus } from "@/lib/types";

type ActionResult =
  | { ok: true; message: string; status?: InterestStatus }
  | { ok: false; message: string };

export async function sendOpportunityInterest(
  opportunityId: string,
): Promise<ActionResult> {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError || !user) {
    return { ok: false, message: "Please log in again." };
  }

  const { data: opportunity, error: opportunityError } = await supabase
    .from("opportunities")
    .select("id,status,available_spots,created_by")
    .eq("id", opportunityId)
    .maybeSingle();

  if (opportunityError) {
    console.error("Interest opportunity lookup failed", opportunityError);
    return { ok: false, message: "Could not send interest. Please try again." };
  }

  if (!opportunity || opportunity.status !== "published") {
    return { ok: false, message: "This opportunity is no longer available." };
  }

  if (opportunity.created_by === user.id) {
    return {
      ok: false,
      message: "You manage this opportunity from the organizer dashboard.",
    };
  }

  if (opportunity.available_spots <= 0) {
    return { ok: false, message: "This opportunity is already full." };
  }

  const { data: existingInterest, error: existingError } = await supabase
    .from("opportunity_interests")
    .select("status")
    .eq("opportunity_id", opportunityId)
    .eq("athlete_id", user.id)
    .maybeSingle();

  if (existingError) {
    console.error("Interest duplicate lookup failed", existingError);
    return { ok: false, message: "Could not send interest. Please try again." };
  }

  if (existingInterest) {
    return {
      ok: true,
      message: `You already applied. Current status: ${formatInterestStatus(existingInterest.status)}.`,
      status: existingInterest.status as InterestStatus,
    };
  }

  const { error } = await supabase.from("opportunity_interests").insert({
    opportunity_id: opportunityId,
    athlete_id: user.id,
    status: "pending",
  });

  if (error) {
    if (error.code === "23505") {
      return { ok: true, message: "Your interest was already sent." };
    }

    console.error("Interest creation failed", error);
    return { ok: false, message: "Could not send interest. Please try again." };
  }

  revalidatePath(`/app/opportunities/${opportunityId}`);
  revalidatePath("/app/dashboard");

  return {
    ok: true,
    message: "Your interest was sent. The organizer can contact you directly.",
    status: "pending",
  };
}

function formatInterestStatus(status: string) {
  return status === "waitlist"
    ? "Waitlist"
    : status.charAt(0).toUpperCase() + status.slice(1);
}

export async function cancelOpportunity(
  opportunityId: string,
): Promise<ActionResult> {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError || !user) {
    return { ok: false, message: "Please log in again." };
  }

  const { error } = await supabase
    .from("opportunities")
    .update({ status: "cancelled" })
    .eq("id", opportunityId)
    .eq("created_by", user.id);

  if (error) {
    console.error("Opportunity cancellation failed", error);
    return { ok: false, message: "Could not cancel opportunity. Please try again." };
  }

  revalidatePath("/app");
  revalidatePath("/app/dashboard");
  revalidatePath(`/app/opportunities/${opportunityId}`);
  revalidatePath(`/app/organizer/opportunities/${opportunityId}`);

  return { ok: true, message: "Opportunity cancelled." };
}

export async function deleteOpportunity(
  opportunityId: string,
): Promise<ActionResult> {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError || !user) {
    return { ok: false, message: "Please log in again." };
  }

  const { data: deleted, error } = await supabase.rpc(
    "delete_opportunity_with_notification_cleanup",
    {
      target_opportunity_id: opportunityId,
    },
  );

  if (error) {
    console.error("Opportunity deletion failed", error);
    return { ok: false, message: "Could not delete opportunity. Please try again." };
  }

  if (!deleted) {
    return { ok: false, message: "Opportunity not found." };
  }

  revalidatePath("/app");
  revalidatePath("/app/dashboard");
  revalidatePath("/app/applications");
  revalidatePath(`/app/opportunities/${opportunityId}`);
  revalidatePath(`/app/organizer/opportunities/${opportunityId}`);

  return { ok: true, message: "Opportunity deleted." };
}
