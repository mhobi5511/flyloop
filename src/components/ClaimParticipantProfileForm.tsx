"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { CheckCircle2 } from "lucide-react";
import { claimParticipantProfile } from "@/app/app/organizer/opportunities/actions";

export function ClaimParticipantProfileForm({ token }: { token: string }) {
  const router = useRouter();
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [isPending, startTransition] = useTransition();

  function claimProfile() {
    setMessage("");
    setError("");

    startTransition(async () => {
      const result = await claimParticipantProfile(token);

      if (!result.ok) {
        setError(result.message);
        return;
      }

      setMessage(result.message);
      router.refresh();
      window.setTimeout(() => {
        router.push("/app/dashboard");
      }, 800);
    });
  }

  return (
    <div className="grid gap-3">
      <button
        type="button"
        onClick={claimProfile}
        disabled={isPending}
        className="inline-flex h-11 items-center justify-center gap-2 rounded-xl bg-sky-600 px-4 text-sm font-black text-white transition hover:bg-sky-700 disabled:bg-slate-300"
      >
        <CheckCircle2 size={17} />
        {isPending ? "Claiming..." : "Claim Profile"}
      </button>
      {message ? (
        <p className="rounded-xl bg-emerald-50 px-3 py-2 text-sm font-bold text-emerald-700">
          {message}
        </p>
      ) : null}
      {error ? (
        <p className="rounded-xl bg-rose-50 px-3 py-2 text-sm font-bold text-rose-700">
          {error}
        </p>
      ) : null}
    </div>
  );
}
