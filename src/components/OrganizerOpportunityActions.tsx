"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import { Trash2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { deleteOpportunity } from "@/app/app/opportunities/actions";
import { ShareOpportunityButton } from "./ShareOpportunityButton";
import { TunnelDashboardShareButton } from "./TunnelDashboardShareButton";

type OrganizerOpportunityActionsProps = {
  opportunityId: string;
  opportunityTitle: string;
  shareLabel: string;
  shareText: string;
  shareUrl: string;
  tunnelSharedAt: string | null;
  hasTimetable: boolean;
  showTimetable?: boolean;
};

export function OrganizerOpportunityActions({
  opportunityId,
  opportunityTitle,
  shareLabel,
  shareText,
  shareUrl,
  tunnelSharedAt,
  hasTimetable,
  showTimetable = true,
}: OrganizerOpportunityActionsProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  function remove() {
    const confirmed = window.confirm(
      "Delete this opportunity? This permanently removes the opportunity and applicant history.",
    );

    if (!confirmed) {
      return;
    }

    setMessage("");
    setError("");

    startTransition(async () => {
      const result = await deleteOpportunity(opportunityId);

      if (!result.ok) {
        setError(result.message);
        return;
      }

      setMessage(result.message);
      router.push("/app/dashboard");
      router.refresh();
    });
  }

  return (
    <div className="grid gap-2">
      <Link
        href={`/app/organizer/opportunities/${opportunityId}/edit`}
        className="flex h-10 items-center justify-center rounded-xl bg-sky-600 px-3 text-sm font-bold text-white transition hover:bg-sky-700"
      >
        Edit Opportunity
      </Link>
      {showTimetable ? (
        <Link
          href={`/app/organizer/opportunities/${opportunityId}/timetable`}
          className="flex h-10 items-center justify-center rounded-xl border border-sky-200 bg-sky-50 px-3 text-sm font-bold text-sky-700 transition hover:bg-sky-100"
        >
          {hasTimetable ? "Edit Timetable" : "Set Timetable"}
        </Link>
      ) : null}
      <TunnelDashboardShareButton
        opportunityId={opportunityId}
        opportunityTitle={opportunityTitle}
        tunnelSharedAt={tunnelSharedAt}
      />
      <div className="grid grid-cols-[minmax(0,1fr)_auto] gap-2">
        <ShareOpportunityButton
          label={shareLabel}
          shareText={shareText}
          url={shareUrl}
          compact
          fill
        />
        <button
          type="button"
          disabled={isPending}
          onClick={remove}
          title="Delete Opportunity"
          className="flex h-10 min-w-10 items-center justify-center gap-1.5 rounded-xl border border-rose-200 px-2 text-sm font-bold text-rose-700 transition hover:bg-rose-50 disabled:text-slate-400 sm:px-3"
        >
          <Trash2 size={16} />
          <span className="sr-only sm:not-sr-only">
            {isPending ? "Working..." : "Delete Opportunity"}
          </span>
        </button>
      </div>
      {message ? (
        <p className="rounded-xl bg-sky-50 p-3 text-sm font-semibold text-sky-700">
          {message}
        </p>
      ) : null}
      {error ? (
        <p className="rounded-xl bg-rose-50 p-3 text-sm font-semibold text-rose-700">
          {error}
        </p>
      ) : null}
    </div>
  );
}
