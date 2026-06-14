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
  dayStatus?: "complete" | "needs_time" | "no_flying" | "no_preference";
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
          <div className="w-full max-w-lg rounded-2xl bg-white p-4 shadow-xl">
            <div className="flex items-start justify-between gap-3">
              <div>
                <h3 className="text-lg font-black tracking-tight text-slate-950">
                  Assign Slot
                </h3>
                <p className="mt-1 text-sm font-bold text-slate-500">
                  Select one accepted camp participant.
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

            <div className="mt-4 grid gap-2">
              {participants.map((participant) => {
                const isAssigning = pendingParticipantId === participant.id;

                return (
                  <button
                    key={participant.id}
                    type="button"
                    onClick={() => assignSlot(participant.id)}
                    disabled={isPending}
                    className="grid gap-1 rounded-xl border border-slate-200 bg-white px-3 py-3 text-left transition hover:border-emerald-300 hover:bg-emerald-50 disabled:cursor-not-allowed disabled:border-slate-200 disabled:bg-slate-50"
                  >
                    <span className="flex items-center justify-between gap-3">
                      <span className="truncate text-sm font-black text-slate-950">
                        {participant.name}
                      </span>
                      {isAssigning ? (
                        <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-[0.68rem] font-black text-emerald-700">
                          Assigning...
                        </span>
                      ) : null}
                    </span>
                    <span className="text-xs font-bold text-slate-500">
                      {participant.bookedMinutes} min booked
                    </span>
                    {participant.dayStatus ? (
                      <span className="mt-1 grid gap-1 rounded-lg bg-slate-50 px-2.5 py-2 text-xs font-bold text-slate-600">
                        {participant.dayLabel ? (
                          <span className="font-black text-slate-950">
                            {participant.dayLabel}
                          </span>
                        ) : null}
                        {participant.dayStatus === "no_flying" ? (
                          <span className="font-black text-amber-700">
                            No flying requested
                          </span>
                        ) : participant.dayStatus === "no_preference" ? (
                          <span className="font-black text-slate-500">
                            No preference submitted
                          </span>
                        ) : (
                          <>
                            <span>
                              Preferred: {participant.dayPreferredMinutes ?? 0} min
                            </span>
                            <span>
                              Assigned: {participant.dayAssignedMinutes ?? 0} min
                            </span>
                            {participant.dayStatus === "complete" ? (
                              <span className="font-black text-emerald-700">
                                Complete
                              </span>
                            ) : (
                              <span>
                                Remaining: {participant.dayRemainingMinutes ?? 0} min
                              </span>
                            )}
                          </>
                        )}
                      </span>
                    ) : null}
                  </button>
                );
              })}
              {participants.length === 0 ? (
                <p className="rounded-xl border border-dashed border-slate-200 bg-slate-50 px-3 py-4 text-sm font-bold text-slate-500">
                  No accepted participants available for this slot.
                </p>
              ) : null}
            </div>

            {error ? (
              <p className="mt-3 rounded-lg bg-rose-50 p-2 text-sm font-semibold text-rose-700">
                {error}
              </p>
            ) : null}

            <div className="mt-4 flex justify-end gap-2">
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
