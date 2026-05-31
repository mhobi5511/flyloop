"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { updateApplicantStatus } from "@/app/app/organizer/opportunities/actions";
import type { InterestStatus } from "@/lib/types";

type ApplicantStatusActionsProps = {
  interestId: string;
  currentStatus: InterestStatus;
};

const actions: Array<{ status: InterestStatus; label: string }> = [
  { status: "accepted", label: "Accept" },
  { status: "declined", label: "Decline" },
  { status: "waitlist", label: "Waitlist" },
];

export function ApplicantStatusActions({
  interestId,
  currentStatus,
}: ApplicantStatusActionsProps) {
  const router = useRouter();
  const [status, setStatus] = useState(currentStatus);
  const [error, setError] = useState("");
  const [isPending, startTransition] = useTransition();

  function update(nextStatus: InterestStatus) {
    setError("");

    startTransition(async () => {
      const previousStatus = status;
      setStatus(nextStatus);
      const result = await updateApplicantStatus(interestId, nextStatus);

      if (!result.ok) {
        setStatus(previousStatus);
        setError(result.message);
        return;
      }

      router.refresh();
    });
  }

  return (
    <div className="grid gap-1.5">
      <div className="flex flex-wrap gap-1.5">
        {actions.map((action) => (
          <button
            key={action.status}
            type="button"
            disabled={isPending || status === action.status}
            onClick={() => update(action.status)}
            className={`h-8 rounded-lg px-2.5 text-xs font-bold transition disabled:cursor-not-allowed ${
              status === action.status
                ? "bg-sky-100 text-sky-700"
                : "border border-slate-200 text-slate-700 hover:bg-slate-50"
            }`}
          >
            {action.label}
          </button>
        ))}
      </div>
      {error ? (
        <p className="rounded-lg bg-rose-50 p-2 text-xs font-semibold text-rose-700">
          {error}
        </p>
      ) : null}
    </div>
  );
}
