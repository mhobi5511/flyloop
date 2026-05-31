"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { deleteOpportunity } from "@/app/app/opportunities/actions";

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
    <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-1">
      <Link
        href={`/app/organizer/opportunities/${opportunityId}/edit`}
        className="flex h-10 items-center justify-center rounded-xl bg-sky-600 px-3 text-sm font-bold text-white transition hover:bg-sky-700"
      >
        Edit Opportunity
      </Link>
      <button
        type="button"
        disabled={isPending}
        onClick={remove}
        className="flex h-10 w-full items-center justify-center rounded-xl border border-rose-200 px-3 text-sm font-bold text-rose-700 transition hover:bg-rose-50 disabled:text-slate-400"
      >
        {isPending ? "Working..." : "Delete Opportunity"}
      </button>
      {message ? (
        <p className="rounded-xl bg-sky-50 p-3 text-sm font-semibold text-sky-700 sm:col-span-2 lg:col-span-1">
          {message}
        </p>
      ) : null}
      {error ? (
        <p className="rounded-xl bg-rose-50 p-3 text-sm font-semibold text-rose-700 sm:col-span-2 lg:col-span-1">
          {error}
        </p>
      ) : null}
    </div>
  );
}
