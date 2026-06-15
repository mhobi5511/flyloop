"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { Bell } from "lucide-react";
import {
  bellNotificationTypes,
  isCoachNotificationType,
} from "@/lib/notifications";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";

type Notification = {
  id: string;
  title: string;
  body: string;
  type: string;
  opportunity_id: string | null;
  read: boolean;
  created_at: string;
};

export function NotificationBell() {
  const router = useRouter();
  const detailsRef = useRef<HTMLDetailsElement>(null);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [visibleNotifications, setVisibleNotifications] = useState<Notification[]>([]);

  useEffect(() => {
    const supabase = createSupabaseBrowserClient();
    let disposed = false;
    let channel: ReturnType<typeof supabase.channel> | null = null;
    let currentUserId: string | null = null;

    async function loadNotifications() {
      if (!currentUserId) {
        return;
      }

      try {
        const { data, error: loadError } = await supabase
          .from("notifications")
          .select("id,title,body,type,opportunity_id,read,created_at")
          .eq("user_id", currentUserId)
          .eq("read", false)
          .in("type", [...bellNotificationTypes])
          .order("created_at", { ascending: false })
          .limit(20);

        if (loadError) {
          console.error("Notification load failed", loadError);
          return;
        }

        if (!disposed) {
          setNotifications(data ?? []);
        }
      } catch (loadError) {
        console.error("Notification load failed", loadError);
      }
    }

    void supabase.auth.getUser().then(({ data }) => {
      const userId = data.user?.id;

      if (!userId || disposed) {
        return;
      }

      currentUserId = userId;
      void loadNotifications();

      channel = supabase
        .channel(`notifications:${userId}`)
        .on(
          "postgres_changes",
          {
            event: "*",
            schema: "public",
            table: "notifications",
            filter: `user_id=eq.${userId}`,
          },
          () => void loadNotifications(),
        )
        .subscribe();
    });

    function handleRead() {
      void loadNotifications();
    }

    window.addEventListener("flyloop-notifications-read", handleRead);
    const interval = window.setInterval(() => void loadNotifications(), 15_000);

    return () => {
      disposed = true;
      window.removeEventListener("flyloop-notifications-read", handleRead);
      window.clearInterval(interval);
      if (channel) {
        void supabase.removeChannel(channel);
      }
    };
  }, []);

  async function markRead(notificationId: string) {
    if (!notificationId) {
      return;
    }

    const supabase = createSupabaseBrowserClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return;
    }

    const { error: updateError } = await supabase
      .from("notifications")
      .update({ read: true })
      .eq("user_id", user.id)
      .eq("id", notificationId);

    if (updateError) {
      console.error("Notification mark-read failed", updateError);
      return;
    }

    setNotifications((current) =>
      current.filter((notification) => notification.id !== notificationId),
    );
    setVisibleNotifications((current) =>
      current.filter((notification) => notification.id !== notificationId),
    );
    window.dispatchEvent(new Event("flyloop-notifications-read"));
  }

  async function openNotification(notification: Notification) {
    const href = notificationHref(notification);

    if (detailsRef.current) {
      detailsRef.current.open = false;
    }

    setVisibleNotifications([]);
    setNotifications((current) =>
      current.filter((item) => item.id !== notification.id),
    );
    window.dispatchEvent(new Event("flyloop-notifications-read"));
    await markRead(notification.id);
    router.push(href);
  }

  function handleToggle(event: React.ToggleEvent<HTMLDetailsElement>) {
    if (!event.currentTarget.open) {
      setVisibleNotifications([]);
      return;
    }

    setVisibleNotifications(notifications);
  }

  return (
    <details ref={detailsRef} className="relative" onToggle={handleToggle}>
      <summary
        className="grid size-10 cursor-pointer list-none place-items-center rounded-full border border-slate-200 bg-white text-slate-700 shadow-sm"
        aria-label="Notifications"
      >
        <Bell size={18} />
        {notifications.length > 0 ? (
          <span className="absolute -right-1 -top-1 grid min-w-5 place-items-center rounded-full bg-sky-600 px-1 text-xs font-bold text-white">
            {notifications.length}
          </span>
        ) : null}
      </summary>
      <div className="fixed inset-x-3 top-16 z-40 max-h-[calc(100dvh-5rem)] overflow-hidden rounded-2xl border border-slate-200 bg-white p-3 shadow-xl sm:absolute sm:inset-auto sm:right-0 sm:top-12 sm:w-[min(22rem,calc(100vw-2rem))]">
        <div className="mb-2 flex items-center justify-between">
          <p className="font-bold text-slate-950">Notifications</p>
          <span className="text-xs font-semibold text-slate-500">
            {visibleNotifications.length} new
          </span>
        </div>
        <div className="grid max-h-[calc(100dvh-10rem)] gap-2 overflow-auto sm:max-h-80">
          {visibleNotifications.length === 0 ? (
            <p className="rounded-xl bg-slate-50 p-3 text-sm text-slate-600">
              No new notifications.
            </p>
          ) : (
            visibleNotifications.map((notification) => (
              <button
                key={notification.id}
                type="button"
                onClick={() => void openNotification(notification)}
                className="min-w-0 rounded-xl border border-slate-100 p-3 text-left hover:bg-sky-50"
              >
                <p className="break-words text-sm font-bold text-slate-900">
                  {notification.title}
                </p>
                <p className="mt-1 break-words text-xs leading-5 text-slate-600">
                  {notification.body}
                </p>
              </button>
            ))
          )}
        </div>
      </div>
    </details>
  );
}

function notificationHref(notification: Notification) {
  if (isCoachNotificationType(notification.type)) {
    return "/app/coach-dashboard";
  }

  return notification.opportunity_id
    ? `/app/opportunities/${notification.opportunity_id}`
    : "/app";
}
