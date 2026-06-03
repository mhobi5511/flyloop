"use client";

import { useState } from "react";
import { Share2 } from "lucide-react";

type ShareOpportunityButtonProps = {
  label: string;
  shareText: string;
  url: string;
  compact?: boolean;
  fill?: boolean;
  variant?: "secondary" | "primary";
};

export function ShareOpportunityButton({
  label,
  shareText,
  url,
  compact = false,
  fill = false,
  variant = "secondary",
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
          text: removeTrailingUrl(shareText, absoluteUrl),
          url: absoluteUrl,
        });
      } else {
        await navigator.clipboard.writeText(shareText);
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
    <div className={`grid min-w-0 gap-1 ${fill ? "w-full" : ""}`}>
      <button
        type="button"
        onClick={share}
        className={`inline-flex items-center justify-center gap-2 rounded-xl font-bold shadow-sm transition ${
          variant === "primary"
            ? "bg-sky-600 text-white hover:bg-sky-700"
            : "border border-slate-200 bg-white text-slate-700 hover:bg-slate-50"
        } ${compact ? "h-10 px-3 text-sm" : "h-11 px-4 text-sm"} ${fill ? "w-full min-w-0" : ""}`}
      >
        <Share2 size={16} className="shrink-0" />
        <span className="truncate">{label}</span>
      </button>
      {message ? (
        <p className="text-center text-xs font-bold text-sky-700">{message}</p>
      ) : null}
    </div>
  );
}

function removeTrailingUrl(text: string, url: string) {
  const lines = text.split("\n");
  const lastNonEmptyIndex = lines.findLastIndex((line) => line.trim().length > 0);

  if (lastNonEmptyIndex === -1 || lines[lastNonEmptyIndex].trim() !== url) {
    return text;
  }

  return lines.slice(0, lastNonEmptyIndex).join("\n");
}
