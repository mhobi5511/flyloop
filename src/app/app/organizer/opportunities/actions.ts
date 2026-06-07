"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import {
  sendPendingPushNotificationsForOpportunity,
  sendPendingPushNotificationsForUsers,
} from "@/lib/push";
import type { InterestStatus } from "@/lib/types";

const editableStatuses: InterestStatus[] = ["accepted", "declined", "waitlist"];

type ActionResult =
  | { ok: true; message: string }
  | { ok: false; message: string };

type ExistingTimetableSlotWithBookings = {
  id: string;
  slot_date: string;
  start_time: string;
  duration_minutes: number;
  capacity: number;
  is_published: boolean;
  published_at: string | null;
  opportunity_slot_bookings:
    | Array<{ user_id: string }>
    | { user_id: string }
    | null;
};

async function sendServerPush(
  userIds: string[],
  context: string,
  filter?: { opportunityId?: string; types?: string[] },
) {
  const result = await sendPendingPushNotificationsForUsers(userIds, filter);
  console.log("Server push trigger completed", { context, result, userIds, filter });
}

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
    .update({ status, removal_requested_at: null })
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

  await sendServerPush([interest.athlete_id], "application_status", {
    opportunityId: interest.opportunity_id,
    types: ["application_status", "slot_bookings_released"],
  });

  revalidatePath(`/app/organizer/opportunities/${updatedInterest.opportunity_id}`);
  revalidatePath(`/app/opportunities/${updatedInterest.opportunity_id}`);
  revalidatePath(`/app/opportunities/${updatedInterest.opportunity_id}/times`);
  revalidatePath("/app/dashboard");
  revalidatePath("/app/coach-dashboard");
  revalidatePath("/app/applications");

  return { ok: true, message: "Applicant status updated." };
}

export async function approveCampRemovalRequest(
  interestId: string,
): Promise<ActionResult> {
  const result = await resolveCampRemovalRequest(interestId, "approve");
  return result;
}

export async function keepCampParticipant(
  interestId: string,
): Promise<ActionResult> {
  const result = await resolveCampRemovalRequest(interestId, "keep");
  return result;
}

