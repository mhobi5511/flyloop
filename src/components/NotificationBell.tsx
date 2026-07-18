"use client";

import { useRouter } from "next/navigation";
import { useRef } from "react";
import { Bell } from "lucide-react";
import { isCoachNotificationType } from "@/lib/notifications";
import {
  useNotificationCenter,
  type NotificationCenterItem,
} from "./NotificationCenter";

export function NotificationBell() {
  const router = useRouter();
  const detailsRef = useRef<HTMLDetailsElement>(null);
  const {
    notifications,
    bellUnreadCount,
    error,
    markRead,
  } = useNotificationCenter();

  function openNotification(notification: NotificationCenterItem) {
    const href = notificationHref(notification);

    if (detailsRef.current) {
      detailsRef.current.open = false;
    }

    void markRead(notification.id).catch(() => {
      // The provider rolls the optimistic state back and exposes the error.
    });
    router.push(href);
  }

  return (
    <details ref={detailsRef} className="relative">
      <summary
        className="grid size-10 cursor-pointer list-none place-items-center rounded-full border border-slate-200 bg-white text-slate-700 shadow-sm"
        aria-label="Notifications"
      >
        <Bell size={18} />
        {bellUnreadCount > 0 ? (
          <span className="absolute -right-1 -top-1 grid min-w-5 place-items-center rounded-full bg-sky-600 px-1 text-xs font-bold text-white">
            {bellUnreadCount > 99 ? "99+" : bellUnreadCount}
          </span>
        ) : null}
      </summary>
      <div className="fixed inset-x-3 top-16 z-40 max-h-[calc(100dvh-5rem)] overflow-hidden rounded-2xl border border-slate-200 bg-white p-3 shadow-xl sm:absolute sm:inset-auto sm:right-0 sm:top-12 sm:w-[min(22rem,calc(100vw-2rem))]">
        <div className="mb-2 flex items-center justify-between">
          <p className="font-bold text-slate-950">Notifications</p>
          <span className="text-xs font-semibold text-slate-500">
            {bellUnreadCount} new
          </span>
        </div>
        <div className="grid max-h-[calc(100dvh-10rem)] gap-2 overflow-auto sm:max-h-80">
          {error ? (
            <p className="rounded-xl bg-rose-50 p-3 text-sm text-rose-700">
              {error}
            </p>
          ) : notifications.length === 0 ? (
            <p className="rounded-xl bg-slate-50 p-3 text-sm text-slate-600">
              No new notifications.
            </p>
          ) : (
            notifications.map((notification) => (
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

function notificationHref(notification: NotificationCenterItem) {
  if (isCoachNotificationType(notification.type)) {
    return "/app/coach-dashboard";
  }

  return notification.opportunity_id
    ? `/app/opportunities/${notification.opportunity_id}`
    : "/app";
}
