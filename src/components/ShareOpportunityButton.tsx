"use client";

import { useState } from "react";
import { Copy, Mail, MessageCircleMore, Share2, X } from "lucide-react";

type ShareOpportunityButtonProps = {
  label: string;
  shareText: string;
  url: string;
  copyUrlOnly?: boolean;
  compact?: boolean;
  fill?: boolean;
  variant?: "secondary" | "primary";
};

export function ShareOpportunityButton({
  label,
  shareText,
  url,
  copyUrlOnly = false,
  compact = false,
  fill = false,
  variant = "secondary",
}: ShareOpportunityButtonProps) {
  const [message, setMessage] = useState("");
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isSharing, setIsSharing] = useState(false);

  async function resolveOpportunityUrl() {
    return new URL(url, window.location.origin).toString();
  }

  async function copyLink() {
    if (isSharing) {
      return;
    }

    setMessage("");
    setIsSharing(true);

    try {
      const absoluteUrl = await resolveOpportunityUrl();
      await navigator.clipboard.writeText(absoluteUrl);
      setMessage("Opportunity link copied.");
      setIsModalOpen(false);
    } catch (error) {
      console.error("Opportunity copy failed", error);
      try {
        const absoluteUrl = await resolveOpportunityUrl();
        await navigator.clipboard.writeText(absoluteUrl);
        setMessage("Opportunity link copied.");
        setIsModalOpen(false);
      } catch (clipboardError) {
        console.error("Opportunity link copy failed", clipboardError);
        setMessage("Could not copy the opportunity link.");
      }
    } finally {
      setIsSharing(false);
    }
  }

  async function shareToWhatsApp() {
    if (isSharing) {
      return;
    }

    setMessage("");
    setIsSharing(true);

    try {
      const absoluteUrl = await resolveOpportunityUrl();
      const messageLines = copyUrlOnly
        ? [
            "Hi,",
            "",
            "Here is the Flyloop opportunity:",
            "",
            absoluteUrl,
          ]
        : removeTrailingUrl(shareText, absoluteUrl).split("\n");

      if (messageLines[messageLines.length - 1] !== absoluteUrl) {
        messageLines.push("");
        messageLines.push(absoluteUrl);
      }

      const whatsappUrl = `https://wa.me/?text=${encodeURIComponent(
        messageLines.join("\n"),
      )}`;
      const popup = window.open(whatsappUrl, "_blank", "noopener,noreferrer");

      if (!popup) {
        setMessage("Could not open WhatsApp.");
        return;
      }

      setMessage("WhatsApp opened.");
      setIsModalOpen(false);
    } catch (error) {
      console.error("Opportunity WhatsApp share failed", error);
      setMessage("Could not open WhatsApp.");
    } finally {
      setIsSharing(false);
    }
  }

  async function shareByEmail() {
    if (isSharing) {
      return;
    }

    setMessage("");
    setIsSharing(true);

    try {
      const absoluteUrl = await resolveOpportunityUrl();
      const subject = encodeURIComponent(label);
      const body = encodeURIComponent(
        [
          "Hello,",
          "",
          `Here is the Flyloop ${label.toLowerCase()} for this opportunity:`,
          "",
          absoluteUrl,
          "",
          "Best regards",
        ].join("\n"),
      );

      window.location.href = `mailto:?subject=${subject}&body=${body}`;
      setMessage("Email opened.");
      setIsModalOpen(false);
    } catch (error) {
      console.error("Opportunity email share failed", error);
      setMessage("Could not open email.");
    } finally {
      setIsSharing(false);
    }
  }

  return (
    <div className={`grid min-w-0 gap-1 ${fill ? "w-full" : ""}`}>
      <button
        type="button"
        onClick={() => setIsModalOpen(true)}
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
      {isModalOpen ? (
        <div
          className="fixed inset-0 z-50 grid place-items-center bg-slate-950/40 p-4"
          onClick={() => !isSharing && setIsModalOpen(false)}
        >
          <section
            className="w-full max-w-sm overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="flex items-start justify-between gap-3 border-b border-slate-200 px-4 py-3">
              <div className="min-w-0">
                <h2 className="text-base font-black tracking-tight">
                  Invite Athletes
                </h2>
                <p className="mt-1 text-sm font-semibold leading-5 text-slate-600">
                  Choose how you want to send the public opportunity link.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setIsModalOpen(false)}
                className="grid size-9 shrink-0 place-items-center rounded-lg border border-slate-200 text-slate-500 transition hover:bg-slate-50"
                aria-label="Close share modal"
              >
                <X size={16} />
              </button>
            </div>
            <div className="grid gap-2 p-3">
              <button
                type="button"
                onClick={copyLink}
                disabled={isSharing}
                className="flex items-center gap-3 rounded-xl border border-slate-200 bg-slate-50 px-3 py-3 text-left text-sm font-bold text-slate-900 transition hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-70"
              >
                <span className="grid size-9 place-items-center rounded-full bg-white text-slate-700 shadow-sm">
                  <Copy size={16} />
                </span>
                <span className="min-w-0">
                  <span className="block">Copy Link</span>
                  <span className="block text-xs font-semibold text-slate-500">
                    Copy the opportunity URL directly into the clipboard.
                  </span>
                </span>
              </button>
              <button
                type="button"
                onClick={shareToWhatsApp}
                disabled={isSharing}
                className="flex items-center gap-3 rounded-xl border border-slate-200 bg-slate-50 px-3 py-3 text-left text-sm font-bold text-slate-900 transition hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-70"
              >
                <span className="grid size-9 place-items-center rounded-full bg-white text-slate-700 shadow-sm">
                  <MessageCircleMore size={16} />
                </span>
                <span className="min-w-0">
                  <span className="block">WhatsApp</span>
                  <span className="block text-xs font-semibold text-slate-500">
                    Open WhatsApp with a prefilled message.
                  </span>
                </span>
              </button>
              <button
                type="button"
                onClick={shareByEmail}
                disabled={isSharing}
                className="flex items-center gap-3 rounded-xl border border-slate-200 bg-slate-50 px-3 py-3 text-left text-sm font-bold text-slate-900 transition hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-70"
              >
                <span className="grid size-9 place-items-center rounded-full bg-white text-slate-700 shadow-sm">
                  <Mail size={16} />
                </span>
                <span className="min-w-0">
                  <span className="block">Email</span>
                  <span className="block text-xs font-semibold text-slate-500">
                    Open the default mail app with a prefilled message.
                  </span>
                </span>
              </button>
            </div>
          </section>
        </div>
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
