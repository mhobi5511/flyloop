"use server";

import { revalidatePath } from "next/cache";
import { createSupabaseAdminClient } from "@/lib/supabase/admin-client";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { sendPendingPushNotificationsForUsers } from "@/lib/push";
import type { InterestStatus, TunnelTimeStatus } from "@/lib/types";

type ActionResult =
  | { ok: true; message: string; status?: InterestStatus }
  | { ok: false; message: string };

export type CampDayPreferenceInput = {
  dayId: number;
  preferredMinutes: number;
};

function debugSupabaseMessage(error: {
  message?: string;
  details?: string | null;
  hint?: string | null;
  code?: string;
}) {
  return [
    error.message,
    error.details,
    error.hint,
    error.code ? `Code: ${error.code}` : "",
  ]
    .filter(Boolean)
    .join(" ");
}

function reminderErrorMessage(error: {
  message?: string;
  details?: string | null;
  hint?: string | null;
  code?: string;
}) {
  return debugSupabaseMessage(error) || "Could not set reminder. Please try again.";
}

async function sendServerPush(
  userIds: string[],
  context: string,
  filter?: { opportunityId?: string; types?: string[] },
) {
  const result = await sendPendingPushNotificationsForUsers(userIds, filter);
  console.log("Server push trigger completed", { context, result, userIds, filter });
}

export async function sendOpportunityInterest(
  opportunityId: string,
  campPreferences: CampDayPreferenceInput[] = [],
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
    .select("id,title,type,status,available_spots,created_by,booking_mode")
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

  if (
    opportunity.type !== "huck_jam" &&
    !(opportunity.type === "camp" || opportunity.booking_mode === "approval_required")
  ) {
    return {
      ok: false,
      message: "This opportunity uses direct time booking.",
    };
  }

  if (opportunity.available_spots <= 0) {
    return { ok: false, message: "This opportunity is already full." };
  }

  const { data: existingInterest, error: existingError } = await supabase
    .from("opportunity_interests")
    .select("id,status")
    .eq("opportunity_id", opportunityId)
    .eq("athlete_id", user.id)
    .maybeSingle();

  if (existingError) {
    console.error("Interest duplicate lookup failed", existingError);
    return { ok: false, message: "Could not send interest. Please try again." };
  }

  if (existingInterest?.status === "withdrawn") {
    const adminSupabase = createSupabaseAdminClient();

    if (!adminSupabase) {
      console.error("Withdrawn interest reset failed: missing admin Supabase client");
      return { ok: false, message: "Could not send interest. Please try again." };
    }

    const { error: resetError } = await adminSupabase
      .from("opportunity_interests")
      .delete()
      .eq("id", existingInterest.id)
      .eq("athlete_id", user.id);

    if (resetError) {
      console.error("Withdrawn interest reset failed", resetError);
      return { ok: false, message: "Could not send interest. Please try again." };
    }
  }

  if (opportunity.type === "camp" && campPreferences.length > 0) {
    const { error: preferenceError } = await supabase
      .from("camp_day_preferences")
      .upsert(
        campPreferences.map((preference) => ({
          opportunity_id: opportunityId,
          participant_id: user.id,
          day_id: preference.dayId,
          preferred_minutes: preference.preferredMinutes,
        })),
        { onConflict: "opportunity_id,participant_id,day_id" },
      );

    if (preferenceError) {
      console.error("Camp preference save failed", preferenceError);
      return { ok: false, message: "Could not save your preferences. Please try again." };
    }
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
      return {
        ok: true,
        message:
          opportunity.type === "camp"
            ? "Application sent.\nYour preferences are visible to the coach."
            : "Your interest was already sent.",
      };
    }

    console.error("Interest creation failed", error);
    return { ok: false, message: "Could not send interest. Please try again." };
  }

  await sendServerPush([opportunity.created_by], "new_interest", {
    opportunityId,
    types: ["new_interest"],
  });

  revalidatePath(`/app/opportunities/${opportunityId}`);
  revalidatePath("/app/dashboard");

  return {
    ok: true,
    message:
    opportunity.type === "huck_jam"
      ? "Application received.\nThe organizer will review it and send an update."
      : opportunity.type === "camp"
        ? "Application sent.\nYour preferences are visible to the coach."
        : [
            "Your interest was sent.",
            "The organizer has been notified.",
            "You will receive an update when your status changes.",
          ].join("\n"),
    status: "pending",
  };
}

