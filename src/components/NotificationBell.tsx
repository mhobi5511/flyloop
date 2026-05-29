"use client";

import Link from "next/link";
import { Bell } from "lucide-react";
import { markAllNotificationsRead } from "@/lib/demo-store";
import { useDemoState } from "@/lib/use-demo-state";

export function NotificationBell() {
  const [state, setState] = useDemoState();
  const unread = state.notifications.filter((notification) => !notification.read);

  function openList() {
    setState(markAllNotificationsRead());
  }

  return (
    <details className="relative">
      <summary
        onClick={openList}
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
            {state.notifications.length} total
          </span>
        </div>
        <div className="grid max-h-80 gap-2 overflow-auto">
          {state.notifications.length === 0 ? (
            <p className="rounded-xl bg-slate-50 p-3 text-sm text-slate-600">
              No notifications yet.
            </p>
          ) : (
            state.notifications.map((notification) => (
              <Link
                key={notification.id}
                href={
                  notification.opportunityId
                    ? `/app/opportunities/${notification.opportunityId}`
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
