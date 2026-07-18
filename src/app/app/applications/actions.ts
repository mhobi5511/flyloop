"use server";

import { revalidatePath } from "next/cache";
import { createSupabaseAdminClient } from "@/lib/supabase/admin-client";
import { hasUnreadNotification } from "@/lib/notification-dedupe";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { schedulePendingPushNotificationsForUsers } from "@/lib/push";

type ActionResult =
  | { ok: true; message: string }
  | { ok: false; message: string };

export async function withdrawApplication(interestId: string): Promise<ActionResult> {
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
    .select("id,status,athlete_id,opportunity_id,opportunities(id,title,created_by)")
    .eq("id", interestId)
    .maybeSingle();

  if (lookupError) {
    console.error("Application lookup failed", lookupError);
    return { ok: false, message: "Could not withdraw application. Please try again." };
  }

  if (!interest || interest.athlete_id !== user.id) {
    return { ok: false, message: "Application not found." };
  }

  if (interest.status === "declined") {
    return { ok: false, message: "This application was already declined." };
  }

  if (
    interest.status !== "pending" &&
    interest.status !== "accepted" &&
    interest.status !== "waitlist" &&
    interest.status !== "withdrawn"
  ) {
    return { ok: false, message: "This application cannot be withdrawn." };
  }

  const { data: withdrawnOpportunityId, error } = await supabase.rpc(
    "withdraw_opportunity_interest",
    { target_interest_id: interestId },
  );

  if (error) {
    console.error("Application withdrawal failed", {
      interestId,
      opportunityId: interest.opportunity_id,
      athleteId: user.id,
      code: error.code,
      message: error.message,
      details: error.details,
      hint: error.hint,
    });
    return {
      ok: false,
      message: error.message || "Could not withdraw application. Please try again.",
    };
  }

  const opportunity = Array.isArray(interest?.opportunities)
    ? interest?.opportunities[0]
    : interest?.opportunities;

  if (opportunity?.created_by) {
    const adminSupabase = createSupabaseAdminClient();

    if (adminSupabase) {
      const shouldPush = !(await hasUnreadNotification(adminSupabase, {
        userId: opportunity.created_by,
        type: "application_withdrawn",
        opportunityId: opportunity.id,
      }));
      const { data: profile } = await supabase
        .from("profiles")
        .select("full_name")
        .eq("id", user.id)
        .maybeSingle();
      const userName = profile?.full_name?.trim() || "A participant";
      const { error: notificationError } = await adminSupabase
        .from("notifications")
        .insert({
          user_id: opportunity.created_by,
          title: "Application withdrawn",
          body: `${userName} withdrew their application from ${opportunity.title}.`,
          type: "application_withdrawn",
          opportunity_id: opportunity.id,
        });

      if (notificationError) {
        console.error("Application withdrawal notification failed", notificationError);
      } else if (shouldPush) {
        schedulePendingPushNotificationsForUsers(
          [opportunity.created_by],
          {
            opportunityId: opportunity.id,
            types: ["application_withdrawn"],
          },
          "application_withdrawn",
        );
      }
    }
  }

  revalidatePath("/app/applications");
  revalidatePath("/app/dashboard");
  revalidatePath(`/app/opportunities/${withdrawnOpportunityId ?? interest.opportunity_id}`);
  revalidatePath(`/app/opportunities/${withdrawnOpportunityId ?? interest.opportunity_id}/times`);

  return { ok: true, message: "Application withdrawn." };
}

export async function requestCampRemoval(
  interestId: string,
): Promise<ActionResult> {
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
    .select("id,status,athlete_id,opportunity_id,removal_requested_at,opportunities(id,title,type,created_by)")
    .eq("id", interestId)
    .maybeSingle();

  if (lookupError) {
    console.error("Camp removal request lookup failed", lookupError);
    return { ok: false, message: "Could not send request. Please try again." };
  }

  const opportunity = Array.isArray(interest?.opportunities)
    ? interest?.opportunities[0]
    : interest?.opportunities;

  if (!interest || interest.athlete_id !== user.id || !opportunity) {
    return { ok: false, message: "Application not found." };
  }

  if (opportunity.type !== "camp") {
    return { ok: false, message: "Removal requests are only available for Camps." };
  }

  if (interest.status !== "accepted") {
    return { ok: false, message: "Only accepted participants can request removal." };
  }

  if (interest.removal_requested_at) {
    return { ok: false, message: "Removal already requested." };
  }

  const requestedAt = new Date().toISOString();
  const adminSupabase = createSupabaseAdminClient();

  if (!adminSupabase) {
    console.error("Camp removal request failed: missing admin Supabase client");
    return { ok: false, message: "Could not send request. Please try again." };
  }

  const { data: updatedInterest, error } = await adminSupabase
    .from("opportunity_interests")
    .update({ removal_requested_at: requestedAt })
    .eq("id", interest.id)
    .eq("athlete_id", user.id)
    .eq("status", "accepted")
    .is("removal_requested_at", null)
    .select("id")
    .maybeSingle();

  if (error) {
    console.error("Camp removal request update failed", error);
    return { ok: false, message: "Could not send request. Please try again." };
  }

  if (!updatedInterest) {
    return { ok: false, message: "Removal already requested." };
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("full_name")
    .eq("id", user.id)
    .maybeSingle();
  const userName = profile?.full_name?.trim() || "A participant";
  const shouldPush =
    !(await hasUnreadNotification(adminSupabase, {
      userId: opportunity.created_by,
      type: "participant_removal_requested",
      opportunityId: opportunity.id,
    }));

  const { error: notificationError } = await adminSupabase.from("notifications").insert({
    user_id: opportunity.created_by,
    title: "Participant wants to leave",
    body: `${userName} asked to leave ${opportunity.title}.`,
    type: "participant_removal_requested",
    opportunity_id: opportunity.id,
  });

  if (notificationError) {
    console.error("Camp removal organizer notification failed", notificationError);
  } else if (shouldPush) {
    schedulePendingPushNotificationsForUsers(
      [opportunity.created_by],
      {
        opportunityId: opportunity.id,
        types: ["participant_removal_requested"],
      },
      "participant_removal_requested",
    );
  }

  revalidatePath(`/app/opportunities/${opportunity.id}`);
  revalidatePath(`/app/organizer/opportunities/${opportunity.id}`);
  revalidatePath("/app/applications");
  revalidatePath("/app/dashboard");

  return { ok: true, message: "Removal requested." };
}