export async function setTimetableReminder(
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
    .select("id,status,type,booking_mode,created_by")
    .eq("id", opportunityId)
    .maybeSingle();

  if (opportunityError) {
    console.error("Reminder opportunity lookup failed", opportunityError);
    return { ok: false, message: "Could not set reminder. Please try again." };
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

  if (
    opportunity.type === "huck_jam" ||
    opportunity.booking_mode !== "direct_time_booking"
  ) {
    return { ok: false, message: "This opportunity uses applications first." };
  }

  const { data: existingInterest, error: existingError } = await supabase
    .from("opportunity_interests")
    .select("id,status,interest_type")
    .eq("opportunity_id", opportunityId)
    .eq("athlete_id", user.id)
    .maybeSingle();

  if (existingError) {
    console.error("Reminder duplicate lookup failed", {
      opportunityId,
      userId: user.id,
      code: existingError.code,
      message: existingError.message,
      details: existingError.details,
      hint: existingError.hint,
      error: existingError,
    });
    return { ok: false, message: reminderErrorMessage(existingError) };
  }

  if (existingInterest?.status === "withdrawn") {
    const adminSupabase = createSupabaseAdminClient();

    if (!adminSupabase) {
      console.error("Withdrawn reminder reset failed: missing admin Supabase client");
      return { ok: false, message: "Could not set reminder. Please try again." };
    }

    const { error: resetError } = await adminSupabase
      .from("opportunity_interests")
      .delete()
      .eq("id", existingInterest.id)
      .eq("athlete_id", user.id);

    if (resetError) {
      console.error("Withdrawn reminder reset failed", resetError);
      return { ok: false, message: reminderErrorMessage(resetError) };
    }
  } else if (existingInterest) {
    if (existingInterest.interest_type === "timetable_reminder") {
      return {
        ok: true,
        message: "You'll be notified when times are available.",
      };
    }

    if (
      existingInterest.status === "declined" ||
      existingInterest.status === "waitlist"
    ) {
      return {
        ok: false,
        message:
          existingInterest.status === "declined"
            ? "Your application was declined."
            : "You are on the waitlist.",
      };
    }

    return {
      ok: true,
      message: `You already joined this opportunity. Current status: ${formatInterestStatus(existingInterest.status)}.`,
      status: existingInterest.status as InterestStatus,
    };
  }

  const { error } = await supabase.from("opportunity_interests").insert({
    opportunity_id: opportunityId,
    athlete_id: user.id,
    interest_type: "timetable_reminder",
  });

  if (error) {
    if (error.code === "23505") {
      return {
        ok: true,
        message: "You'll be notified when times are available.",
      };
    }

    console.error("Reminder creation failed", {
      opportunityId,
      userId: user.id,
      code: error.code,
      message: error.message,
      details: error.details,
      hint: error.hint,
      error,
    });
    return { ok: false, message: reminderErrorMessage(error) };
  }

  await sendServerPush([opportunity.created_by], "timetable_reminder_interest", {
    opportunityId,
    types: ["timetable_reminder_interest"],
  });

  revalidatePath(`/app/opportunities/${opportunityId}`);
  revalidatePath("/app/dashboard");

  return {
    ok: true,
    message: "You'll be notified when times are available.",
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

  console.log("Delete opportunity requested", {
    opportunityId,
    userId: user.id,
  });

  const [
    { data: opportunityBeforeDelete, error: opportunityLookupError },
    { data: interestRecipients, error: interestRecipientError },
    { data: bookingRecipients, error: bookingRecipientError },
  ] = await Promise.all([
    supabase
      .from("opportunities")
      .select("created_by")
      .eq("id", opportunityId)
      .maybeSingle(),
    supabase
      .from("opportunity_interests")
      .select("athlete_id")
      .eq("opportunity_id", opportunityId),
    supabase
      .from("opportunity_slot_bookings")
      .select("user_id")
      .eq("opportunity_id", opportunityId),
  ]);

  if (opportunityLookupError) {
    console.error("Delete opportunity push opportunity lookup failed", {
      opportunityId,
      userId: user.id,
      error: opportunityLookupError,
    });
  }

  if (interestRecipientError) {
    console.error("Delete opportunity interest recipient lookup failed", {
      opportunityId,
      userId: user.id,
      error: interestRecipientError,
    });
  }

  if (bookingRecipientError) {
    console.error("Delete opportunity booking recipient lookup failed", {
      opportunityId,
      userId: user.id,
      error: bookingRecipientError,
    });
  }

  const affectedUserIds = [
    ...new Set([
      ...(interestRecipients ?? []).map((row) => row.athlete_id),
      ...(bookingRecipients ?? []).map((row) => row.user_id),
    ]),
  ].filter((affectedUserId) =>
    Boolean(
      affectedUserId &&
        affectedUserId !== user.id &&
        affectedUserId !== opportunityBeforeDelete?.created_by,
    ),
  );

  const { data: deleted, error } = await supabase.rpc(
    "delete_opportunity_with_notification_cleanup",
    {
      target_opportunity_id: opportunityId,
    },
  );

  console.log("Delete opportunity RPC response", {
    opportunityId,
    userId: user.id,
    deleted,
    error,
  });

  if (error) {
    const debugMessage = [
      error.message,
      error.details,
      error.hint,
      error.code ? `Code: ${error.code}` : "",
    ]
      .filter(Boolean)
      .join(" ");

    console.error("Opportunity deletion failed", {
      opportunityId,
      userId: user.id,
      message: error.message,
      details: error.details,
      hint: error.hint,
      code: error.code,
      error,
    });

    return {
      ok: false,
      message: debugMessage || "Opportunity deletion failed without details.",
    };
  }

  if (!deleted) {
    return { ok: false, message: "Opportunity not found." };
  }

  if (affectedUserIds.length > 0) {
    await sendServerPush(affectedUserIds, "opportunity_deleted", {
      types: ["opportunity_deleted"],
    });
  }

  revalidatePath("/app");
  revalidatePath("/app/dashboard");
  revalidatePath("/app/applications");
  revalidatePath(`/app/opportunities/${opportunityId}`);
  revalidatePath(`/app/organizer/opportunities/${opportunityId}`);

  return { ok: true, message: "Opportunity deleted." };
}

export async function bookOpportunitySlots(
  opportunityId: string,
  slotIds: string[],
  tunnelTime: {
    status: TunnelTimeStatus | "";
    accountEmail: string;
  },
): Promise<ActionResult> {
  const uniqueSlotIds = [...new Set(slotIds)].filter(Boolean);

  if (uniqueSlotIds.length === 0) {
    return { ok: false, message: "Select at least one slot." };
  }

  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError || !user) {
    return { ok: false, message: "Please log in again." };
  }

  const tunnelTimeResult = await saveTunnelTimeStatus(
    supabase,
    opportunityId,
    user.id,
    tunnelTime,
  );

  if (!tunnelTimeResult.ok) {
    return tunnelTimeResult;
  }

  const { error } = await supabase.rpc("book_opportunity_slots", {
    target_opportunity_id: opportunityId,
    target_slot_ids: uniqueSlotIds,
  });

  if (error) {
    console.error("Slot booking failed", {
      opportunityId,
      userId: user.id,
      slotIds: uniqueSlotIds,
      code: error.code,
      message: error.message,
      details: error.details,
      hint: error.hint,
    });

    return {
      ok: false,
      message: error.message || "Could not book slots. Please try again.",
    };
  }

  revalidatePath(`/app/opportunities/${opportunityId}`);
  revalidatePath(`/app/opportunities/${opportunityId}/times`);
  revalidatePath(`/app/organizer/opportunities/${opportunityId}`);
  revalidatePath("/app/applications");
  revalidatePath("/app/dashboard");

  return { ok: true, message: "Your slots were saved as draft." };
}

export async function setCampTunnelTimeStatus(
  opportunityId: string,
  tunnelTime: {
    status: TunnelTimeStatus | "";
    accountEmail: string;
  },
): Promise<ActionResult> {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError || !user) {
    return { ok: false, message: "Please log in again." };
  }

  const result = await saveTunnelTimeStatus(
    supabase,
    opportunityId,
    user.id,
    tunnelTime,
  );

  if (!result.ok) {
    return result;
  }

  revalidatePath(`/app/opportunities/${opportunityId}`);
  revalidatePath(`/app/opportunities/${opportunityId}/times`);
  revalidatePath(`/app/organizer/opportunities/${opportunityId}`);
  revalidatePath("/app/applications");
  revalidatePath("/app/dashboard");

  return { ok: true, message: "Tunnel time status saved." };
}