async function resolveCampRemovalRequest(
  interestId: string,
  decision: "approve" | "keep",
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
    .select("id,opportunity_id,status,athlete_id,removal_requested_at,opportunities(id,title,type,created_by)")
    .eq("id", interestId)
    .maybeSingle();

  if (lookupError) {
    console.error("Camp removal request lookup failed", {
      interestId,
      decision,
      code: lookupError.code,
      message: lookupError.message,
      details: lookupError.details,
      hint: lookupError.hint,
    });
    return { ok: false, message: "Could not update removal request." };
  }

  const opportunity = Array.isArray(interest?.opportunities)
    ? interest?.opportunities[0]
    : interest?.opportunities;

  if (!interest || !opportunity || opportunity.created_by !== user.id) {
    return { ok: false, message: "Removal request not found." };
  }

  if (opportunity.type !== "camp") {
    return { ok: false, message: "Removal requests are only available for Camps." };
  }

  if (interest.status !== "accepted" || !interest.removal_requested_at) {
    return { ok: false, message: "There is no active removal request." };
  }

  let updatedInterest:
    | { id: string; status: InterestStatus; opportunity_id: string }
    | null = null;
  let error:
    | {
        code?: string;
        message?: string;
        details?: string | null;
        hint?: string | null;
      }
    | null = null;

  if (decision === "approve") {
    const adminSupabase = createSupabaseAdminClient();

    if (!adminSupabase) {
      console.error("Camp removal request failed: missing admin Supabase client");
      return { ok: false, message: "Could not update removal request." };
    }

    const { error: bookingDeleteError } = await adminSupabase
      .from("opportunity_slot_bookings")
      .delete()
      .eq("opportunity_id", interest.opportunity_id)
      .eq("user_id", interest.athlete_id);

    if (bookingDeleteError) {
      console.error("Camp removal booking cleanup failed", {
        interestId,
        opportunityId: interest.opportunity_id,
        error: bookingDeleteError,
      });
      return { ok: false, message: "Could not update removal request." };
    }

    const deleteResult = await adminSupabase
      .from("opportunity_interests")
      .delete()
      .eq("id", interest.id)
      .eq("status", "accepted")
      .not("removal_requested_at", "is", null)
      .select("id,status,opportunity_id")
      .maybeSingle();

    updatedInterest = deleteResult.data;
    error = deleteResult.error;
  } else {
    const updateResult = await supabase
      .from("opportunity_interests")
      .update({ removal_requested_at: null })
      .eq("id", interest.id)
      .eq("status", "accepted")
      .not("removal_requested_at", "is", null)
      .select("id,status,opportunity_id")
      .maybeSingle();

    updatedInterest = updateResult.data;
    error = updateResult.error;
  }

  if (error) {
    console.error("Camp removal request resolution failed", {
      interestId,
      opportunityId: interest.opportunity_id,
      decision,
      code: error.code,
      message: error.message,
      details: error.details,
      hint: error.hint,
    });
    return { ok: false, message: "Could not update removal request." };
  }

  if (!updatedInterest) {
    return { ok: false, message: "There is no active removal request." };
  }

  const notification =
    decision === "approve"
      ? {
          title: "You were removed from the Camp",
          body: `Your spot in ${opportunity.title} was released by the organizer.`,
          type: "participant_removed_from_camp",
        }
      : {
          title: "You're still in",
          body: `The organizer kept your spot in ${opportunity.title}.`,
          type: "participant_removal_kept",
        };

  const adminSupabase = createSupabaseAdminClient();
  const { error: notificationError } = adminSupabase
    ? await adminSupabase.from("notifications").insert({
        user_id: interest.athlete_id,
        title: notification.title,
        body: notification.body,
        type: notification.type,
        opportunity_id: opportunity.id,
      })
    : {
        error: {
          message: "Missing admin Supabase client",
        },
      };

  if (notificationError) {
    console.error("Camp removal participant notification failed", {
      interestId,
      decision,
      error: notificationError,
    });
  } else {
    await sendServerPush([interest.athlete_id], notification.type, {
      opportunityId: opportunity.id,
      types: [notification.type],
    });
  }

  revalidatePath(`/app/organizer/opportunities/${opportunity.id}`);
  revalidatePath(`/app/opportunities/${opportunity.id}`);
  revalidatePath(`/app/opportunities/${opportunity.id}/times`);
  revalidatePath("/app/dashboard");
  revalidatePath("/app/coach-dashboard");
  revalidatePath("/app/applications");

  return {
    ok: true,
    message:
      decision === "approve"
        ? "Participant removed and booked times released."
        : "Participant kept in the Camp.",
  };
}

export type TimetableSlotInput = {
  id?: string;
  slotDate: string;
  startTime: string;
  durationMinutes: number;
  capacity: number;
};

