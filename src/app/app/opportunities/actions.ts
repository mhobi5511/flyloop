"use server";

import { revalidatePath } from "next/cache";
import { createSupabaseAdminClient } from "@/lib/supabase/admin-client";
import {
  normalizeCampTunnelTimeMode,
  supportsCampTunnelTimeModeColumn,
} from "@/lib/camp-tunnel-time-mode";
import { hasUnreadNotification } from "@/lib/notification-dedupe";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { schedulePendingPushNotificationsForUsers } from "@/lib/push";
import type { InterestStatus, TunnelTimeStatus } from "@/lib/types";

type ActionResult =
  | { ok: true; message: string; status?: InterestStatus }
  | { ok: false; message: string };

export type CampDayPreferenceInput = {
  dayId: number;
  preferredMinutes: number;
};

export type CampTunnelTimeInput = {
  status: TunnelTimeStatus | "";
  accountEmail: string;
};

type ValidatedCampTunnelTime = {
  ok: true;
  status: TunnelTimeStatus;
  accountEmail: string | null;
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

function scheduleServerPush(
  userIds: string[],
  context: string,
  filter?: { opportunityId?: string; types?: string[] },
) {
  schedulePendingPushNotificationsForUsers(userIds, filter, context);
}

export async function sendOpportunityInterest(
  opportunityId: string,
  campPreferences: CampDayPreferenceInput[] = [],
  campTunnelTime?: CampTunnelTimeInput,
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

  if (
    !opportunity ||
    (opportunity.status !== "published" && opportunity.status !== "full")
  ) {
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

  const { data: existingInterest, error: existingError } = await supabase
    .from("opportunity_interests")
    .select("id,status")
    .eq("opportunity_id", opportunityId)
    .eq("athlete_id", user.id)
    .maybeSingle();

  if (existingError) {
    console.error("Interest duplicate lookup failed", existingError);
    return {
      ok: false,
      message: `Could not send interest. Backend error: ${debugSupabaseMessage(existingError) || "Unknown error."}`,
    };
  }

  const hadExistingInterest = Boolean(existingInterest);
  let currentInterest = existingInterest;
  let createdInterestId: string | null = null;

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
      return {
        ok: false,
        message: `Could not send interest. Backend error: ${debugSupabaseMessage(resetError) || "Unknown error."}`,
      };
    }

    currentInterest = null;
  }

  const needsCampPreferences = opportunity.type === "camp" && campPreferences.length > 0;
  const requiresCoachManagedTunnelTime =
    opportunity.type === "camp" &&
    (await supportsCampTunnelTimeModeColumn(supabase)) &&
    (await getOpportunityTunnelTimeMode(supabase, opportunityId)) ===
      "tunnel_time_must_be_purchased_through_coach";
  const validatedCampTunnelTime =
    opportunity.type === "camp" && !requiresCoachManagedTunnelTime
      ? validateCampTunnelTimeInput(campTunnelTime)
      : null;

  if (validatedCampTunnelTime && !validatedCampTunnelTime.ok) {
    return validatedCampTunnelTime;
  }

  const campTunnelTimeFields =
    validatedCampTunnelTime?.ok
      ? {
          tunnel_time_status: validatedCampTunnelTime.status,
          tunnel_account_email: validatedCampTunnelTime.accountEmail,
        }
      : {};

  if (needsCampPreferences && !currentInterest) {
    const { data: createdInterest, error: createInterestError } = await supabase
      .from("opportunity_interests")
      .insert({
        opportunity_id: opportunityId,
        athlete_id: user.id,
        status: "pending",
        ...campTunnelTimeFields,
      })
      .select("id,status")
      .maybeSingle();

    if (createInterestError) {
      if (createInterestError.code !== "23505") {
        console.error("Camp interest creation failed", {
          opportunityId,
          athleteId: user.id,
          error: createInterestError,
        });
        return {
          ok: false,
          message: `Could not create your application. Backend error: ${debugSupabaseMessage(createInterestError) || "Unknown error."}`,
        };
      }

      const { data: retryInterest, error: retryError } = await supabase
        .from("opportunity_interests")
        .select("id,status")
        .eq("opportunity_id", opportunityId)
        .eq("athlete_id", user.id)
        .maybeSingle();

      if (retryError || !retryInterest) {
        console.error("Camp interest retry lookup failed", {
          opportunityId,
          athleteId: user.id,
          error: retryError ?? createInterestError,
        });
        return {
          ok: false,
          message: `Could not create your application. Backend error: ${debugSupabaseMessage(retryError ?? createInterestError) || "Unknown error."}`,
        };
      }

      currentInterest = retryInterest;
    } else {
      currentInterest = createdInterest ?? null;
      createdInterestId = createdInterest?.id ?? null;
    }
  }

  if (needsCampPreferences) {
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
      if (createdInterestId) {
        const { error: cleanupError } = await supabase
          .from("opportunity_interests")
          .delete()
          .eq("id", createdInterestId)
          .eq("athlete_id", user.id);

        if (cleanupError) {
          console.error("Camp application cleanup failed after preference error", {
            opportunityId,
            athleteId: user.id,
            createdInterestId,
            error: cleanupError,
          });
        }
      }

      return {
        ok: false,
        message: `Could not save your preferences. Backend error: ${debugSupabaseMessage(preferenceError) || "Unknown error."}`,
      };
    }
  }

  if (!hadExistingInterest && currentInterest && validatedCampTunnelTime?.ok) {
    const { error: tunnelTimeError } = await supabase
      .from("opportunity_interests")
      .update(campTunnelTimeFields)
      .eq("id", currentInterest.id)
      .eq("athlete_id", user.id);

    if (tunnelTimeError) {
      console.error("Camp tunnel time save failed", tunnelTimeError);
      if (createdInterestId) {
        const { error: cleanupError } = await supabase
          .from("opportunity_interests")
          .delete()
          .eq("id", createdInterestId)
          .eq("athlete_id", user.id);

        if (cleanupError) {
          console.error("Camp application cleanup failed after tunnel time error", {
            opportunityId,
            athleteId: user.id,
            createdInterestId,
            error: cleanupError,
          });
        }
      }

      return {
        ok: false,
        message: `Could not save your tunnel time information. Backend error: ${debugSupabaseMessage(tunnelTimeError) || "Unknown error."}`,
      };
    }
  }

  if (hadExistingInterest && currentInterest) {
    return {
      ok: true,
      message: `You already applied. Current status: ${formatInterestStatus(currentInterest.status)}.`,
      status: currentInterest.status as InterestStatus,
    };
  }

  const adminSupabase = createSupabaseAdminClient();
  const shouldPush =
    adminSupabase &&
    !(await hasUnreadNotification(adminSupabase, {
      userId: opportunity.created_by,
      type: "new_interest",
      opportunityId,
    }));

  if (!currentInterest) {
    const { data: createdInterest, error } = await supabase
      .from("opportunity_interests")
      .insert({
        opportunity_id: opportunityId,
        athlete_id: user.id,
        status: "pending",
        ...campTunnelTimeFields,
      })
      .select("id,status")
      .maybeSingle();

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
      return {
        ok: false,
        message: `Could not send interest. Backend error: ${debugSupabaseMessage(error) || "Unknown error."}`,
      };
    }

    currentInterest = createdInterest ?? null;
    createdInterestId = createdInterest?.id ?? createdInterestId;
  }

  if (shouldPush) {
    scheduleServerPush([opportunity.created_by], "new_interest", {
      opportunityId,
      types: ["new_interest"],
    });
  }

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
    { error: opportunityLookupError },
    { error: interestRecipientError },
    { error: bookingRecipientError },
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

  const { data: opportunity, error: opportunityError } = await supabase
    .from("opportunities")
    .select("type")
    .eq("id", opportunityId)
    .maybeSingle();

  if (opportunityError) {
    console.error("Slot booking opportunity lookup failed", opportunityError);
    return { ok: false, message: "Could not book slots. Please try again." };
  }

  const supportsTunnelTimeMode = await supportsCampTunnelTimeModeColumn(supabase);
  const tunnelTimeMode = supportsTunnelTimeMode
    ? await getOpportunityTunnelTimeMode(supabase, opportunityId)
    : "athletes_may_use_own_tunnel_time";

  const tunnelTimeResult =
    opportunity?.type === "camp" &&
    tunnelTimeMode !== "tunnel_time_must_be_purchased_through_coach"
      ? await saveTunnelTimeStatus(supabase, opportunityId, user.id, tunnelTime)
      : { ok: true as const, message: "" };

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

  const { data: interest } = await supabase
    .from("opportunity_interests")
    .select("self_booking_enabled")
    .eq("opportunity_id", opportunityId)
    .eq("athlete_id", user.id)
    .maybeSingle();

  if (interest?.self_booking_enabled === true) {
    const finalizedAt = new Date().toISOString();
    const finalizationClient = createSupabaseAdminClient() ?? supabase;
    const { error: finalizeError } = await finalizationClient
      .from("opportunity_slot_bookings")
      .update({
        is_final: true,
        finalized_at: finalizedAt,
      })
      .eq("opportunity_id", opportunityId)
      .eq("user_id", user.id)
      .in("slot_id", uniqueSlotIds)
      .eq("is_final", false);

    if (finalizeError) {
      console.error("Self-booking finalization failed", {
        opportunityId,
        userId: user.id,
        slotIds: uniqueSlotIds,
        code: finalizeError.code,
        message: finalizeError.message,
        details: finalizeError.details,
        hint: finalizeError.hint,
      });
    } else {
      const athleteNotificationSupabase = createSupabaseAdminClient();
      if (athleteNotificationSupabase) {
        const shouldPushTimetableUpdate = !(await hasUnreadNotification(
          athleteNotificationSupabase,
          {
            userId: user.id,
            type: "timetable_updated",
            opportunityId,
          },
        ));

        const { error: notificationError } = await athleteNotificationSupabase
          .from("notifications")
          .insert({
            user_id: user.id,
            title: "Timetable updated",
            body: "Your selected flight time has been added.",
            type: "timetable_updated",
            opportunity_id: opportunityId,
          });

        if (notificationError) {
          console.error("Self-booking notification failed", {
            opportunityId,
            userId: user.id,
            slotIds: uniqueSlotIds,
            error: notificationError,
          });
        } else if (shouldPushTimetableUpdate) {
          schedulePendingPushNotificationsForUsers(
            [user.id],
            {
              opportunityId,
              types: ["timetable_updated"],
            },
            "timetable_updated",
          );
        }
      }
    }
  }

  revalidatePath(`/app/opportunities/${opportunityId}`);
  revalidatePath(`/app/opportunities/${opportunityId}/times`);
  revalidatePath(`/app/organizer/opportunities/${opportunityId}`);
  revalidatePath("/app/applications");
  revalidatePath("/app/dashboard");

  const successMessage =
    interest?.self_booking_enabled === true
      ? uniqueSlotIds.length === 1
        ? "Your selected flight time has been added."
        : "Your selected flight times have been added."
      : "Your slots were saved as draft.";

  return { ok: true, message: successMessage };
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

  const { data: opportunity, error: opportunityError } = await supabase
    .from("opportunities")
    .select("type")
    .eq("id", opportunityId)
    .maybeSingle();

  if (opportunityError) {
    console.error("Tunnel time status opportunity lookup failed", opportunityError);
    return { ok: false, message: "Could not save tunnel time status." };
  }

  const supportsTunnelTimeMode = await supportsCampTunnelTimeModeColumn(supabase);
  const tunnelTimeMode = supportsTunnelTimeMode
    ? await getOpportunityTunnelTimeMode(supabase, opportunityId)
    : "athletes_may_use_own_tunnel_time";

  if (
    opportunity?.type === "camp" &&
    tunnelTimeMode === "tunnel_time_must_be_purchased_through_coach"
  ) {
    return {
      ok: true,
      message: "Tunnel time is not required for this camp.",
    };
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

  const [interestResult, bookingResult] = await Promise.all([
    supabase
      .from("opportunity_interests")
      .select("self_booking_enabled")
      .eq("opportunity_id", opportunityId)
      .eq("athlete_id", user.id)
      .maybeSingle(),
    supabase
      .from("opportunity_slot_bookings")
      .select("id,is_final,release_requested_at")
      .eq("opportunity_id", opportunityId)
      .eq("slot_id", slotId)
      .eq("user_id", user.id)
      .maybeSingle(),
  ]);
  const interest = interestResult.data;
  const booking = bookingResult.data;
  const bookingError = bookingResult.error;

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

  if (booking.release_requested_at) {
    return { ok: true, message: "Release request submitted." };
  }

  if (booking.is_final || interest?.self_booking_enabled === true) {
    const requestResult =
      interest?.self_booking_enabled === true
        ? await supabase.rpc("request_own_opportunity_slot_releases", {
            target_opportunity_id: opportunityId,
            target_slot_ids: [slotId],
          })
        : await supabase
            .from("opportunity_slot_bookings")
            .update({
              release_requested_at: new Date().toISOString(),
              release_requested_by: user.id,
            })
            .eq("id", booking.id)
            .eq("user_id", user.id)
            .is("release_requested_at", null)
            .select("id")
            .maybeSingle();

    if (requestResult.error) {
      console.error("Own slot release request failed", {
        opportunityId,
        slotId,
        userId: user.id,
        code: requestResult.error.code,
        message: requestResult.error.message,
        details: requestResult.error.details,
        hint: requestResult.error.hint,
      });
      return {
        ok: false,
        message: requestResult.error.message || "Could not send release request.",
      };
    }

    revalidatePath(`/app/opportunities/${opportunityId}`);
    revalidatePath(`/app/opportunities/${opportunityId}/times`);
    revalidatePath(`/app/organizer/opportunities/${opportunityId}`);
    revalidatePath("/app/dashboard");
    revalidatePath("/app/coach-dashboard");
    revalidatePath("/app/applications");

    return { ok: true, message: "Release request submitted." };
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

export async function requestOwnOpportunitySlotReleases(
  opportunityId: string,
  slotIds: string[],
): Promise<ActionResult> {
  const uniqueSlotIds = [...new Set(slotIds)].filter(Boolean);

  if (uniqueSlotIds.length === 0) {
    return { ok: false, message: "Choose at least one slot to release." };
  }

  if (uniqueSlotIds.length > 100) {
    return { ok: false, message: "Choose no more than 100 slots at once." };
  }

  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.rpc("request_own_opportunity_slot_releases", {
    target_opportunity_id: opportunityId,
    target_slot_ids: uniqueSlotIds,
  });

  if (error) {
    console.error("Own slot release batch failed", {
      opportunityId,
      slotCount: uniqueSlotIds.length,
      code: error.code,
      message: error.message,
      details: error.details,
      hint: error.hint,
    });
    return {
      ok: false,
      message: error.message || "Could not send release request.",
    };
  }

  revalidatePath(`/app/opportunities/${opportunityId}`);
  revalidatePath(`/app/opportunities/${opportunityId}/times`);
  revalidatePath(`/app/organizer/opportunities/${opportunityId}`);
  revalidatePath("/app/dashboard");
  revalidatePath("/app/coach-dashboard");
  revalidatePath("/app/applications");

  return { ok: true, message: "Release request submitted." };
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

async function getOpportunityTunnelTimeMode(
  supabase: Awaited<ReturnType<typeof createSupabaseServerClient>>,
  opportunityId: string,
) {
  const { data, error } = await supabase
    .from("opportunities")
    .select("tunnel_time_mode")
    .eq("id", opportunityId)
    .maybeSingle();

  if (error) {
    return "athletes_may_use_own_tunnel_time";
  }

  return normalizeCampTunnelTimeMode(
    (data as { tunnel_time_mode?: string | null } | null)?.tunnel_time_mode ?? null,
  );
}

function validateCampTunnelTimeInput(
  tunnelTime: CampTunnelTimeInput | undefined,
): ValidatedCampTunnelTime | { ok: false; message: string } {
  if (
    !tunnelTime ||
    (tunnelTime.status !== "owns_tunnel_time" &&
      tunnelTime.status !== "needs_tunnel_time")
  ) {
    return { ok: false, message: "Choose whether you already have tunnel time." };
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

  return {
    ok: true,
    status: tunnelTime.status,
    accountEmail:
      tunnelTime.status === "owns_tunnel_time" ? tunnelAccountEmail : null,
  };
}

function isEmailInput(value: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}