export async function releaseOwnOpportunitySlot(
  opportunityId: string,
  slotId: string,
): Promise<ActionResult> {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError || !user) {
    return { ok: false, message: "Please log in again." };
  }

  const { data: booking, error: bookingError } = await supabase
    .from("opportunity_slot_bookings")
    .select("id,is_final,opportunity_id,user_id")
    .eq("opportunity_id", opportunityId)
    .eq("slot_id", slotId)
    .eq("user_id", user.id)
    .maybeSingle();

  if (bookingError) {
    console.error("Own slot lookup failed", {
      opportunityId,
      slotId,
      userId: user.id,
      code: bookingError.code,
      message: bookingError.message,
      details: bookingError.details,
      hint: bookingError.hint,
    });
    return { ok: false, message: "Could not release slot." };
  }

  if (!booking) {
    return { ok: false, message: "No booked slot to release." };
  }

  if (booking.is_final) {
    const adminSupabase = createSupabaseAdminClient();

    if (!adminSupabase) {
      return { ok: false, message: "Could not send release request." };
    }

    const { error } = await adminSupabase
      .from("opportunity_slot_bookings")
      .update({
        release_requested_at: new Date().toISOString(),
        release_requested_by: user.id,
      })
      .eq("id", booking.id)
      .eq("user_id", user.id);

    if (error) {
      console.error("Own slot release request failed", {
        opportunityId,
        slotId,
        userId: user.id,
        code: error.code,
        message: error.message,
        details: error.details,
        hint: error.hint,
      });
      return { ok: false, message: "Could not send release request." };
    }

    const { data: opportunity } = await supabase
      .from("opportunities")
      .select("created_by")
      .eq("id", opportunityId)
      .maybeSingle();

    if (opportunity?.created_by) {
      await sendServerPush([opportunity.created_by], "slot_release_requested", {
        opportunityId,
        types: ["slot_release_requested"],
      });
    }

    revalidatePath(`/app/opportunities/${opportunityId}`);
    revalidatePath(`/app/opportunities/${opportunityId}/times`);
    revalidatePath(`/app/organizer/opportunities/${opportunityId}`);
    revalidatePath("/app/dashboard");
    revalidatePath("/app/coach-dashboard");
    revalidatePath("/app/applications");

    return { ok: true, message: "Release request sent." };
  }

  const { error } = await supabase
    .from("opportunity_slot_bookings")
    .delete()
    .eq("id", booking.id)
    .eq("user_id", user.id);

  if (error) {
    console.error("Own slot release failed", {
      opportunityId,
      slotId,
      userId: user.id,
      code: error.code,
      message: error.message,
      details: error.details,
      hint: error.hint,
    });

    return {
      ok: false,
      message: error.message || "Could not release slot.",
    };
  }

  revalidatePath(`/app/opportunities/${opportunityId}`);
  revalidatePath(`/app/opportunities/${opportunityId}/times`);
  revalidatePath(`/app/organizer/opportunities/${opportunityId}`);
  revalidatePath("/app/applications");
  revalidatePath("/app/dashboard");

  return {
    ok: true,
    message: "Slot released.",
  };
}