export async function saveCampTimetable(
  opportunityId: string,
  slots: TimetableSlotInput[],
  publish: boolean,
): Promise<ActionResult> {
  const normalizedSlots = normalizeTimetableSlots(slots);

  if (publish && normalizedSlots.length === 0) {
    return { ok: false, message: "Add at least one slot before publishing." };
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
    .select("id,created_by,title,type")
    .eq("id", opportunityId)
    .maybeSingle();

  if (opportunityError) {
    console.error("Timetable opportunity lookup failed", opportunityError);
    return { ok: false, message: "Could not save timetable. Please try again." };
  }

  if (!opportunity || opportunity.created_by !== user.id) {
    return { ok: false, message: "Opportunity not found." };
  }

  if (opportunity.type === "huck_jam") {
    return { ok: false, message: "Huck Jams do not use timetables." };
  }

  const { data: existingSlots, error: existingError } = await supabase
    .from("opportunity_time_slots")
    .select("id,slot_date,start_time,duration_minutes,capacity,is_published,published_at,opportunity_slot_bookings(user_id)")
    .eq("opportunity_id", opportunityId);

  if (existingError) {
    console.error("Timetable slot lookup failed", existingError);
    return { ok: false, message: "Could not save timetable. Please try again." };
  }

  const existingSlotRows = (existingSlots ??
    []) as ExistingTimetableSlotWithBookings[];
  const existingIds = new Set(existingSlotRows.map((slot) => slot.id));
  const affectedParticipantIds = getAffectedTimetableParticipantIds(
    existingSlotRows,
    normalizedSlots,
  );
  const hasPublishedSlots = existingSlotRows.some((slot) => slot.is_published);
  const shouldNotifyInitialPublish =
    publish && !hasPublishedSlots && normalizedSlots.length > 0;
  const submittedIds = new Set(
    normalizedSlots
      .map((slot) => slot.id)
      .filter((slotId): slotId is string => Boolean(slotId)),
  );
  const idsToDelete = [...existingIds].filter((slotId) => !submittedIds.has(slotId));
  const timestamp = new Date().toISOString();

  if (idsToDelete.length > 0) {
    const { error } = await supabase
      .from("opportunity_time_slots")
      .delete()
      .eq("opportunity_id", opportunityId)
      .in("id", idsToDelete);

    if (error) {
      console.error("Timetable slot delete failed", error);
      return { ok: false, message: "Could not delete removed slots." };
    }
  }

  for (const slot of normalizedSlots) {
    const existingSlot = slot.id
      ? existingSlotRows.find((existing) => existing.id === slot.id)
      : null;
    const keepPublished = publish || existingSlot?.is_published === true;
    const payload = {
      opportunity_id: opportunityId,
      slot_date: slot.slotDate,
      start_time: slot.startTime,
      duration_minutes: slot.durationMinutes,
      capacity: slot.capacity,
      is_published: keepPublished,
      published_at: publish
        ? timestamp
        : keepPublished
          ? existingSlot?.published_at ?? timestamp
          : null,
    };

    if (slot.id && existingIds.has(slot.id)) {
      const { error } = await supabase
        .from("opportunity_time_slots")
        .update(payload)
        .eq("id", slot.id)
        .eq("opportunity_id", opportunityId);

      if (error) {
        console.error("Timetable slot update failed", { slotId: slot.id, error });
        return { ok: false, message: "Could not update timetable slots." };
      }
    } else {
      const { error } = await supabase.from("opportunity_time_slots").insert(payload);

      if (error) {
        console.error("Timetable slot insert failed", error);
        return { ok: false, message: "Could not add timetable slots." };
      }
    }
  }

  if (affectedParticipantIds.size > 0) {
    const { error: affectedNotificationError } = await supabase.rpc(
      "notify_timetable_bookings_changed",
      {
        target_opportunity_id: opportunityId,
        affected_user_ids: [...affectedParticipantIds],
      },
    );

    if (affectedNotificationError) {
      console.error(
        "Affected timetable notification RPC failed",
        affectedNotificationError,
      );
      return { ok: false, message: "Timetable saved, but notifications failed." };
    }

    await sendServerPush([...affectedParticipantIds], "timetable_booking_changed", {
      opportunityId,
      types: ["timetable_booking_changed"],
    });
  }

  if (publish) {
    if (shouldNotifyInitialPublish) {
      const { error: notificationError } = await supabase.rpc(
        "notify_timetable_published",
        { target_opportunity_id: opportunityId },
      );

      if (notificationError) {
        console.error("Timetable notification RPC failed", notificationError);
        return { ok: false, message: "Timetable saved, but notifications failed." };
      }

      const pushResult = await sendPendingPushNotificationsForOpportunity(
        opportunityId,
        ["timetable_published"],
      );
      console.log("Server push trigger completed", {
        context: "timetable_published",
        result: pushResult,
        opportunityId,
      });
    }
  }

  revalidatePath(`/app/organizer/opportunities/${opportunityId}`);
  revalidatePath(`/app/organizer/opportunities/${opportunityId}/timetable`);
  revalidatePath(`/app/opportunities/${opportunityId}`);
  revalidatePath("/app/dashboard");
  revalidatePath("/app/coach-dashboard");

  if (publish) {
    redirect(`/app/organizer/opportunities/${opportunityId}`);
  }

  return { ok: true, message: "Timetable draft saved." };
}

export async function sendTimetableBookingReminder(
  opportunityId: string,
  participantId: string,
): Promise<ActionResult> {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError || !user) {
    return { ok: false, message: "Please log in again." };
  }

  const { data: insertedCount, error } = await supabase.rpc(
    "notify_timetable_booking_reminder",
    {
      target_opportunity_id: opportunityId,
      target_user_id: participantId,
    },
  );

  if (error) {
    console.error("Timetable reminder failed", {
      opportunityId,
      participantId,
      organizerId: user.id,
      code: error.code,
      message: error.message,
      details: error.details,
      hint: error.hint,
    });
    return { ok: false, message: "Could not send reminder." };
  }

  if (Number(insertedCount) > 0) {
    await sendServerPush([participantId], "timetable_booking_reminder", {
      opportunityId,
      types: ["timetable_booking_reminder"],
    });
  }

  revalidatePath(`/app/organizer/opportunities/${opportunityId}`);

  return { ok: true, message: "Reminder sent." };
}

