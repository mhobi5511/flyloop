"use client";

import { useState } from "react";
import { Share2 } from "lucide-react";

type ShareOpportunityButtonProps = {
  label: string;
  shareText: string;
  url: string;
  compact?: boolean;
};

export function ShareOpportunityButton({
  label,
  shareText,
  url,
  compact = false,
}: ShareOpportunityButtonProps) {
  const [message, setMessage] = useState("");

  async function share() {
    setMessage("");

    try {
      const absoluteUrl = new URL(url, window.location.origin).toString();
      const useNativeShare =
        Boolean(navigator.share) &&
        window.matchMedia?.("(pointer: coarse)").matches;

      if (useNativeShare) {
        await navigator.share({
          title: label,
          text: shareText,
          url: absoluteUrl,
        });
      } else {
        await navigator.clipboard.writeText(`${shareText}\n\n${absoluteUrl}`);
        setMessage("Link copied.");
      }
    } catch (error) {
      if (error instanceof DOMException && error.name === "AbortError") {
        return;
      }

      console.error("Opportunity share failed", error);
      try {
        const absoluteUrl = new URL(url, window.location.origin).toString();
        await navigator.clipboard.writeText(absoluteUrl);
        setMessage("Link copied.");
      } catch (clipboardError) {
        console.error("Opportunity link copy failed", clipboardError);
      }
    }
  }

  return (
    <div className="grid gap-1">
      <button
        type="button"
        onClick={share}
        className={`inline-flex items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white font-bold text-slate-700 shadow-sm transition hover:bg-slate-50 ${
          compact ? "h-10 px-3 text-sm" : "h-11 px-4 text-sm"
        }`}
      >
        <Share2 size={16} /> {label}
      </button>
      {message ? (
        <p className="text-center text-xs font-bold text-sky-700">{message}</p>
      ) : null}
    </div>
  );
}
