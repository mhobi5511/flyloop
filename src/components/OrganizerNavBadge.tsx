"use client";

import { useEffect, useState } from "react";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import { countBadgeNotifications } from "@/lib/notifications";
import { NotificationCountBadge } from "./NotificationCountBadge";

type OrganizerNavBadgeProps = {
  initialCount: number;
  compact?: boolean;
  notificationTypes?: readonly string[];
};

export function OrganizerNavBadge({
  initialCount,
  notificationTypes = ["new_interest"],
}: OrganizerNavBadgeProps) {
  const [count, setCount] = useState(initialCount);
  const notificationTypesKey = notificationTypes.join("|");

  useEffect(() => {
    const supabase = createSupabaseBrowserClient();
    let disposed = false;
    let channel: ReturnType<typeof supabase.channel> | null = null;
    let currentUserId: string | null = null;

    async function loadCount() {
      if (!currentUserId) {
        return;
      }

      try {
        const shouldFilterDeclined =
          notificationTypesKey.split("|").includes("application_status");
        const { count: unreadCount, data, error: countError } = shouldFilterDeclined
          ? await supabase
              .from("notifications")
              .select("type,body")
              .eq("user_id", currentUserId)
              .eq("read", false)
              .in("type", notificationTypesKey.split("|").filter(Boolean))
          : await supabase
          .from("notifications")
          .select("*", { count: "exact", head: true })
          .eq("user_id", currentUserId)
          .eq("read", false)
          .in("type", notificationTypesKey.split("|").filter(Boolean));

        if (countError) {
          console.error("Organizer nav badge count failed", countError);
          return;
        }

        if (!disposed) {
          setCount(
            shouldFilterDeclined
              ? countBadgeNotifications(data ?? [])
              : (unreadCount ?? 0),
          );
        }
      } catch (countError) {
        console.error("Organizer nav badge count failed", countError);
      }
    }

    function handleRead() {
      void loadCount();
    }

    window.addEventListener("flyloop-notifications-read", handleRead);
    void supabase.auth.getUser().then(({ data }) => {
      const userId = data.user?.id;

      if (!userId || disposed) {
        return;
      }

      currentUserId = userId;
      void loadCount();

      channel = supabase
        .channel(`organizer-notifications:${userId}`)
        .on(
          "postgres_changes",
          {
            event: "*",
            schema: "public",
            table: "notifications",
            filter: `user_id=eq.${userId}`,
          },
          () => void loadCount(),
        )
        .subscribe();
    });

    const interval = window.setInterval(() => void loadCount(), 15_000);

    return () => {
      disposed = true;
      window.removeEventListener("flyloop-notifications-read", handleRead);
      window.clearInterval(interval);
      if (channel) {
        void supabase.removeChannel(channel);
      }
    };
  }, [notificationTypesKey]);

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