export async function sendCoachDashboardSlotReminder(
  opportunityId: string,
  participantId: string,
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
    .select("id,title,booking_mode,created_by")
    .eq("id", opportunityId)
    .maybeSingle();

  if (opportunityError) {
    console.error("Coach dashboard reminder opportunity lookup failed", {
      opportunityId,
      participantId,
      organizerId: user.id,
      error: opportunityError,
    });
    return { ok: false, message: "Could not send reminder." };
  }

  if (!opportunity || opportunity.created_by !== user.id) {
    return { ok: false, message: "Opportunity not found." };
  }

  const { data: participantInterest, error: participantError } = await supabase
    .from("opportunity_interests")
    .select("id")
    .eq("opportunity_id", opportunityId)
    .eq("athlete_id", participantId)
    .eq("status", "accepted")
    .maybeSingle();

  if (participantError) {
    console.error("Coach dashboard reminder participant lookup failed", {
      opportunityId,
      participantId,
      organizerId: user.id,
      error: participantError,
    });
    return { ok: false, message: "Could not send reminder." };
  }

  if (!participantInterest) {
    return { ok: false, message: "Only accepted participants can be reminded." };
  }

  const { data: existingBooking, error: bookingError } = await supabase
    .from("opportunity_slot_bookings")
    .select("id")
    .eq("opportunity_id", opportunityId)
    .eq("user_id", participantId)
    .limit(1)
    .maybeSingle();

  if (bookingError) {
    console.error("Coach dashboard reminder booking lookup failed", {
      opportunityId,
      participantId,
      organizerId: user.id,
      error: bookingError,
    });
    return { ok: false, message: "Could not send reminder." };
  }

  if (existingBooking) {
    return { ok: false, message: "This participant already has flying times." };
  }

  const { data: coachProfile } = await supabase
    .from("profiles")
    .select("full_name")
    .eq("id", user.id)
    .maybeSingle();
  const coachName = coachProfile?.full_name?.trim() || "Your coach";
  const title = "Choose your flying times";
  const body =
    opportunity.booking_mode === "direct_time_booking"
      ? `${coachName} reminded you to select your flying times for ${opportunity.title}.`
      : `${coachName} reminded you that your flying times still need to be assigned for ${opportunity.title}.`;
  const adminSupabase = createSupabaseAdminClient();

  if (!adminSupabase) {
    console.error("Coach dashboard reminder failed: missing admin Supabase client", {
      opportunityId,
      participantId,
      organizerId: user.id,
    });
    return { ok: false, message: "Could not send reminder." };
  }

  const { data: existingNotification, error: existingNotificationError } =
    await adminSupabase
      .from("notifications")
      .select("id")
      .eq("user_id", participantId)
      .eq("opportunity_id", opportunityId)
      .eq("type", "timetable_booking_reminder")
      .maybeSingle();

  if (existingNotificationError) {
    console.error("Coach dashboard reminder notification lookup failed", {
      opportunityId,
      participantId,
      organizerId: user.id,
      error: existingNotificationError,
    });
    return { ok: false, message: "Could not send reminder." };
  }

  const notificationPayload = {
    user_id: participantId,
    title,
    body,
    type: "timetable_booking_reminder",
    opportunity_id: opportunityId,
    read: false,
    push_sent_at: null,
  };

  const notificationResult = existingNotification
    ? await adminSupabase
        .from("notifications")
        .update({ ...notificationPayload, created_at: new Date().toISOString() })
        .eq("id", existingNotification.id)
    : await adminSupabase.from("notifications").insert(notificationPayload);

  if (notificationResult.error) {
    console.error("Coach dashboard reminder notification write failed", {
      opportunityId,
      participantId,
      organizerId: user.id,
      error: notificationResult.error,
    });
    return { ok: false, message: "Could not send reminder." };
  }

  await sendServerPush([participantId], "timetable_booking_reminder", {
    opportunityId,
    types: ["timetable_booking_reminder"],
  });

  revalidatePath(`/app/organizer/opportunities/${opportunityId}`);
  revalidatePath("/app/coach-dashboard");

  return { ok: true, message: "Reminder sent." };
}

export async function sendTimetableBookingReminderForm(
  opportunityId: string,
  participantId: string,
): Promise<void> {
  await sendTimetableBookingReminder(opportunityId, participantId);
}