async function saveTunnelTimeStatus(
  supabase: Awaited<ReturnType<typeof createSupabaseServerClient>>,
  opportunityId: string,
  userId: string,
  tunnelTime: {
    status: TunnelTimeStatus | "";
    accountEmail: string;
  },
): Promise<ActionResult> {
  if (
    tunnelTime.status !== "owns_tunnel_time" &&
    tunnelTime.status !== "needs_tunnel_time"
  ) {
    return { ok: false, message: "Choose your tunnel time status." };
  }

  const tunnelAccountEmail = tunnelTime.accountEmail.trim().toLowerCase();

  if (tunnelTime.status === "owns_tunnel_time") {
    if (!tunnelAccountEmail) {
      return {
        ok: false,
        message: "Enter the email address used for your tunnel account.",
      };
    }

    if (!isEmailInput(tunnelAccountEmail)) {
      return { ok: false, message: "Enter a valid tunnel account email address." };
    }
  }

  const { error } = await supabase.rpc(
    "set_opportunity_participant_tunnel_time_status",
    {
      target_opportunity_id: opportunityId,
      target_tunnel_time_status: tunnelTime.status,
      target_tunnel_account_email:
        tunnelTime.status === "owns_tunnel_time" ? tunnelAccountEmail : null,
    },
  );

  if (error) {
    console.error("Tunnel time status update failed", {
      opportunityId,
      userId,
      code: error.code,
      message: error.message,
      details: error.details,
      hint: error.hint,
    });
    return {
      ok: false,
      message: error.message || "Could not save tunnel time status.",
    };
  }

  return { ok: true, message: "Tunnel time status saved." };
}

function isEmailInput(value: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}
