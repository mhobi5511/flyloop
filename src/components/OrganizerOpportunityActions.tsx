"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  cancelOpportunity,
  deleteOpportunity,
} from "@/app/app/opportunities/actions";

type OrganizerOpportunityActionsProps = {
  opportunityId: string;
};

export function OrganizerOpportunityActions({
  opportunityId,
}: OrganizerOpportunityActionsProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  function cancel() {
    const confirmed = window.confirm(
      "Cancel this opportunity? It will stop appearing as open, but applicant history stays available.",
    );

    if (!confirmed) {
      return;
    }

    setMessage("");
    setError("");

    startTransition(async () => {
      const result = await cancelOpportunity(opportunityId);

      if (!result.ok) {
        setError(result.message);
        return;
      }

      setMessage(result.message);
      router.push("/app/dashboard");
      router.refresh();
    });
  }

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
    <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
      <Link
        href={`/app/organizer/opportunities/${opportunityId}/edit`}
        className="flex h-12 items-center justify-center rounded-xl bg-sky-600 px-4 text-sm font-bold text-white transition hover:bg-sky-700"
      >
        Edit opportunity
      </Link>
      <button
        type="button"
        disabled={isPending}
        onClick={cancel}
        className="mt-3 flex h-12 w-full items-center justify-center rounded-xl border border-amber-200 px-4 text-sm font-bold text-amber-700 transition hover:bg-amber-50 disabled:text-slate-400"
      >
        {isPending ? "Cancelling..." : "Cancel opportunity"}
      </button>
      <button
        type="button"
        disabled={isPending}
        onClick={remove}
        className="mt-3 flex h-12 w-full items-center justify-center rounded-xl border border-rose-200 px-4 text-sm font-bold text-rose-700 transition hover:bg-rose-50 disabled:text-slate-400"
      >
        {isPending ? "Working..." : "Delete opportunity"}
      </button>
      {message ? (
        <p className="mt-3 rounded-xl bg-sky-50 p-3 text-sm font-semibold text-sky-700">
          {message}
        </p>
      ) : null}
      {error ? (
        <p className="mt-3 rounded-xl bg-rose-50 p-3 text-sm font-semibold text-rose-700">
          {error}
        </p>
      ) : null}
    </div>
  );
}
