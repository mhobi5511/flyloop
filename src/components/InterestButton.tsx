"use client";

import { useEffect, useState } from "react";
import { Send } from "lucide-react";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import { sendOpportunityInterest } from "@/app/app/opportunities/actions";
import type { InterestStatus } from "@/lib/types";

type InterestButtonProps = {
  opportunityId: string;
  disabled?: boolean;
  initialStatus?: InterestStatus;
  compact?: boolean;
};

export function InterestButton({
  opportunityId,
  disabled,
  initialStatus,
  compact = false,
}: InterestButtonProps) {
  const [interestStatus, setInterestStatus] = useState<InterestStatus | null>(
    initialStatus ?? null,
  );
  const [isLoading, setIsLoading] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    const supabase = createSupabaseBrowserClient();

    async function loadInterest() {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        return;
      }

      const { data } = await supabase
        .from("opportunity_interests")
        .select("status")
        .eq("opportunity_id", opportunityId)
        .eq("athlete_id", user.id)
        .maybeSingle();

      setInterestStatus((data?.status as InterestStatus | undefined) ?? null);
    }

    if (!initialStatus) {
      void loadInterest();
    }
  }, [initialStatus, opportunityId]);

  async function sendInterest() {
    setIsLoading(true);
    setError("");
    setMessage("");

    const result = await sendOpportunityInterest(opportunityId);

    setIsLoading(false);

    if (!result.ok) {
      setError(result.message);
      return;
    }

    setInterestStatus(result.status ?? "pending");
    setMessage(result.message);
  }

  const hasInterest = Boolean(interestStatus);
  const buttonLabel = interestStatus
    ? statusButtonLabel(interestStatus)
    : isLoading
      ? "Sending..."
      : "I'm interested";

  return (
    <div className={compact ? "" : "rounded-2xl border border-slate-200 bg-white p-4 shadow-sm"}>
      <button
        type="button"
        disabled={disabled || hasInterest || isLoading}
        onClick={sendInterest}
        className="flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-sky-600 px-4 text-sm font-bold text-white shadow-sm transition hover:bg-sky-700 disabled:cursor-not-allowed disabled:bg-slate-300"
      >
        <Send size={18} />
        {buttonLabel}
      </button>
      <p className={`${compact ? "mt-2" : "mt-3 text-center"} whitespace-pre-line text-sm leading-6 text-slate-600`}>
        {message ||
          (interestStatus
            ? statusHint(interestStatus)
            : "Share your contact details with the organizer.")}
      </p>
      {error ? (
        <p className="mt-3 rounded-xl bg-rose-50 p-3 text-sm font-semibold text-rose-700">
          {error}
        </p>
      ) : null}
    </div>
  );
}

function statusButtonLabel(status: InterestStatus) {
  if (status === "accepted") {
    return "Accepted";
  }

  if (status === "declined") {
    return "Declined";
  }

  if (status === "waitlist") {
    return "Waitlist";
  }

  return "Pending";
}

function statusHint(status: InterestStatus) {
  if (status === "accepted") {
    return "You already applied and were accepted.";
  }

  if (status === "declined") {
    return "You already applied. This application was declined.";
  }

  if (status === "waitlist") {
    return "You already applied and are on the waitlist.";
  }

  return [
    "You already applied. Your application is pending.",
    "The organizer has been notified.",
    "You will receive an update when your status changes.",
  ].join("\n");
}
