"use client";

import { useState } from "react";
import { Copy, Mail, MessageCircleMore, Share2, X } from "lucide-react";
import { useRouter } from "next/navigation";
import {
  ensureTunnelDashboardLink,
  markTunnelDashboardShared,
} from "@/app/app/organizer/opportunities/actions";

type TunnelDashboardShareButtonProps = {
  opportunityId: string;
  opportunityTitle: string;
  tunnelSharedAt: string | null;
  label?: string;
  compact?: boolean;
  fill?: boolean;
};

export function TunnelDashboardShareButton({
  opportunityId,
  opportunityTitle,
  tunnelSharedAt,
  label,
  compact = false,
  fill = false,
}: TunnelDashboardShareButtonProps) {
  const [message, setMessage] = useState("");
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isSharing, setIsSharing] = useState(false);
  const [isShared, setIsShared] = useState(Boolean(tunnelSharedAt));
  const router = useRouter();

  async function resolveTunnelDashboardUrl() {
    const result = await ensureTunnelDashboardLink(opportunityId);

    if (!result.ok) {
      setMessage(result.message);
      return null;
    }

    return result.tunnelDashboardUrl;
  }

  async function markShared() {
    const result = await markTunnelDashboardShared(opportunityId);

    if (!result.ok) {
      setMessage(result.message);
      return false;
    }

    setIsShared(true);
    router.refresh();
    return true;
  }

  async function copyLink() {
    if (isSharing) {
      return;
    }

    setMessage("");
    setIsSharing(true);

    try {
      const tunnelDashboardUrl = await resolveTunnelDashboardUrl();

      if (!tunnelDashboardUrl) {
        return;
      }

      await navigator.clipboard.writeText(tunnelDashboardUrl);

      const shared = await markShared();
      if (!shared) {
        return;
      }

      setMessage("Tunnel dashboard link copied.");
      setIsModalOpen(false);
    } catch (error) {
      console.error("Tunnel dashboard copy failed", error);
      setMessage("Could not copy the tunnel dashboard link.");
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
      const tunnelDashboardUrl = await resolveTunnelDashboardUrl();

      if (!tunnelDashboardUrl) {
        return;
      }

      const text = [
        "Hi,",
        "",
        `Here is the Flyloop Tunnel Dashboard for ${opportunityTitle}:`,
        "",
        tunnelDashboardUrl,
        "",
        "The dashboard always shows the latest athlete information and timetable.",
        "",
        "No manual updates are required.",
      ].join("\n");

      const whatsappUrl = `https://wa.me/?text=${encodeURIComponent(text)}`;
      const popup = window.open(whatsappUrl, "_blank", "noopener,noreferrer");

      if (!popup) {
        setMessage("Could not open WhatsApp.");
        return;
      }

      const shared = await markShared();
      if (!shared) {
        return;
      }

      setMessage("WhatsApp opened.");
      setIsModalOpen(false);
    } catch (error) {
      console.error("Tunnel dashboard WhatsApp share failed", error);
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
      const tunnelDashboardUrl = await resolveTunnelDashboardUrl();

      if (!tunnelDashboardUrl) {
        return;
      }

      const subject = encodeURIComponent("Flyloop Tunnel Dashboard");
      const body = encodeURIComponent(
        [
          "Hello,",
          "",
          `Here is the Flyloop Tunnel Dashboard for ${opportunityTitle}:`,
          "",
          tunnelDashboardUrl,
          "",
          "The dashboard always contains the latest athlete information and timetable.",
          "",
          "Best regards",
        ].join("\n"),
      );

      window.location.href = `mailto:?subject=${subject}&body=${body}`;

      const shared = await markShared();
      if (!shared) {
        return;
      }

      setMessage("Email opened.");
      setIsModalOpen(false);
    } catch (error) {
      console.error("Tunnel dashboard email share failed", error);
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
        disabled={isSharing}
        className={`inline-flex items-center justify-center gap-2 rounded-xl font-bold shadow-sm transition disabled:cursor-not-allowed disabled:bg-slate-200 disabled:text-slate-500 ${
          isShared
            ? "border border-amber-200 bg-amber-50 text-amber-800 hover:bg-amber-100"
            : "bg-sky-600 text-white hover:bg-sky-700"
        } ${compact ? "h-10 px-3 text-sm" : "h-11 px-4 text-sm"} ${fill ? "w-full min-w-0" : ""}`}
      >
        <Share2 size={16} className="shrink-0" />
        <span className="truncate">{isSharing ? "Sharing..." : label ?? "Share"}</span>
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
                  Share Tunnel Dashboard
                </h2>
                <p className="mt-1 text-sm font-semibold leading-5 text-slate-600">
                  Choose how you want to send the live tunnel dashboard link.
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
                    Copy the tunnel dashboard URL directly into the clipboard.
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
