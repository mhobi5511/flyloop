"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  approveCampRemovalRequest,
  keepCampParticipant,
} from "@/app/app/organizer/opportunities/actions";

type CampRemovalRequestActionsProps = {
  interestId: string;
};

export function CampRemovalRequestActions({
  interestId,
}: CampRemovalRequestActionsProps) {
  const router = useRouter();
  const [error, setError] = useState("");
  const [isPending, startTransition] = useTransition();

  function resolve(decision: "approve" | "keep") {
    setError("");

    if (
      decision === "approve" &&
      !window.confirm(
        "Approve removal and release all booked times for this participant?",
      )
    ) {
      return;
    }

    startTransition(async () => {
      const result =
        decision === "approve"
          ? await approveCampRemovalRequest(interestId)
          : await keepCampParticipant(interestId);

      if (!result.ok) {
        setError(result.message);
        return;
      }

      router.refresh();
    });
  }

  return (
    <div className="grid gap-1.5">
      <div className="flex flex-wrap gap-1.5">
        <button
          type="button"
          disabled={isPending}
          onClick={() => resolve("approve")}
          className="h-8 rounded-lg bg-rose-600 px-2.5 text-xs font-black text-white transition hover:bg-rose-700 disabled:cursor-not-allowed disabled:bg-rose-200"
        >
          Approve removal
        </button>
        <button
          type="button"
          disabled={isPending}
          onClick={() => resolve("keep")}
          className="h-8 rounded-lg border border-slate-200 px-2.5 text-xs font-black text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:bg-slate-100 disabled:text-slate-400"
        >
          Keep participant
        </button>
      </div>
      {error ? (
        <p className="rounded-lg bg-rose-50 p-2 text-xs font-semibold text-rose-700">
          {error}
        </p>
      ) : null}
    </div>
  );
}
