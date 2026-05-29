"use client";

import { useEffect, useState } from "react";
import { Send } from "lucide-react";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";

type InterestButtonProps = {
  opportunityId: string;
  disabled?: boolean;
};

export function InterestButton({ opportunityId, disabled }: InterestButtonProps) {
  const [hasInterest, setHasInterest] = useState(false);
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
        .select("id")
        .eq("opportunity_id", opportunityId)
        .eq("athlete_id", user.id)
        .maybeSingle();

      setHasInterest(Boolean(data));
    }

    void loadInterest();
  }, [opportunityId]);

  async function sendInterest() {
    setIsLoading(true);
    setError("");
    setMessage("");

    const supabase = createSupabaseBrowserClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      setError("Please log in again.");
      setIsLoading(false);
      return;
    }

    const { error: insertError } = await supabase
      .from("opportunity_interests")
      .insert({
        opportunity_id: opportunityId,
        athlete_id: user.id,
        status: "pending",
      });

    setIsLoading(false);

    if (insertError) {
      if (insertError.code === "23505") {
        setHasInterest(true);
        setMessage("Your interest was already sent.");
        return;
      }
      setError(insertError.message);
      return;
    }

    setHasInterest(true);
    setMessage("Your interest was sent. The coach can contact you directly.");
  }

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
      <button
        type="button"
        disabled={disabled || hasInterest || isLoading}
        onClick={sendInterest}
        className="flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-sky-600 px-4 text-sm font-bold text-white shadow-sm transition hover:bg-sky-700 disabled:cursor-not-allowed disabled:bg-slate-300"
      >
        <Send size={18} />
        {hasInterest ? "Interest sent" : isLoading ? "Sending..." : "I'm interested"}
      </button>
      <p className="mt-3 text-center text-sm leading-6 text-slate-600">
        {message ||
          (hasInterest
            ? "Your interest was sent. The coach can contact you directly."
            : "Share your contact details with the coach or organizer.")}
      </p>
      {error ? (
        <p className="mt-3 rounded-xl bg-rose-50 p-3 text-sm font-semibold text-rose-700">
          {error}
        </p>
      ) : null}
    </div>
  );
}