export async function releaseParticipantTimes(
  opportunityId: string,
  participantId: string,
): Promise<ActionResult> {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError || !user) {
    return { ok: false, message: "Please log in again." };
  }

  const { data: releasedCount, error } = await supabase.rpc(
    "release_participant_slot_bookings",
    {
      target_opportunity_id: opportunityId,
      target_user_id: participantId,
    },
  );

  if (error) {
    console.error("Participant timetable release failed", {
      opportunityId,
      participantId,
      organizerId: user.id,
      code: error.code,
      message: error.message,
      details: error.details,
      hint: error.hint,
    });
    return { ok: false, message: "Could not release times." };
  }

  await sendServerPush([participantId], "slot_bookings_released_by_organizer", {
    opportunityId,
    types: ["slot_bookings_released_by_organizer"],
  });

  revalidatePath(`/app/organizer/opportunities/${opportunityId}`);
  revalidatePath(`/app/opportunities/${opportunityId}`);
  revalidatePath(`/app/opportunities/${opportunityId}/times`);
  revalidatePath("/app/dashboard");
  revalidatePath("/app/coach-dashboard");
  revalidatePath("/app/applications");

  return {
    ok: true,
    message:
      Number(releasedCount) > 0
        ? "Booked times released."
      : "No booked times to release.",
  };
}

export async function releaseParticipantTimesForm(
  opportunityId: string,
  participantId: string,
): Promise<void> {
  await releaseParticipantTimes(opportunityId, participantId);
}

export async function releaseParticipantSlotBooking(
  opportunityId: string,
  bookingId: string,
): Promise<ActionResult> {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError || !user) {
    return { ok: false, message: "Please log in again." };
  }

  const { data: booking } = await supabase
    .from("opportunity_slot_bookings")
    .select("user_id")
    .eq("id", bookingId)
    .maybeSingle();

  const { data: releasedCount, error } = await supabase.rpc(
    "release_opportunity_slot_booking",
    {
      target_opportunity_id: opportunityId,
      target_booking_id: bookingId,
    },
  );

  if (error) {
    console.error("Participant timetable slot release failed", {
      opportunityId,
      bookingId,
      organizerId: user.id,
      code: error.code,
      message: error.message,
      details: error.details,
      hint: error.hint,
    });
    return { ok: false, message: "Could not release slot." };
  }

  if (booking?.user_id) {
    await sendServerPush([booking.user_id], "slot_booking_released_by_organizer", {
      opportunityId,
      types: ["slot_booking_released_by_organizer"],
    });
  }

  revalidatePath(`/app/organizer/opportunities/${opportunityId}`);
  revalidatePath(`/app/opportunities/${opportunityId}`);
  revalidatePath(`/app/opportunities/${opportunityId}/times`);
  revalidatePath("/app/dashboard");
  revalidatePath("/app/coach-dashboard");
  revalidatePath("/app/applications");

  return {
    ok: true,
    message:
      Number(releasedCount) > 0
        ? "Slot released."
        : "No booked slot to release.",
  };
}

