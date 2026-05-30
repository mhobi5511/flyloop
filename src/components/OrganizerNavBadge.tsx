"use client";

import { useEffect, useState } from "react";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";

type OrganizerNavBadgeProps = {
  initialCount: number;
  compact?: boolean;
};

export function OrganizerNavBadge({
  initialCount,
  compact = false,
}: OrganizerNavBadgeProps) {
  const [count, setCount] = useState(initialCount);

  useEffect(() => {
    const supabase = createSupabaseBrowserClient();

    async function loadCount() {
      try {
        const { count: unreadCount, error: countError } = await supabase
          .from("notifications")
          .select("*", { count: "exact", head: true })
          .eq("read", false)
          .eq("type", "new_interest");

        if (countError) {
          console.error("Organizer nav badge count failed", countError);
          return;
        }

        setCount(unreadCount ?? 0);
      } catch (countError) {
        console.error("Organizer nav badge count failed", countError);
      }
    }

    function handleRead() {
      void loadCount();
    }

    window.addEventListener("flyloop-notifications-read", handleRead);

    const interval = window.setInterval(() => void loadCount(), 15_000);

    return () => {
      window.removeEventListener("flyloop-notifications-read", handleRead);
      window.clearInterval(interval);
    };
  }, []);

  if (count === 0) {
    return null;
  }

  if (compact) {
    return (
      <span className="absolute right-1 top-1 grid min-w-4 place-items-center rounded-full bg-sky-600 px-1 text-[0.62rem] font-black leading-4 text-white">
        {count}
      </span>
    );
  }

  return (
    <span className="inline-flex items-center gap-1 rounded-full bg-sky-100 px-1.5 py-0.5 text-xs font-black text-sky-700">
      <span className="size-1.5 rounded-full bg-sky-600" />
      {count}
    </span>
  );
}
