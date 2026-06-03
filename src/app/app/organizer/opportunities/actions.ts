"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase/server";
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
  opportunity_slot_bookings:
    | Array<{ user_id: string }>
    | { user_id: string }
    | null;
};

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
  revalidatePath(`/app/opportunities/${updatedInterest.opportunity_id}`);
  revalidatePath(`/app/opportunities/${updatedInterest.opportunity_id}/times`);
  revalidatePath("/app/dashboard");
  revalidatePath("/app/applications");

  return { ok: true, message: "Applicant status updated." };
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
    .select("id,created_by,title")
    .eq("id", opportunityId)
    .maybeSingle();

  if (opportunityError) {
    console.error("Timetable opportunity lookup failed", opportunityError);
    return { ok: false, message: "Could not save timetable. Please try again." };
  }

  if (!opportunity || opportunity.created_by !== user.id) {
    return { ok: false, message: "Opportunity not found." };
  }

  const { data: existingSlots, error: existingError } = await supabase
    .from("opportunity_time_slots")
    .select("id,slot_date,start_time,duration_minutes,capacity,is_published,opportunity_slot_bookings(user_id)")
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
    const payload = {
      opportunity_id: opportunityId,
      slot_date: slot.slotDate,
      start_time: slot.startTime,
      duration_minutes: slot.durationMinutes,
      capacity: slot.capacity,
      is_published: publish,
      published_at: publish ? timestamp : null,
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
    }
  }

  revalidatePath(`/app/organizer/opportunities/${opportunityId}`);
  revalidatePath(`/app/organizer/opportunities/${opportunityId}/timetable`);
  revalidatePath(`/app/opportunities/${opportunityId}`);
  revalidatePath("/app/dashboard");

  if (publish) {
    redirect(`/app/organizer/opportunities/${opportunityId}`);
  }

  return { ok: true, message: "Timetable draft saved." };
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
