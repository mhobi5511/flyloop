"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Check, Clock3, X } from "lucide-react";
import { updateApplicantStatus } from "@/app/app/organizer/opportunities/actions";
import type { InterestStatus } from "@/lib/types";

type ApplicantStatusActionsProps = {
  interestId: string;
  currentStatus: InterestStatus;
  compact?: boolean;
};

const actions: Array<{ status: InterestStatus; label: string }> = [
  { status: "accepted", label: "Accept" },
  { status: "declined", label: "Decline" },
  { status: "waitlist", label: "Waitlist" },
];

export function ApplicantStatusActions({
  interestId,
  currentStatus,
  compact = false,
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
      <div className={`flex flex-wrap gap-1.5 ${compact ? "items-center" : ""}`}>
        {actions.map((action) => (
          <button
            key={action.status}
            type="button"
            disabled={isPending || status === action.status}
            onClick={() => update(action.status)}
            aria-label={action.label}
            title={action.label}
            className={`inline-flex items-center justify-center rounded-lg font-bold transition disabled:cursor-not-allowed ${
              compact
                ? `size-8 border ${
                    status === action.status
                      ? getCompactActionActiveClasses(action.status)
                      : getCompactActionIdleClasses(action.status)
                  }`
                : `h-8 px-2.5 text-xs ${
                    status === action.status
                      ? "bg-sky-100 text-sky-700"
                      : "border border-slate-200 text-slate-700 hover:bg-slate-50"
                  }`
            }`}
          >
            {compact ? (
              <>
                {action.status === "accepted" ? (
                  <Check size={16} />
                ) : action.status === "waitlist" ? (
                  <Clock3 size={16} />
                ) : (
                  <X size={16} />
                )}
                <span className="sr-only">{action.label}</span>
              </>
            ) : (
              action.label
            )}
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

function getCompactActionIdleClasses(status: InterestStatus) {
  if (status === "accepted") {
    return "border-emerald-200 text-emerald-700 hover:bg-emerald-50";
  }

  if (status === "waitlist") {
    return "border-amber-200 text-amber-700 hover:bg-amber-50";
  }

  return "border-rose-200 text-rose-700 hover:bg-rose-50";
}

function getCompactActionActiveClasses(status: InterestStatus) {
  if (status === "accepted") {
    return "border-emerald-300 bg-emerald-100 text-emerald-700";
  }

  if (status === "waitlist") {
    return "border-amber-300 bg-amber-100 text-amber-700";
  }

  return "border-rose-300 bg-rose-100 text-rose-700";
}