export async function assignParticipantSlotBooking(
  opportunityId: string,
  slotId: string,
  participantId: string,
): Promise<ActionResult> {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError || !user) {
    return { ok: false, message: "Please log in again." };
  }

  if (!slotId || !participantId) {
    return { ok: false, message: "Choose a participant and slot." };
  }

  const { data: slot, error: slotLookupError } = await supabase
    .from("opportunity_time_slots")
    .select("id,opportunity_id,is_published,opportunities(created_by)")
    .eq("id", slotId)
    .eq("opportunity_id", opportunityId)
    .maybeSingle();

  if (slotLookupError) {
    console.error("Coach slot lookup failed", {
      opportunityId,
      slotId,
      participantId,
      organizerId: user.id,
      code: slotLookupError.code,
      message: slotLookupError.message,
      details: slotLookupError.details,
      hint: slotLookupError.hint,
    });
    return { ok: false, message: "Could not assign slot." };
  }

  const slotOpportunity = Array.isArray(slot?.opportunities)
    ? slot?.opportunities[0]
    : slot?.opportunities;

  if (!slot || slotOpportunity?.created_by !== user.id) {
    return { ok: false, message: "Slot is no longer available" };
  }

  if (!slot.is_published) {
    const { error: publishSlotError } = await supabase
      .from("opportunity_time_slots")
      .update({
        is_published: true,
        published_at: new Date().toISOString(),
      })
      .eq("id", slotId)
      .eq("opportunity_id", opportunityId);

    if (publishSlotError) {
      console.error("Coach slot publish before assignment failed", {
        opportunityId,
        slotId,
        participantId,
        organizerId: user.id,
        code: publishSlotError.code,
        message: publishSlotError.message,
        details: publishSlotError.details,
        hint: publishSlotError.hint,
      });
      return { ok: false, message: "Could not assign slot." };
    }
  }

  const { error } = await supabase.rpc("assign_opportunity_slot_booking", {
    target_opportunity_id: opportunityId,
    target_slot_id: slotId,
    target_user_id: participantId,
  });

  if (error) {
    console.error("Coach slot assignment failed", {
      opportunityId,
      slotId,
      participantId,
      organizerId: user.id,
      code: error.code,
      message: error.message,
      details: error.details,
      hint: error.hint,
    });

    return {
      ok: false,
      message: error.message || "Could not assign slot.",
    };
  }

  await sendServerPush([participantId], "slot_booking_assigned_by_organizer", {
    opportunityId,
    types: ["slot_booking_assigned_by_organizer"],
  });

  revalidatePath(`/app/organizer/opportunities/${opportunityId}`);
  revalidatePath(`/app/opportunities/${opportunityId}`);
  revalidatePath(`/app/opportunities/${opportunityId}/times`);
  revalidatePath("/app/dashboard");
  revalidatePath("/app/coach-dashboard");
  revalidatePath("/app/applications");

  return { ok: true, message: "Slot assigned." };
}

function getAffectedTimetableParticipantIds(
  existingSlots: ExistingTimetableSlotWithBookings[],
  normalizedSlots: ReturnType<typeof normalizeTimetableSlots>,
) {
  const affectedParticipantIds = new Set<string>();
  const submittedSlotsById = new Map(
    normalizedSlots
      .filter((slot) => slot.id)
      .map((slot) => [slot.id as string, slot]),
  );

  for (const existingSlot of existingSlots) {
    const bookings = Array.isArray(existingSlot.opportunity_slot_bookings)
      ? existingSlot.opportunity_slot_bookings
      : existingSlot.opportunity_slot_bookings
        ? [existingSlot.opportunity_slot_bookings]
        : [];

    if (bookings.length === 0) {
      continue;
    }

    const submittedSlot = submittedSlotsById.get(existingSlot.id);
    const wasRemoved = !submittedSlot;
    const wasChanged = submittedSlot
      ? existingSlot.slot_date !== submittedSlot.slotDate ||
        normalizeTime(existingSlot.start_time) !== submittedSlot.startTime ||
        existingSlot.duration_minutes !== submittedSlot.durationMinutes
      : false;

    if (!wasRemoved && !wasChanged) {
      continue;
    }

    for (const booking of bookings) {
      affectedParticipantIds.add(booking.user_id);
    }
  }

  return affectedParticipantIds;
}

function normalizeTimetableSlots(slots: TimetableSlotInput[]) {
  const seen = new Set<string>();

  return slots
    .map((slot) => ({
      id: typeof slot.id === "string" && slot.id.length > 0 ? slot.id : undefined,
      slotDate: slot.slotDate,
      startTime: normalizeTime(slot.startTime),
      durationMinutes: Number.isFinite(slot.durationMinutes)
        ? Math.max(1, Math.round(slot.durationMinutes))
        : 15,
      capacity: Number.isFinite(slot.capacity)
        ? Math.max(1, Math.round(slot.capacity))
        : 1,
    }))
    .filter((slot) => isDateInput(slot.slotDate) && isTimeInput(slot.startTime))
    .filter((slot) => {
      const key = `${slot.slotDate}-${slot.startTime}`;
      if (seen.has(key)) {
        return false;
      }
      seen.add(key);
      return true;
    })
    .sort((a, b) =>
      `${a.slotDate} ${a.startTime}`.localeCompare(`${b.slotDate} ${b.startTime}`),
    );
}

function normalizeTime(value: string) {
  const trimmed = value.trim();
  return /^\d{2}:\d{2}:\d{2}$/.test(trimmed) ? trimmed.slice(0, 5) : trimmed;
}

function isDateInput(value: string) {
  return /^\d{4}-\d{2}-\d{2}$/.test(value);
}

function isTimeInput(value: string) {
  return /^\d{2}:\d{2}$/.test(value);
}
