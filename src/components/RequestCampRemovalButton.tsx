"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { requestCampRemoval } from "@/app/app/applications/actions";

type RequestCampRemovalButtonProps = {
  interestId: string;
  initialRequested: boolean;
  embedded?: boolean;
};

export function RequestCampRemovalButton({
  interestId,
  initialRequested,
  embedded = false,
}: RequestCampRemovalButtonProps) {
  const router = useRouter();
  const [requested, setRequested] = useState(initialRequested);
  const [message, setMessage] = useState(
    initialRequested
      ? "You asked the organizer to remove you from this Camp."
      : "",
  );
  const [error, setError] = useState("");
  const [isPending, startTransition] = useTransition();

  function submitRequest() {
    if (requested || isPending) {
      return;
    }

    const confirmed = window.confirm(
      "Do you want to ask the organizer to remove you from this Camp?",
    );

    if (!confirmed) {
      return;
    }

    setError("");
    startTransition(async () => {
      const result = await requestCampRemoval(interestId);

      if (!result.ok) {
        setError(result.message);
        return;
      }

      setRequested(true);
      setMessage("You asked the organizer to remove you from this Camp.");
      router.refresh();
    });
  }

  return (
    <div
      className={
        embedded
          ? "grid gap-2"
          : "mt-3 grid gap-2 rounded-2xl border border-slate-200 bg-white p-3"
      }
    >
      <button
        type="button"
        disabled={requested || isPending}
        onClick={submitRequest}
        className={`h-10 rounded-xl border px-4 text-sm font-black transition disabled:cursor-not-allowed ${
          requested
            ? "border-slate-200 bg-slate-100 text-slate-500"
            : "border-slate-300 text-slate-700 hover:bg-slate-50"
        }`}
      >
        {requested ? "Removal requested" : "Request to leave Camp"}
      </button>
      {message ? (
        <p className="text-sm font-semibold leading-5 text-slate-600">{message}</p>
      ) : null}
      {error ? (
        <p className="rounded-lg bg-rose-50 p-2 text-sm font-bold text-rose-700">
          {error}
        </p>
      ) : null}
    </div>
  );
}
