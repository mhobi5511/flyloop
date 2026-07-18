"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import type { RealtimePostgresChangesPayload } from "@supabase/supabase-js";
import {
  countBadgeNotifications,
  isAthleteNotificationType,
  isBellNotificationType,
  isCoachNotificationType,
} from "@/lib/notifications";
import {
  emptyNotificationSnapshot,
  parseNotificationSnapshot,
  toNotificationCenterItem,
  type NotificationCenterItem,
  type NotificationSnapshot,
} from "@/lib/notification-center";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";

export type { NotificationCenterItem } from "@/lib/notification-center";

type NotificationCenterValue = NotificationSnapshot & {
  error: string | null;
  markRead: (notificationId: string) => Promise<void>;
};

const NotificationCenterContext = createContext<NotificationCenterValue | null>(null);

export function NotificationCenterProvider({
  children,
  userId,
  initialNotifications,
  initialBellUnreadCount,
  initialOrganizerUnreadCount,
  initialParticipantUnreadCount,
}: {
  children: ReactNode;
  userId: string | null;
  initialNotifications: NotificationCenterItem[];
  initialBellUnreadCount: number;
  initialOrganizerUnreadCount: number;
  initialParticipantUnreadCount: number;
}) {
  const [snapshot, setSnapshot] = useState<NotificationSnapshot>(() => ({
    notifications: initialNotifications,
    bellUnreadCount: initialBellUnreadCount,
    organizerUnreadCount: initialOrganizerUnreadCount,
    participantUnreadCount: initialParticipantUnreadCount,
  }));
  const [error, setError] = useState<string | null>(null);
  const snapshotRef = useRef(snapshot);
  const refreshInFlightRef = useRef<Promise<void> | null>(null);
  const refreshQueuedRef = useRef(false);
  const optimisticReadIdsRef = useRef(new Set<string>());

  useEffect(() => {
    snapshotRef.current = snapshot;
  }, [snapshot]);

  const refresh = useCallback(async () => {
    if (!userId) {
      setSnapshot(emptyNotificationSnapshot);
      return;
    }

    if (refreshInFlightRef.current) {
      refreshQueuedRef.current = true;
      return refreshInFlightRef.current;
    }

    const supabase = createSupabaseBrowserClient();
    const request = (async () => {
      do {
        refreshQueuedRef.current = false;
        const { data, error: requestError } = await supabase.rpc(
          "get_notification_center_snapshot",
          { target_limit: 20 },
        );

        if (requestError) {
          console.error("Notification center refresh failed", requestError);
          setError("Notifications could not be refreshed.");
          continue;
        }

        setError(null);
        setSnapshot(parseNotificationSnapshot(data));
      } while (refreshQueuedRef.current);
    })().finally(() => {
      refreshInFlightRef.current = null;
    });

    refreshInFlightRef.current = request;
    return request;
  }, [userId]);

  useEffect(() => {
    if (!userId) {
      return;
    }

    const supabase = createSupabaseBrowserClient();
    let disposed = false;
    function applyRealtimeChange(
      payload: RealtimePostgresChangesPayload<Record<string, unknown>>,
    ) {
      if (payload.eventType === "INSERT") {
        const notification = toNotificationCenterItem(payload.new);
        if (!notification || notification.read || !isBellNotificationType(notification.type)) {
          return;
        }

        setSnapshot((current) => {
          if (current.notifications.some((item) => item.id === notification.id)) {
            return current;
          }

          return addNotification(current, notification);
        });
        return;
      }

      if (payload.eventType === "UPDATE") {
        const notification = toNotificationCenterItem(payload.new);
        if (!notification) {
          void refresh();
          return;
        }

        if (
          notification.read &&
          optimisticReadIdsRef.current.delete(notification.id)
        ) {
          return;
        }

        const knownNotification = snapshotRef.current.notifications.find(
          (item) => item.id === notification.id,
        );
        if (!knownNotification) {
          void refresh();
          return;
        }

        setSnapshot((current) => {
          const existing = current.notifications.find(
            (item) => item.id === notification.id,
          );

          if (notification.read) {
            if (!existing) {
              return current;
            }
            return removeNotification(current, existing);
          }

          if (!existing) {
            return current;
          }

          return {
            ...current,
            notifications: current.notifications.map((item) =>
              item.id === notification.id ? notification : item,
            ),
          };
        });
        return;
      }

      void refresh();
    }

    const channel = supabase
      .channel(`notification-center:${userId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "notifications",
          filter: `user_id=eq.${userId}`,
        },
        applyRealtimeChange,
      );

    void channel.subscribe((status) => {
      if (disposed || status !== "SUBSCRIBED") {
        return;
      }

      // Close the gap between the server snapshot and the realtime listener.
      // The same refresh also reconciles every reconnect.
      void refresh();
    });

    function handleExternalRead() {
      void refresh();
    }

    window.addEventListener("flyloop-notifications-read", handleExternalRead);

    return () => {
      disposed = true;
      window.removeEventListener("flyloop-notifications-read", handleExternalRead);
      void supabase.removeChannel(channel);
    };
  }, [refresh, userId]);

  const markRead = useCallback(
    async (notificationId: string) => {
      if (!userId || !notificationId) {
        return;
      }

      const optimisticItem =
        snapshot.notifications.find((item) => item.id === notificationId) ?? null;
      optimisticReadIdsRef.current.add(notificationId);
      setSnapshot((current) => {
        const currentItem =
          current.notifications.find((item) => item.id === notificationId) ?? null;
        return currentItem
          ? removeNotification(current, currentItem)
          : current;
      });

      const supabase = createSupabaseBrowserClient();
      const { error: updateError } = await supabase
        .from("notifications")
        .update({ read: true })
        .eq("user_id", userId)
        .eq("id", notificationId);

      if (!updateError) {
        setError(null);
        window.setTimeout(() => {
          optimisticReadIdsRef.current.delete(notificationId);
        }, 5_000);
        return;
      }

      optimisticReadIdsRef.current.delete(notificationId);
      console.error("Notification mark-read failed", updateError);
      setError("The notification could not be marked as read.");
      if (optimisticItem) {
        setSnapshot((current) => addNotification(current, optimisticItem));
      } else {
        void refresh();
      }
      throw updateError;
    },
    [refresh, snapshot.notifications, userId],
  );

  const value = useMemo<NotificationCenterValue>(
    () => ({ ...snapshot, error, markRead }),
    [error, markRead, snapshot],
  );

  return (
    <NotificationCenterContext.Provider value={value}>
      {children}
    </NotificationCenterContext.Provider>
  );
}

export function useNotificationCenter() {
  const value = useContext(NotificationCenterContext);
  if (!value) {
    throw new Error("useNotificationCenter must be used inside NotificationCenterProvider");
  }
  return value;
}

function addNotification(
  current: NotificationSnapshot,
  notification: NotificationCenterItem,
): NotificationSnapshot {
  if (current.notifications.some((item) => item.id === notification.id)) {
    return current;
  }

  const isOrganizer = isCoachNotificationType(notification.type);
  const isParticipant =
    isAthleteNotificationType(notification.type) &&
    countBadgeNotifications([notification]) === 1;

  return {
    notifications: [notification, ...current.notifications]
      .sort((a, b) => b.created_at.localeCompare(a.created_at))
      .slice(0, 20),
    bellUnreadCount: current.bellUnreadCount + 1,
    organizerUnreadCount:
      current.organizerUnreadCount + (isOrganizer ? 1 : 0),
    participantUnreadCount:
      current.participantUnreadCount + (isParticipant ? 1 : 0),
  };
}

function removeNotification(
  current: NotificationSnapshot,
  notification: NotificationCenterItem,
): NotificationSnapshot {
  const isOrganizer = isCoachNotificationType(notification.type);
  const isParticipant =
    isAthleteNotificationType(notification.type) &&
    countBadgeNotifications([notification]) === 1;

  return {
    notifications: current.notifications.filter(
      (item) => item.id !== notification.id,
    ),
    bellUnreadCount: Math.max(0, current.bellUnreadCount - 1),
    organizerUnreadCount: Math.max(
      0,
      current.organizerUnreadCount - (isOrganizer ? 1 : 0),
    ),
    participantUnreadCount: Math.max(
      0,
      current.participantUnreadCount - (isParticipant ? 1 : 0),
    ),
  };
}
