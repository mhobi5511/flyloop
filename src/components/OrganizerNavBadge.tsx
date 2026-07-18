"use client";

import { NotificationCountBadge } from "./NotificationCountBadge";
import { useNotificationCenter } from "./NotificationCenter";

export function OrganizerNavBadge({
  kind,
}: {
  kind: "organizer" | "participant";
}) {
  const { organizerUnreadCount, participantUnreadCount } =
    useNotificationCenter();
  const count =
    kind === "organizer" ? organizerUnreadCount : participantUnreadCount;

  if (count === 0) {
    return null;
  }

  return (
    <NotificationCountBadge
      count={count}
      className="min-w-4 px-1 text-[0.62rem] leading-4"
    />
  );
}
