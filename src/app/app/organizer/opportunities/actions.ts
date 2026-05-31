"use server";

import { revalidatePath } from "next/cache";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import type { InterestStatus } from "@/lib/types";

const editableStatuses: InterestStatus[] = ["accepted", "declined", "waitlist"];

type ActionResult =
  | { ok: true; message: string }
  | { ok: false; message: string };

export async function updateApplicantStatus(
  interestId: string,
  status: InterestStatus,
): Promise<ActionResult> {
  if (!editableStatuses.includes(status)) {
    return { ok: false, message: "Please choose a valid status." };
  }

  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError || !user) {
    return { ok: false, message: "Please log in again." };
  }

  const { data: interest, error: lookupError } = await supabase
    .from("opportunity_interests")
    .select("id,opportunity_id,status,athlete_id,opportunities(created_by,total_capacity,available_spots)")
    .eq("id", interestId)
    .maybeSingle();

  if (lookupError) {
    console.error("Applicant lookup failed", {
      interestId,
      status,
      code: lookupError.code,
      message: lookupError.message,
      details: lookupError.details,
      hint: lookupError.hint,
    });
    return { ok: false, message: "Could not update applicant. Please try again." };
  }

  const opportunity = Array.isArray(interest?.opportunities)
    ? interest?.opportunities[0]
    : interest?.opportunities;

  if (!interest || opportunity?.created_by !== user.id) {
    return { ok: false, message: "Applicant not found." };
  }

  if (
    status === "accepted" &&
    interest.status !== "accepted" &&
    opportunity.available_spots <= 0
  ) {
    return {
      ok: false,
      message: "This opportunity is full. Move the applicant to waitlist instead.",
    };
  }

  const { data: updatedInterest, error } = await supabase
    .from("opportunity_interests")
    .update({ status })
    .eq("id", interestId)
    .select("id,status,opportunity_id")
    .maybeSingle();

  if (error) {
    console.error("Applicant status update failed", {
      interestId,
      opportunityId: interest.opportunity_id,
      athleteId: interest.athlete_id,
      fromStatus: interest.status,
      toStatus: status,
      organizerId: user.id,
      code: error.code,
      message: error.message,
      details: error.details,
      hint: error.hint,
    });
    return { ok: false, message: "Could not update applicant. Please try again." };
  }

  if (!updatedInterest) {
    console.error("Applicant status update returned no row", {
      interestId,
      opportunityId: interest.opportunity_id,
      fromStatus: interest.status,
      toStatus: status,
      organizerId: user.id,
    });
    return { ok: false, message: "Applicant not found or not editable." };
  }

  revalidatePath(`/app/organizer/opportunities/${updatedInterest.opportunity_id}`);
  revalidatePath("/app/dashboard");
  revalidatePath("/app/applications");

  return { ok: true, message: "Applicant status updated." };
}
