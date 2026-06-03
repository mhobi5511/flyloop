"use client";

import { useState, useTransition } from "react";
import { XCircle } from "lucide-react";
import { useRouter } from "next/navigation";
import { releaseParticipantSlotBooking } from "@/app/app/organizer/opportunities/actions";

type ReleaseSlotBookingButtonProps = {
  opportunityId: string;
  bookingId: string;
};

export function ReleaseSlotBookingButton({
  opportunityId,
  bookingId,
}: ReleaseSlotBookingButtonProps) {
  const router = useRouter();
  const [toast, setToast] = useState("");
  const [error, setError] = useState("");
  const [isPending, startTransition] = useTransition();

  function releaseSlot() {
    setToast("");
    setError("");

    startTransition(async () => {
      let result: Awaited<ReturnType<typeof releaseParticipantSlotBooking>>;

      try {
        result = await releaseParticipantSlotBooking(opportunityId, bookingId);
      } catch (releaseError) {
        console.error("Release slot action failed", releaseError);
        setError("Could not release slot.");
        return;
      }

      if (!result.ok) {
        setError(result.message);
        return;
      }

      setToast(result.message);
      router.refresh();
      window.setTimeout(() => setToast(""), 2500);
    });
  }

  return (
    <>
      <button
        type="button"
        disabled={isPending}
        onClick={releaseSlot}
        className="inline-flex h-8 items-center gap-1 rounded-lg border border-rose-200 px-2 text-xs font-black text-rose-700 transition hover:bg-rose-50 disabled:cursor-not-allowed disabled:text-slate-400"
      >
        <XCircle size={14} /> {isPending ? "Releasing..." : "Release Slot"}
      </button>
      {toast ? (
        <div
          role="status"
          aria-live="polite"
          className="fixed bottom-16 left-1/2 z-50 w-[min(calc(100vw-1.5rem),22rem)] -translate-x-1/2 rounded-xl bg-slate-950 px-3 py-2 text-center text-sm font-bold text-white shadow-lg md:bottom-5"
        >
          {toast}
        </div>
      ) : null}
      {error ? (
        <p className="mt-1 rounded-lg bg-rose-50 p-2 text-xs font-semibold text-rose-700">
          {error}
        </p>
      ) : null}
    </>
  );
}
