"use client";

import { useState, useTransition } from "react";
import { XCircle } from "lucide-react";
import { releaseOwnOpportunitySlot } from "@/app/app/opportunities/actions";

type RequestSlotReleaseButtonProps = {
  opportunityId: string;
  slotId: string;
};

export function RequestSlotReleaseButton({
  opportunityId,
  slotId,
}: RequestSlotReleaseButtonProps) {
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [isPending, startTransition] = useTransition();

  function requestRelease() {
    setMessage("");
    setError("");

    startTransition(async () => {
      const result = await releaseOwnOpportunitySlot(opportunityId, slotId);

      if (!result.ok) {
        setError(result.message);
        return;
      }

      setMessage(result.message);
    });
  }

  return (
    <div className="grid gap-1">
      <button
        type="button"
        disabled={isPending}
        onClick={requestRelease}
        className="inline-flex h-8 items-center gap-1 rounded-lg border border-rose-200 px-2 text-xs font-black text-rose-700 transition hover:bg-rose-50 disabled:cursor-not-allowed disabled:text-slate-400"
      >
        <XCircle size={14} /> {isPending ? "Sending..." : "Request Slot Release"}
      </button>
      {message ? (
        <p className="text-xs font-semibold text-emerald-700">{message}</p>
      ) : null}
      {error ? <p className="text-xs font-semibold text-rose-700">{error}</p> : null}
    </div>
  );
}
