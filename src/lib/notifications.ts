export const participantActivityNotificationTypes = [
  "application_status",
  "timetable_published",
  "timetable_booking_reminder",
  "timetable_booking_changed",
  "slot_bookings_released",
  "slot_bookings_released_by_organizer",
  "slot_booking_released_by_organizer",
  "participant_removed_from_camp",
  "participant_removal_kept",
] as const;

export const organizerActivityNotificationTypes = [
  "new_interest",
  "new_time_booking",
  "timetable_reminder_interest",
  "participant_removal_requested",
] as const;

export function countUnreadByOpportunity(
  notifications: Array<{ opportunity_id: string | null }>,
) {
  const counts = new Map<string, number>();

  for (const notification of notifications) {
    if (!notification.opportunity_id) {
      continue;
    }

    counts.set(
      notification.opportunity_id,
      (counts.get(notification.opportunity_id) ?? 0) + 1,
    );
  }

  return counts;
}
