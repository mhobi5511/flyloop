"use client";

import { createPortal } from "react-dom";
import { X } from "lucide-react";

import { Avatar } from "@/components/Avatar";
import {
  formatInterestStatusLabel,
  type Participant,
} from "@/components/coach-dashboard-shared";

export function ParticipantProfileModal({
  participant,
  onClose,
}: {
  participant: Participant;
  onClose: () => void;
}) {
  return typeof document !== "undefined"
    ? createPortal(
        <div
          className="fixed inset-0 z-[60] grid place-items-center bg-slate-950/50 p-4"
          role="dialog"
          aria-modal="true"
          onClick={onClose}
        >
          <section
            className="grid max-h-[calc(100dvh-2rem)] w-full max-w-3xl overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-2xl"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="flex items-center justify-between gap-3 border-b border-slate-200 px-4 py-4 sm:px-6">
              <div>
                <p className="text-[0.68rem] font-black uppercase tracking-[0.16em] text-sky-700">
                  Participant Profile
                </p>
                <h2 className="mt-1 text-lg font-black tracking-tight text-slate-950">
                  {participant.name}
                </h2>
              </div>
              <button
                type="button"
                onClick={onClose}
                className="grid size-9 place-items-center rounded-lg border border-slate-200 text-slate-500"
                aria-label="Close profile"
              >
                <X size={17} />
              </button>
            </div>
            <div className="grid gap-5 overflow-y-auto p-4 sm:p-6">
              <div className="flex flex-wrap items-start gap-4 rounded-3xl bg-slate-50 p-4">
                <Avatar
                  name={participant.name}
                  imageUrl={participant.profileImageUrl}
                  size="lg"
                />
                <div className="min-w-0 flex-1">
                  <h3 className="text-2xl font-black tracking-tight text-slate-950">
                    {participant.name}
                  </h3>
                  <p className="mt-1 text-sm font-semibold text-slate-600">
                    {participant.country || "No country provided"}
                  </p>
                  <div className="mt-3 flex flex-wrap gap-2 text-sm font-bold text-slate-700">
                    {participant.instagramHandle ? (
                      <span className="rounded-full border border-slate-200 bg-white px-3 py-1">
                        Instagram: @{cleanHandle(participant.instagramHandle)}
                      </span>
                    ) : null}
                    {participant.phone ? (
                      <span className="rounded-full border border-slate-200 bg-white px-3 py-1">
                        Phone: {participant.phone}
                      </span>
                    ) : null}
                    {participant.city ? (
                      <span className="rounded-full border border-slate-200 bg-white px-3 py-1">
                        City: {participant.city}
                      </span>
                    ) : null}
                  </div>
                </div>
              </div>

              <div className="grid gap-5 lg:grid-cols-[minmax(0,1.2fr)_minmax(18rem,0.8fr)]">
                <div className="grid gap-5">
                  <section className="rounded-2xl border border-slate-200 bg-white p-4">
                    <h3 className="text-sm font-black uppercase tracking-[0.14em] text-slate-500">
                      Bio
                    </h3>
                    <p className="mt-2 text-sm leading-6 text-slate-700">
                      {participant.bio?.trim() || "This participant has not added a bio yet."}
                    </p>
                  </section>
                  <section className="rounded-2xl border border-slate-200 bg-white p-4">
                    <h3 className="text-sm font-black uppercase tracking-[0.14em] text-slate-500">
                      Stats
                    </h3>
                    <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-4">
                      <CompactMetric
                        label="Flyloop Minutes"
                        value={String(participant.profileStats?.flyloopMinutes ?? 0)}
                      />
                      <CompactMetric
                        label="Flyloop Hours"
                        value={String(participant.profileStats?.flyloopHours ?? 0)}
                      />
                      <CompactMetric
                        label="Camps Attended"
                        value={String(participant.profileStats?.campsAttended ?? 0)}
                      />
                      <CompactMetric
                        label="Huck Jams"
                        value={String(participant.profileStats?.huckJamsAttended ?? 0)}
                      />
                    </div>
                  </section>
                </div>

                <div className="grid gap-5">
                  <section className="rounded-2xl border border-slate-200 bg-white p-4">
                    <h3 className="text-sm font-black uppercase tracking-[0.14em] text-slate-500">
                      Application Information
                    </h3>
                    <div className="mt-3 grid gap-2 text-sm font-semibold text-slate-700">
                      <p>Status: {formatInterestStatusLabel(participant.status)}</p>
                      <p>
                        Self Booking: {participant.selfBookingEnabled ? "On" : "Off"}
                      </p>
                      <p>
                        Tunnel Time:{" "}
                        {participant.tunnelTimeStatus === "owns_tunnel_time"
                          ? "Available"
                          : participant.tunnelTimeStatus === "needs_tunnel_time"
                            ? "Not available"
                            : "Not provided"}
                      </p>
                      <p>
                        Tunnel Account Email: {participant.tunnelAccountEmail || "Not provided"}
                      </p>
                    </div>
                  </section>

                  <section className="rounded-2xl border border-slate-200 bg-white p-4">
                    <h3 className="text-sm font-black uppercase tracking-[0.14em] text-slate-500">
                      Links
                    </h3>
                    <div className="mt-3 grid gap-2">
                      {participant.instagramHandle ? (
                        <a
                          href={`https://instagram.com/${cleanHandle(participant.instagramHandle)}`}
                          target="_blank"
                          rel="noreferrer"
                          className="inline-flex h-10 items-center justify-center rounded-xl border border-slate-200 px-3 text-sm font-black text-slate-700 hover:bg-slate-50"
                        >
                          Instagram
                        </a>
                      ) : null}
                      {participant.websiteUrl ? (
                        <a
                          href={participant.websiteUrl}
                          target="_blank"
                          rel="noreferrer"
                          className="inline-flex h-10 items-center justify-center rounded-xl border border-slate-200 px-3 text-sm font-black text-slate-700 hover:bg-slate-50"
                        >
                          Website
                        </a>
                      ) : null}
                      {participant.youtubeUrl ? (
                        <a
                          href={participant.youtubeUrl}
                          target="_blank"
                          rel="noreferrer"
                          className="inline-flex h-10 items-center justify-center rounded-xl border border-slate-200 px-3 text-sm font-black text-slate-700 hover:bg-slate-50"
                        >
                          YouTube
                        </a>
                      ) : null}
                    </div>
                  </section>
                </div>
              </div>
            </div>
          </section>
        </div>,
        document.body,
      )
    : null;
}

function CompactMetric({
  label,
  value,
  tone = "slate",
}: {
  label: string;
  value: string;
  tone?: "slate" | "success";
}) {
  const toneStyles =
    tone === "success"
      ? "border-emerald-200 bg-emerald-50 text-emerald-700"
      : "border-slate-200 bg-slate-50 text-slate-700";

  return (
    <div className={`rounded-xl border px-3 py-2 ${toneStyles}`}>
      <p className="text-[0.64rem] font-black uppercase tracking-[0.12em] text-slate-400">
        {label}
      </p>
      <p className="mt-1 text-sm font-black text-slate-950">{value}</p>
    </div>
  );
}

function cleanHandle(value: string) {
  return value.replace(/^@/, "").trim();
}

