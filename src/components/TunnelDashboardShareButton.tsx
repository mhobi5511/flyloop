"use client";

import { useId, useState } from "react";
import { Clipboard, Mail, MessageCircle, Share2 } from "lucide-react";

type TunnelDashboardShareButtonProps = {
  message: string;
  subject: string;
};

export function TunnelDashboardShareButton({
  message,
  subject,
}: TunnelDashboardShareButtonProps) {
  const titleId = useId();
  const [isOpen, setIsOpen] = useState(false);
  const [status, setStatus] = useState("");
  const whatsappUrl = `https://wa.me/?text=${encodeURIComponent(message)}`;
  const emailUrl = `mailto:?subject=${encodeURIComponent(
    subject,
  )}&body=${encodeURIComponent(message)}`;

  async function copyMessage() {
    setStatus("");

    try {
      await navigator.clipboard.writeText(message);
      setStatus("Message copied.");
      window.setTimeout(() => {
        setIsOpen(false);
        setStatus("");
      }, 700);
    } catch (error) {
      console.error("Tunnel dashboard message copy failed", error);
      setStatus("Could not copy message.");
    }
  }

  function completeShareAction() {
    window.setTimeout(() => {
      setIsOpen(false);
      setStatus("");
    }, 300);
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setIsOpen(true)}
        className="inline-flex h-10 w-full min-w-0 items-center justify-center gap-2 rounded-xl bg-sky-600 px-3 text-sm font-bold text-white shadow-sm transition hover:bg-sky-700"
      >
        <Share2 size={16} className="shrink-0" />
        <span className="truncate">Share with Tunnel</span>
      </button>

      {isOpen ? (
        <div
          className="fixed inset-0 z-50 grid place-items-center bg-slate-950/40 p-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby={titleId}
        >
          <div className="w-full max-w-sm rounded-2xl bg-white p-4 shadow-xl">
            <div className="flex items-start justify-between gap-3">
              <div>
                <h2 id={titleId} className="text-lg font-black text-slate-950">
                  Share with Tunnel
                </h2>
                <p className="mt-1 text-sm font-semibold text-slate-500">
                  Choose how to send the operations dashboard.
                </p>
              </div>
              <button
                type="button"
                onClick={() => {
                  setIsOpen(false);
                  setStatus("");
                }}
                className="rounded-lg px-2 py-1 text-sm font-black text-slate-500 hover:bg-slate-100"
              >
                Close
              </button>
            </div>

            <div className="mt-4 grid gap-2">
              <button
                type="button"
                onClick={copyMessage}
                className="inline-flex h-11 items-center justify-center gap-2 rounded-xl bg-slate-950 px-3 text-sm font-black text-white hover:bg-slate-800"
              >
                <Clipboard size={16} />
                Copy message
              </button>
              <a
                href={whatsappUrl}
                target="_blank"
                rel="noreferrer"
                onClick={completeShareAction}
                className="inline-flex h-11 items-center justify-center gap-2 rounded-xl bg-emerald-500 px-3 text-sm font-black text-white hover:bg-emerald-600"
              >
                <MessageCircle size={16} />
                Share via WhatsApp
              </a>
              <a
                href={emailUrl}
                onClick={completeShareAction}
                className="inline-flex h-11 items-center justify-center gap-2 rounded-xl border border-slate-200 px-3 text-sm font-black text-slate-700 hover:bg-slate-50"
              >
                <Mail size={16} />
                Share via Email
              </a>
            </div>

            {status ? (
              <p className="mt-3 text-center text-sm font-bold text-sky-700">
                {status}
              </p>
            ) : null}
          </div>
        </div>
      ) : null}
    </>
  );
}
