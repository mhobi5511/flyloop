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
};

export function SlotReleaseRequestActions({
  opportunityId,
  bookingId,
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
    <div className="grid gap-2">
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          disabled={isPending}
          onClick={() => resolve("approve")}
          className="inline-flex h-8 items-center gap-1 rounded-lg border border-emerald-200 bg-emerald-50 px-2 text-xs font-black text-emerald-700 transition hover:bg-emerald-100 disabled:cursor-not-allowed disabled:border-slate-200 disabled:bg-slate-100 disabled:text-slate-400"
        >
          <Check size={14} /> Approve
        </button>
        <button
          type="button"
          disabled={isPending}
          onClick={() => resolve("reject")}
          className="inline-flex h-8 items-center gap-1 rounded-lg border border-slate-200 bg-white px-2 text-xs font-black text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:text-slate-400"
        >
          <X size={14} /> Reject
        </button>
      </div>
      {message ? (
        <p className="text-xs font-semibold text-emerald-700">{message}</p>
      ) : null}
      {error ? <p className="text-xs font-semibold text-rose-700">{error}</p> : null}
    </div>
  );
}
