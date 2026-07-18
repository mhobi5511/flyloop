export type NotificationCenterItem = {
  id: string;
  title: string;
  body: string;
  type: string;
  opportunity_id: string | null;
  read: boolean;
  created_at: string;
};

export type NotificationSnapshot = {
  notifications: NotificationCenterItem[];
  bellUnreadCount: number;
  organizerUnreadCount: number;
  participantUnreadCount: number;
};

export const emptyNotificationSnapshot: NotificationSnapshot = {
  notifications: [],
  bellUnreadCount: 0,
  organizerUnreadCount: 0,
  participantUnreadCount: 0,
};

export function parseNotificationSnapshot(value: unknown): NotificationSnapshot {
  if (!isRecord(value)) {
    return emptyNotificationSnapshot;
  }

  const notifications = Array.isArray(value.notifications)
    ? value.notifications.flatMap((item) => {
        const notification = toNotificationCenterItem(item);
        return notification ? [notification] : [];
      })
    : [];

  return {
    notifications,
    bellUnreadCount: toCount(value.bell_unread_count),
    organizerUnreadCount: toCount(value.organizer_unread_count),
    participantUnreadCount: toCount(value.participant_unread_count),
  };
}

export function toNotificationCenterItem(
  value: unknown,
): NotificationCenterItem | null {
  if (
    !isRecord(value) ||
    typeof value.id !== "string" ||
    typeof value.type !== "string" ||
    typeof value.created_at !== "string"
  ) {
    return null;
  }

  return {
    id: value.id,
    title: typeof value.title === "string" ? value.title : "Notification",
    body: typeof value.body === "string" ? value.body : "",
    type: value.type,
    opportunity_id:
      typeof value.opportunity_id === "string" ? value.opportunity_id : null,
    read: value.read === true,
    created_at: value.created_at,
  };
}

function toCount(value: unknown) {
  return typeof value === "number" && Number.isFinite(value)
    ? Math.max(0, value)
    : 0;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}
