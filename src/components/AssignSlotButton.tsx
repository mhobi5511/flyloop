"use client";

import { useState, useTransition } from "react";
import { UserPlus, X } from "lucide-react";
import { useRouter } from "next/navigation";
import { assignParticipantSlotBooking } from "@/app/app/organizer/opportunities/actions";

export type AssignSlotParticipant = {
  id: string;
  name: string;
  bookedMinutes: number;
  dayLabel?: string;
  dayAssignedMinutes?: number;
  dayPreferredMinutes?: number | null;
  dayRemainingMinutes?: number | null;
  dayOverAssignedMinutes?: number | null;
  dayProgressPercent?: number | null;
  dayStatus?:
    | "complete"
    | "needs_time"
    | "over_assigned"
    | "no_flying"
    | "no_preference";
};

type AssignSlotButtonProps = {
  opportunityId: string;
  slotId: string;
  participants: AssignSlotParticipant[];
};

export function AssignSlotButton({
  opportunityId,
  slotId,
  participants,
}: AssignSlotButtonProps) {
  const router = useRouter();
  const [isOpen, setIsOpen] = useState(false);
  const [toast, setToast] = useState("");
  const [error, setError] = useState("");
  const [pendingParticipantId, setPendingParticipantId] = useState("");
  const [isPending, startTransition] = useTransition();
  const dayLabel = participants[0]?.dayLabel ?? "Selected day";

  function openModal() {
    setError("");
    setToast("");
    setPendingParticipantId("");
    setIsOpen(true);
  }

  function assignSlot(participantId: string) {
    setError("");

    startTransition(async () => {
      let result: Awaited<ReturnType<typeof assignParticipantSlotBooking>>;

      try {
        setPendingParticipantId(participantId);
        result = await assignParticipantSlotBooking(
          opportunityId,
          slotId,
          participantId,
        );
      } catch (assignError) {
        console.error("Assign slot action failed", assignError);
        setError("Could not assign slot.");
        setPendingParticipantId("");
        return;
      }

      if (!result.ok) {
        setError(result.message);
        setPendingParticipantId("");
        return;
      }

      setIsOpen(false);
      setPendingParticipantId("");
      setToast(result.message);
      router.refresh();
      window.setTimeout(() => setToast(""), 2500);
    });
  }

  return (
    <>
      <button
        type="button"
        onClick={openModal}
        disabled={participants.length === 0}
        className="inline-flex h-8 items-center gap-1 rounded-lg border border-emerald-200 bg-emerald-50 px-2 text-xs font-black text-emerald-700 transition hover:bg-emerald-100 disabled:cursor-not-allowed disabled:border-slate-200 disabled:bg-slate-100 disabled:text-slate-400"
      >
        <UserPlus size={14} /> Assign Slot
      </button>

      {isOpen ? (
        <div className="fixed inset-0 z-50 grid place-items-center bg-slate-950/50 p-4">
          <div className="grid w-full max-w-6xl max-h-[calc(100dvh-2rem)] overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-2xl">
            <div className="flex items-start justify-between gap-3 border-b border-slate-200 px-4 py-4 sm:px-6">
              <div className="min-w-0">
                <p className="text-[0.68rem] font-black uppercase tracking-[0.16em] text-emerald-700">
                  Assign Slot
                </p>
                <h3 className="mt-1 text-lg font-black tracking-tight text-slate-950">
                  Compare athlete progress before assigning
                </h3>
                <p className="mt-1 text-sm font-bold text-slate-500">
                  Tap a card to assign the slot. {dayLabel}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setIsOpen(false)}
                className="grid size-9 place-items-center rounded-lg border border-slate-200 text-slate-500 transition hover:bg-slate-50"
                aria-label="Close assignment modal"
              >
                <X size={17} />
              </button>
            </div>

            <div className="grid min-h-0 gap-4 overflow-y-auto p-4 sm:p-6 lg:grid-cols-[18rem_minmax(0,1fr)]">
              <aside className="grid content-start gap-3">
                <section className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                  <h4 className="text-sm font-black uppercase tracking-[0.14em] text-slate-500">
                    Athletes
                  </h4>
                  <p className="mt-2 text-3xl font-black tracking-tight text-slate-950">
                    {participants.length}
                  </p>
                  <p className="mt-1 text-sm font-semibold text-slate-500">
                    Available for this slot
                  </p>
                </section>

                {participants.length > 1 ? (
                  <section className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                    <h4 className="text-sm font-black uppercase tracking-[0.14em] text-slate-500">
                      Quick Read
                    </h4>
                    <p className="mt-2 text-sm font-semibold leading-6 text-slate-600">
                      Review the cards on the right. The status badge is the fastest cue.
                    </p>
                  </section>
                ) : null}
              </aside>

              <section className="min-h-0">
                <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
                  {participants.map((participant) => {
                    const isAssigning = pendingParticipantId === participant.id;
                    const preferredMinutes = participant.dayPreferredMinutes ?? 0;
                    const assignedMinutes = participant.dayAssignedMinutes ?? 0;
                    const progressPercent = participant.dayProgressPercent ?? 0;
                    const safeProgressPercent = Math.min(Math.max(progressPercent, 0), 999);
                    const barWidth =
                      participant.dayStatus === "no_preference" ||
                      participant.dayStatus === "no_flying"
                        ? 0
                        : Math.min(safeProgressPercent, 100);
                    const statusTone =
                      participant.dayStatus === "complete"
                        ? "emerald"
                        : participant.dayStatus === "needs_time"
                          ? "amber"
                          : participant.dayStatus === "over_assigned"
                            ? "sky"
                            : "slate";
                    const statusMessage =
                      participant.dayStatus === "complete"
                        ? "Fully matched"
                        : participant.dayStatus === "needs_time"
                          ? `${participant.dayRemainingMinutes ?? 0} min remaining`
                          : participant.dayStatus === "over_assigned"
                            ? `${participant.dayOverAssignedMinutes ?? 0} min extra assigned`
                            : participant.dayStatus === "no_flying"
                              ? "No flying requested"
                              : "No preference submitted";
                    const cardTone =
                      participant.dayStatus === "complete"
                        ? "border-emerald-200 bg-emerald-50/80"
                        : participant.dayStatus === "needs_time"
                          ? "border-amber-200 bg-amber-50/80"
                          : participant.dayStatus === "over_assigned"
                            ? "border-sky-200 bg-sky-50/80"
                            : "border-slate-200 bg-slate-50";

                    return (
                      <button
                        key={participant.id}
                        type="button"
                        onClick={() => assignSlot(participant.id)}
                        disabled={isPending}
                        className={`grid gap-3 rounded-2xl border p-4 text-left transition hover:shadow-sm disabled:cursor-not-allowed disabled:opacity-80 ${cardTone} hover:border-slate-300`}
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0">
                            <p className="text-base font-black leading-5 tracking-tight text-slate-950">
                              {participant.name}
                            </p>
                            <p className="mt-1 text-xs font-black uppercase tracking-[0.12em] text-slate-500">
                              {participant.dayLabel ?? dayLabel}
                            </p>
                            <p className="mt-2 text-xs font-semibold text-slate-500">
                              Total camp assigned: {participant.bookedMinutes} min
                            </p>
                          </div>
                          <span
                            className={`shrink-0 rounded-full px-2.5 py-1 text-xs font-black shadow-sm ${
                              participant.dayStatus === "complete"
                                ? "bg-emerald-600 text-white"
                                : participant.dayStatus === "needs_time"
                                  ? "bg-amber-500 text-white"
                                  : participant.dayStatus === "over_assigned"
                                    ? "bg-sky-600 text-white"
                                    : "bg-slate-200 text-slate-600"
                            }`}
                          >
                            {participant.dayStatus === "complete"
                              ? "Fully Matched"
                              : participant.dayStatus === "needs_time"
                                ? "Needs More Time"
                                : participant.dayStatus === "over_assigned"
                                  ? "Over Assigned"
                                  : participant.dayStatus === "no_flying"
                                    ? "No Flying Requested"
                                    : "No Preference"}
                          </span>
                        </div>

                        <div className="grid gap-2">
                          <div className="text-2xl font-black tracking-tight text-slate-950">
                            {preferredMinutes > 0
                              ? `${assignedMinutes} / ${preferredMinutes} min`
                              : `${assignedMinutes} min assigned`}
                          </div>

                          <div className="h-2 overflow-hidden rounded-full bg-white/80">
                            <div
                              className={`h-full rounded-full ${
                                statusTone === "emerald"
                                  ? "bg-emerald-500"
                                  : statusTone === "amber"
                                    ? "bg-amber-500"
                                    : statusTone === "sky"
                                      ? "bg-sky-600"
                                      : "bg-slate-300"
                              }`}
                              style={{ width: `${barWidth}%` }}
                            />
                          </div>

                          <div className="flex items-center justify-between gap-3 text-sm font-semibold text-slate-600">
                            <span>{statusMessage}</span>
                            {isAssigning ? <span>Assigning...</span> : null}
                          </div>
                        </div>
                      </button>
                    );
                  })}
                  {participants.length === 0 ? (
                    <p className="rounded-xl border border-dashed border-slate-200 bg-slate-50 px-3 py-4 text-sm font-bold text-slate-500">
                      No accepted participants available for this slot.
                    </p>
                  ) : null}
                </div>
              </section>
            </div>

            {error ? (
              <p className="mx-4 mb-0 rounded-xl bg-rose-50 px-3 py-2 text-sm font-bold text-rose-700 sm:mx-6">
                {error}
              </p>
            ) : null}

            <div className="flex items-center justify-end gap-2 border-t border-slate-200 px-4 py-4 sm:px-6">
              <button
                type="button"
                onClick={() => setIsOpen(false)}
                className="inline-flex h-10 items-center rounded-xl border border-slate-200 px-3 text-sm font-black text-slate-700 transition hover:bg-slate-50"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {toast ? (
        <div
          role="status"
          aria-live="polite"
          className="fixed bottom-16 left-1/2 z-50 w-[min(calc(100vw-1.5rem),22rem)] -translate-x-1/2 rounded-xl bg-slate-950 px-3 py-2 text-center text-sm font-bold text-white shadow-lg md:bottom-5"
        >
          {toast}
        </div>
      ) : null}
    </>
  );
}
