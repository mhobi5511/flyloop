"use client";

import { useState, useTransition } from "react";
import { Check, X } from "lucide-react";
import { useRouter } from "next/navigation";
import {
  approveSlotReleaseRequest,
  rejectSlotReleaseRequest,
} from "@/app/app/organizer/opportunities/actions";

type SlotReleaseRequestActionsProps = {
  opportunityId: string;
  bookingId: string;
  compact?: boolean;
};

export function SlotReleaseRequestActions({
  opportunityId,
  bookingId,
  compact = false,
}: SlotReleaseRequestActionsProps) {
  const router = useRouter();
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [isPending, startTransition] = useTransition();

  function resolve(decision: "approve" | "reject") {
    setMessage("");
    setError("");

    startTransition(async () => {
      const result =
        decision === "approve"
          ? await approveSlotReleaseRequest(opportunityId, bookingId)
          : await rejectSlotReleaseRequest(opportunityId, bookingId);

      if (!result.ok) {
        setError(result.message);
        return;
      }

      setMessage(result.message);
      router.refresh();
    });
  }

  return (
    <div className={compact ? "grid gap-1.5" : "grid gap-2"}>
      <div className={`flex flex-wrap ${compact ? "gap-1.5" : "gap-2"}`}>
        <button
          type="button"
          disabled={isPending}
          onClick={() => resolve("approve")}
          aria-label="Approve Release"
          title="Approve Release"
          className={`inline-flex items-center justify-center rounded-lg border font-black transition disabled:cursor-not-allowed disabled:border-slate-200 disabled:bg-slate-100 disabled:text-slate-400 ${
            compact
              ? "size-8 border-emerald-200 bg-emerald-50 text-emerald-700 hover:bg-emerald-100"
              : "h-8 gap-1 border-emerald-200 bg-emerald-50 px-2 text-xs text-emerald-700 hover:bg-emerald-100"
          }`}
        >
          <Check size={14} />
          <span className={compact ? "sr-only" : ""}>Approve Release</span>
        </button>
        <button
          type="button"
          disabled={isPending}
          onClick={() => resolve("reject")}
          aria-label="Decline Release"
          title="Decline Release"
          className={`inline-flex items-center justify-center rounded-lg border font-black transition disabled:cursor-not-allowed disabled:text-slate-400 ${
            compact
              ? "size-8 border-slate-200 bg-white text-slate-700 hover:bg-slate-50"
              : "h-8 gap-1 border-slate-200 bg-white px-2 text-xs text-slate-700 hover:bg-slate-50"
          }`}
        >
          <X size={14} />
          <span className={compact ? "sr-only" : ""}>Decline Release</span>
        </button>
      </div>
      {message ? (
        <p className={compact ? "text-[11px] font-semibold text-emerald-700" : "text-xs font-semibold text-emerald-700"}>
          {message}
        </p>
      ) : null}
      {error ? (
        <p className={compact ? "text-[11px] font-semibold text-rose-700" : "text-xs font-semibold text-rose-700"}>
          {error}
        </p>
      ) : null}
    </div>
  );
}
