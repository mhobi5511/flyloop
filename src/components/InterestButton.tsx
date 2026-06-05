"use client";

import { useEffect, useState } from "react";
import { CheckCircle2, Clock3, Send, XCircle } from "lucide-react";
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
        .select("status,interest_type")
        .eq("opportunity_id", opportunityId)
        .eq("athlete_id", user.id)
        .maybeSingle();

      setInterestStatus(
        data?.interest_type === "timetable_reminder" ||
          data?.status === "withdrawn"
          ? null
          : ((data?.status as InterestStatus | undefined) ?? null),
      );
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
      : "Apply";

  if (compact && interestStatus) {
    return (
      <div className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2">
        <div className="flex items-center gap-2 font-black text-slate-900">
          <StatusIcon status={interestStatus} />
          {statusButtonLabel(interestStatus)}
        </div>
        <p className="mt-1 whitespace-pre-line text-xs font-semibold leading-5 text-slate-600">
          {message || statusHint(interestStatus)}
        </p>
      </div>
    );
  }

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
            : "Apply to join this session.")}
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
    return "You're In";
  }

  if (status === "declined") {
    return "Declined";
  }

  if (status === "waitlist") {
    return "Waitlist";
  }

  return "Application Pending";
}

function statusHint(status: InterestStatus) {
  if (status === "accepted") {
    return "Your spot is confirmed.";
  }

  if (status === "declined") {
    return "This application was declined by the organizer.";
  }

  if (status === "waitlist") {
    return "You are on the waitlist for this opportunity.";
  }

  return [
    "You already applied. Your application is pending.",
    "The organizer has been notified.",
    "You will receive an update when your status changes.",
  ].join("\n");
}

function StatusIcon({ status }: { status: InterestStatus }) {
  const className = statusIconClass(status);

  if (status === "accepted") {
    return <CheckCircle2 size={17} className={className} />;
  }

  if (status === "declined" || status === "withdrawn") {
    return <XCircle size={17} className={className} />;
  }

  return <Clock3 size={17} className={className} />;
}

function statusIconClass(status: InterestStatus) {
  if (status === "accepted") {
    return "text-emerald-600";
  }

  if (status === "declined" || status === "withdrawn") {
    return "text-rose-600";
  }

  if (status === "waitlist") {
    return "text-yellow-600";
  }

  return "text-amber-600";
}
