"use client";

import { useState, useTransition } from "react";
import { CheckCircle2, UserPlus, X } from "lucide-react";
import { useRouter } from "next/navigation";
import { assignParticipantSlotBooking } from "@/app/app/organizer/opportunities/actions";

export type AssignSlotParticipant = {
  id: string;
  name: string;
  bookedMinutes: number;
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
  const [selectedParticipantId, setSelectedParticipantId] = useState(
    participants[0]?.id ?? "",
  );
  const [toast, setToast] = useState("");
  const [error, setError] = useState("");
  const [isPending, startTransition] = useTransition();

  function openModal() {
    setError("");
    setToast("");
    setSelectedParticipantId(participants[0]?.id ?? "");
    setIsOpen(true);
  }

  function assignSlot() {
    setError("");

    if (!selectedParticipantId) {
      setError("Choose an accepted participant.");
      return;
    }

    startTransition(async () => {
      let result: Awaited<ReturnType<typeof assignParticipantSlotBooking>>;

      try {
        result = await assignParticipantSlotBooking(
          opportunityId,
          slotId,
          selectedParticipantId,
        );
      } catch (assignError) {
        console.error("Assign slot action failed", assignError);
        setError("Could not assign slot.");
        return;
      }

      if (!result.ok) {
        setError(result.message);
        return;
      }

      setIsOpen(false);
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
          <div className="w-full max-w-md rounded-2xl bg-white p-4 shadow-xl">
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

            <label className="mt-4 grid gap-1.5 text-sm font-black text-slate-700">
              Participant
              <select
                value={selectedParticipantId}
                onChange={(event) => setSelectedParticipantId(event.target.value)}
                className="h-11 rounded-xl border border-slate-200 bg-white px-3 text-sm font-bold text-slate-950 outline-none focus:border-emerald-400"
              >
                {participants.map((participant) => (
                  <option key={participant.id} value={participant.id}>
                    {participant.name} ({participant.bookedMinutes} min booked)
                  </option>
                ))}
              </select>
            </label>

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
                Cancel
              </button>
              <button
                type="button"
                onClick={assignSlot}
                disabled={isPending}
                className="inline-flex h-10 items-center gap-2 rounded-xl bg-emerald-600 px-3 text-sm font-black text-white transition hover:bg-emerald-700 disabled:cursor-not-allowed disabled:bg-slate-300"
              >
                <CheckCircle2 size={16} />
                {isPending ? "Assigning..." : "Assign Slot"}
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
