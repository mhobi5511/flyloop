"use client";

import { useEffect, useState } from "react";
import { X } from "lucide-react";

type FollowGuidanceProps = {
  opportunityId: string;
  show: boolean;
};

export function FollowGuidance({ opportunityId, show }: FollowGuidanceProps) {
  const storageKey = `flyloop:follow-guidance-dismissed:${opportunityId}`;
  const [isReady, setIsReady] = useState(false);
  const [isDismissed, setIsDismissed] = useState(true);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setIsDismissed(window.localStorage.getItem(storageKey) === "1");
      setIsReady(true);
    }, 0);

    return () => window.clearTimeout(timer);
  }, [storageKey]);

  if (!show || !isReady || isDismissed) {
    return null;
  }

  return (
    <div className="mt-4 flex items-start gap-3 rounded-2xl border border-sky-100 bg-sky-50/70 p-3 text-sm font-semibold leading-5 text-slate-700">
      <p className="min-w-0 flex-1">
        Follow this coach or tunnel to get notified when new camps go online.
      </p>
      <button
        type="button"
        aria-label="Dismiss follow guidance"
        onClick={() => {
          window.localStorage.setItem(storageKey, "1");
          setIsDismissed(true);
        }}
        className="grid size-7 shrink-0 place-items-center rounded-lg text-slate-500 transition hover:bg-white"
      >
        <X size={15} />
      </button>
    </div>
  );
}
