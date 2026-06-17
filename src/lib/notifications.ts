export const coachNotificationTypes = [
  "new_interest",
  "application_withdrawn",
  "participant_removal_requested",
] as const;

export const athleteNotificationTypes = [
  "application_status",
  "timetable_published",
  "self_booking_enabled",
  "timetable_updated",
  "slot_bookings_released",
  "slot_bookings_released_by_organizer",
  "slot_booking_released_by_organizer",
  "slot_booking_assigned_by_organizer",
  "slot_booking_removal_requested",
  "slot_booking_removal_approved",
  "slot_booking_removal_declined",
  "participant_removed_from_camp",
  "participant_removal_kept",
  "new_opportunity",
] as const;

export const bellNotificationTypes = [
  ...coachNotificationTypes,
  ...athleteNotificationTypes,
] as const;

export const activityFeedTypes = [
  "new_interest",
  "application_withdrawn",
  "application_status",
  "timetable_published",
  "timetable_updated",
  "slot_bookings_released",
  "slot_bookings_released_by_organizer",
  "slot_booking_released_by_organizer",
  "slot_booking_assigned_by_organizer",
  "slot_booking_removal_requested",
  "slot_booking_removal_approved",
  "slot_booking_removal_declined",
  "participant_removed_from_camp",
  "participant_removal_kept",
  "participant_removal_requested",
  "new_opportunity",
  "new_time_booking",
  "timetable_reminder_interest",
  "timetable_booking_changed",
  "opportunity_deleted",
] as const;

export const participantActivityNotificationTypes = athleteNotificationTypes;
export const organizerActivityNotificationTypes = coachNotificationTypes;

export function isCoachNotificationType(type: string | null | undefined) {
  return coachNotificationTypes.includes(type as (typeof coachNotificationTypes)[number]);
}

export function isAthleteNotificationType(type: string | null | undefined) {
  return athleteNotificationTypes.includes(type as (typeof athleteNotificationTypes)[number]);
}

export function isBellNotificationType(type: string | null | undefined) {
  return bellNotificationTypes.includes(type as (typeof bellNotificationTypes)[number]);
}

export function isActivityFeedType(type: string | null | undefined) {
  return activityFeedTypes.includes(type as (typeof activityFeedTypes)[number]);
}

type UnreadNotificationForBadge = {
  opportunity_id: string | null;
  type?: string | null;
  body?: string | null;
};

export function countUnreadByOpportunity(
  notifications: UnreadNotificationForBadge[],
) {
  const counts = new Map<string, number>();

  for (const notification of notifications) {
    if (!notification.opportunity_id || isDeclinedApplicationNotification(notification)) {
      continue;
    }

    counts.set(
      notification.opportunity_id,
      (counts.get(notification.opportunity_id) ?? 0) + 1,
    );
  }

  return counts;
}

export function countBadgeNotifications(
  notifications: Array<Pick<UnreadNotificationForBadge, "type" | "body">>,
) {
  return notifications.filter(
    (notification) => !isDeclinedApplicationNotification(notification),
  ).length;
}

export function isDeclinedApplicationNotification({
  type,
  body,
}: Pick<UnreadNotificationForBadge, "type" | "body">) {
  if (type !== "application_status") {
    return false;
  }

  const normalizedBody = body?.toLowerCase() ?? "";

  return (
    normalizedBody.includes("declined") ||
    normalizedBody.includes("wasn''t a spot") ||
    normalizedBody.includes("wasn't a spot") ||
    normalizedBody.includes("leider")
  );
}
