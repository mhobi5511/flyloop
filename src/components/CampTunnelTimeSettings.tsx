"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { setCampTunnelTimeStatus } from "@/app/app/opportunities/actions";
import type { TunnelTimeStatus } from "@/lib/types";

type CampTunnelTimeSettingsProps = {
  opportunityId: string;
  initialStatus?: TunnelTimeStatus | null;
  initialAccountEmail?: string | null;
};

export function CampTunnelTimeSettings({
  opportunityId,
  initialStatus = null,
  initialAccountEmail = null,
}: CampTunnelTimeSettingsProps) {
  const router = useRouter();
  const [isEditing, setIsEditing] = useState(!initialStatus);
  const [status, setStatus] = useState<TunnelTimeStatus | "">(
    initialStatus ?? "",
  );
  const [accountEmail, setAccountEmail] = useState(initialAccountEmail ?? "");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [isPending, startTransition] = useTransition();

  function save() {
    setMessage("");
    setError("");

    const validationError = getTunnelTimeError(status, accountEmail);

    if (validationError) {
      setError(validationError);
      return;
    }

    startTransition(async () => {
      const result = await setCampTunnelTimeStatus(opportunityId, {
        status,
        accountEmail,
      });

      if (!result.ok) {
        setError(result.message);
        return;
      }

      setIsEditing(false);
      setMessage("Tunnel time status saved.");
      router.refresh();
    });
  }

  function cancel() {
    setStatus(initialStatus ?? "");
    setAccountEmail(initialAccountEmail ?? "");
    setError("");
    setMessage("");
    setIsEditing(false);
  }

  return (
    <section className="grid gap-3 rounded-2xl border border-slate-200 bg-white p-3">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h3 className="text-sm font-black text-slate-950">Tunnel Time</h3>
          <p className="mt-1 text-xs font-black uppercase text-slate-500">
            Current status
          </p>
          <p className="mt-0.5 text-sm font-semibold text-slate-700">
            {formatTunnelTimeStatus(initialStatus)}
          </p>
          {initialStatus === "owns_tunnel_time" && initialAccountEmail ? (
            <p className="mt-0.5 text-xs font-semibold text-slate-500">
              {initialAccountEmail}
            </p>
          ) : null}
        </div>
        {!isEditing ? (
          <button
            type="button"
            onClick={() => setIsEditing(true)}
            className="h-9 rounded-xl border border-slate-300 px-3 text-sm font-black text-slate-700 hover:bg-slate-50"
          >
            Edit
          </button>
        ) : null}
      </div>

      {isEditing ? (
        <div className="grid gap-3">
          <div className="grid gap-2">
            <label className="flex gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm font-bold text-slate-700">
              <input
                type="radio"
                name="manage-tunnel-time-status"
                value="owns_tunnel_time"
                checked={status === "owns_tunnel_time"}
                onChange={() => setStatus("owns_tunnel_time")}
                className="mt-1"
              />
              <span>Own tunnel time</span>
            </label>
            <label className="flex gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm font-bold text-slate-700">
              <input
                type="radio"
                name="manage-tunnel-time-status"
                value="needs_tunnel_time"
                checked={status === "needs_tunnel_time"}
                onChange={() => setStatus("needs_tunnel_time")}
                className="mt-1"
              />
              <span>Needs tunnel time</span>
            </label>
          </div>

          {status === "owns_tunnel_time" ? (
            <label className="grid gap-1 text-sm font-bold text-slate-700">
              Email address used for your tunnel account
              <input
                type="email"
                required
                value={accountEmail}
                onChange={(event) => setAccountEmail(event.target.value)}
                className="h-11 rounded-xl border border-slate-200 bg-white px-3 text-base font-semibold outline-none focus:border-sky-400"
                placeholder="name@example.com"
              />
              <span className="text-xs font-semibold leading-5 text-slate-500">
                Please enter the email address you used to buy or manage your
                tunnel time at this tunnel.
              </span>
            </label>
          ) : null}

          <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
            {initialStatus ? (
              <button
                type="button"
                onClick={cancel}
                className="h-10 rounded-xl bg-slate-100 px-4 text-sm font-black text-slate-700 hover:bg-slate-200"
              >
                Cancel
              </button>
            ) : null}
            <button
              type="button"
              disabled={isPending}
              onClick={save}
              className="h-10 rounded-xl bg-sky-600 px-4 text-sm font-black text-white hover:bg-sky-700 disabled:bg-slate-300"
            >
              {isPending ? "Saving..." : "Save Tunnel Time"}
            </button>
          </div>
        </div>
      ) : null}

      {message ? (
        <p className="text-sm font-semibold leading-5 text-emerald-700">{message}</p>
      ) : null}
      {error ? (
        <p className="rounded-lg bg-rose-50 p-2 text-sm font-bold text-rose-700">
          {error}
        </p>
      ) : null}
    </section>
  );
}

function formatTunnelTimeStatus(status?: TunnelTimeStatus | null) {
  if (status === "owns_tunnel_time") {
    return "Own tunnel time";
  }

  if (status === "needs_tunnel_time") {
    return "Needs tunnel time";
  }

  return "Not provided";
}

function getTunnelTimeError(
  status: TunnelTimeStatus | "",
  accountEmail: string,
) {
  if (!status) {
    return "Choose your tunnel time status.";
  }

  if (status === "owns_tunnel_time") {
    const email = accountEmail.trim().toLowerCase();

    if (!email) {
      return "Enter the email address used for your tunnel account.";
    }

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return "Enter a valid tunnel account email address.";
    }
  }

  return "";
}
