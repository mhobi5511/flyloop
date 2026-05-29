"use client";

import { useState } from "react";
import { Send } from "lucide-react";
import { currentAthlete } from "@/lib/demo-data";
import { createInterest } from "@/lib/demo-store";
import { useDemoState } from "@/lib/use-demo-state";

type InterestButtonProps = {
  opportunityId: string;
  disabled?: boolean;
};

export function InterestButton({ opportunityId, disabled }: InterestButtonProps) {
  const [state, setState] = useDemoState();
  const [sent, setSent] = useState(false);
  const alreadyInterested = state.interests.some(
    (interest) =>
      interest.opportunityId === opportunityId &&
      interest.athleteId === currentAthlete.id,
  );

  function sendInterest() {
    setState(createInterest(opportunityId));
    setSent(true);
  }

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
      <button
        type="button"
        disabled={disabled || sent || alreadyInterested}
        onClick={sendInterest}
        className="flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-sky-600 px-4 text-sm font-bold text-white shadow-sm transition hover:bg-sky-700 disabled:cursor-not-allowed disabled:bg-slate-300"
      >
        <Send size={18} />
        {sent || alreadyInterested ? "Interest sent" : "I'm interested"}
      </button>
      <p className="mt-3 text-center text-sm leading-6 text-slate-600">
        {sent || alreadyInterested
          ? "Your interest was sent. The coach can contact you directly."
          : "Share your contact details with the coach or organizer."}
      </p>
    </div>
  );
}
