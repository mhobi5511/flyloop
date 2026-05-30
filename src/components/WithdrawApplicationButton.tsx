"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { withdrawApplication } from "@/app/app/applications/actions";

type WithdrawApplicationButtonProps = {
  interestId: string;
};

export function WithdrawApplicationButton({
  interestId,
}: WithdrawApplicationButtonProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState("");

  function withdraw() {
    setError("");

    if (!window.confirm("Withdraw your interest for this opportunity?")) {
      return;
    }

    startTransition(async () => {
      const result = await withdrawApplication(interestId);

      if (!result.ok) {
        setError(result.message);
        return;
      }

      router.refresh();
    });
  }

  return (
    <div>
      <button
        type="button"
        disabled={isPending}
        onClick={withdraw}
        className="h-10 rounded-xl border border-slate-200 px-4 text-sm font-bold text-slate-700 transition hover:bg-slate-50 disabled:text-slate-400"
      >
        {isPending ? "Withdrawing..." : "Withdraw interest"}
      </button>
      {error ? (
        <p className="mt-2 rounded-xl bg-rose-50 p-3 text-sm font-semibold text-rose-700">
          {error}
        </p>
      ) : null}
    </div>
  );
}
