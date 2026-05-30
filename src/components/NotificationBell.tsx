"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { Bell } from "lucide-react";
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
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const unread = notifications.filter((notification) => !notification.read);

  useEffect(() => {
    const supabase = createSupabaseBrowserClient();

    async function loadNotifications() {
      try {
        const { data, error: loadError } = await supabase
          .from("notifications")
          .select("id,title,body,type,opportunity_id,read,created_at")
          .order("created_at", { ascending: false })
          .limit(20);

        if (loadError) {
          console.error("Notification load failed", loadError);
          return;
        }

        setNotifications(data ?? []);
      } catch (loadError) {
        console.error("Notification load failed", loadError);
      }
    }

    void loadNotifications();

    function handleRead() {
      void loadNotifications();
    }

    window.addEventListener("flyloop-notifications-read", handleRead);
    const interval = window.setInterval(() => void loadNotifications(), 15_000);

    return () => {
      window.removeEventListener("flyloop-notifications-read", handleRead);
      window.clearInterval(interval);
    };
  }, []);

  async function markRead() {
    if (unread.length === 0) {
      return;
    }

    const supabase = createSupabaseBrowserClient();
    const unreadIds = unread.map((notification) => notification.id);
    const { error: updateError } = await supabase
      .from("notifications")
      .update({ read: true })
      .in("id", unreadIds);

    if (updateError) {
      console.error("Notification mark-read failed", updateError);
      return;
    }

    setNotifications((current) =>
      current.map((notification) => ({ ...notification, read: true })),
    );
    window.dispatchEvent(new Event("flyloop-notifications-read"));
  }

  return (
    <details className="relative">
      <summary
        onClick={markRead}
        className="grid size-10 cursor-pointer list-none place-items-center rounded-full border border-slate-200 bg-white text-slate-700 shadow-sm"
        aria-label="Notifications"
      >
        <Bell size={18} />
        {unread.length > 0 ? (
          <span className="absolute -right-1 -top-1 grid min-w-5 place-items-center rounded-full bg-sky-600 px-1 text-xs font-bold text-white">
            {unread.length}
          </span>
        ) : null}
      </summary>
      <div className="absolute right-0 top-12 z-40 w-[min(22rem,calc(100vw-2rem))] rounded-2xl border border-slate-200 bg-white p-3 shadow-xl">
        <div className="mb-2 flex items-center justify-between">
          <p className="font-bold text-slate-950">Notifications</p>
          <span className="text-xs font-semibold text-slate-500">
            {notifications.length} total
          </span>
        </div>
        <div className="grid max-h-80 gap-2 overflow-auto">
          {notifications.length === 0 ? (
            <p className="rounded-xl bg-slate-50 p-3 text-sm text-slate-600">
              No notifications yet.
            </p>
          ) : (
            notifications.map((notification) => (
              <Link
                key={notification.id}
                href={
                  notification.opportunity_id && notification.type === "new_interest"
                    ? `/app/organizer/opportunities/${notification.opportunity_id}`
                    : notification.opportunity_id
                    ? `/app/opportunities/${notification.opportunity_id}`
                    : "/app"
                }
                className="rounded-xl border border-slate-100 p-3 hover:bg-sky-50"
              >
                <p className="text-sm font-bold text-slate-900">
                  {notification.title}
                </p>
                <p className="mt-1 text-xs leading-5 text-slate-600">
                  {notification.body}
                </p>
              </Link>
            ))
          )}
        </div>
      </div>
    </details>
  );
}
