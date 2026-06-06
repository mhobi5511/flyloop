export const participantActivityNotificationTypes = [
  "application_status",
  "timetable_published",
  "timetable_booking_reminder",
  "timetable_booking_changed",
  "slot_bookings_released",
  "slot_bookings_released_by_organizer",
  "slot_booking_released_by_organizer",
  "slot_booking_assigned_by_organizer",
  "participant_removed_from_camp",
  "participant_removal_kept",
] as const;

export const organizerActivityNotificationTypes = [
  "new_interest",
  "new_time_booking",
  "timetable_reminder_interest",
  "participant_removal_requested",
] as const;

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
