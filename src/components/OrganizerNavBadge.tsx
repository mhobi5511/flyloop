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
      const { count: unreadCount } = await supabase
        .from("notifications")
        .select("*", { count: "exact", head: true })
        .eq("read", false)
        .eq("type", "new_interest");

      setCount(unreadCount ?? 0);
    }

    function handleRead() {
      void loadCount();
    }

    window.addEventListener("flyloop-notifications-read", handleRead);

    const channel = supabase
      .channel("organizer-nav-notifications")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "notifications" },
        () => void loadCount(),
      )
      .subscribe();

    return () => {
      window.removeEventListener("flyloop-notifications-read", handleRead);
      void supabase.removeChannel(channel);
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
