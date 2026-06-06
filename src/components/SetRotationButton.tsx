"use client";

import { useId, useState, useTransition } from "react";
import { RotateCw } from "lucide-react";
import { useRouter } from "next/navigation";
import { setParticipantSlotRotation } from "@/app/app/organizer/opportunities/actions";

const rotationOptions = [
  { label: "1 min", value: "1" },
  { label: "2 min", value: "2" },
  { label: "2.5 min", value: "2.5" },
  { label: "3 min", value: "3" },
  { label: "5 min", value: "5" },
  { label: "No rotation", value: "none" },
  { label: "Custom", value: "custom" },
];

type SetRotationButtonProps = {
  opportunityId: string;
  bookings: Array<{
    id: string;
    athleteName: string;
    rotationMinutes: number | null;
  }>;
};

export function SetRotationButton({
  opportunityId,
  bookings,
}: SetRotationButtonProps) {
  const router = useRouter();
  const titleId = useId();
  const [selectedBookingId, setSelectedBookingId] = useState(bookings[0]?.id ?? "");
  const selectedBooking =
    bookings.find((booking) => booking.id === selectedBookingId) ?? bookings[0];
  const [isOpen, setIsOpen] = useState(false);
  const [selectedValue, setSelectedValue] = useState(
    selectedBooking?.rotationMinutes === null || !selectedBooking
      ? "none"
      : String(selectedBooking.rotationMinutes),
  );
  const [customValue, setCustomValue] = useState(
    selectedBooking?.rotationMinutes === null || !selectedBooking
      ? ""
      : String(selectedBooking.rotationMinutes),
  );
  const [toast, setToast] = useState("");
  const [error, setError] = useState("");
  const [isPending, startTransition] = useTransition();

  function closeModal() {
    if (!isPending) {
      setIsOpen(false);
      setError("");
    }
  }

  function saveRotation() {
    setToast("");
    setError("");

    const rotationMinutes = parseRotation(selectedValue, customValue);

    if (rotationMinutes === undefined) {
      setError("Enter a custom rotation above 0 minutes.");
      return;
    }

    if (!selectedBooking) {
      setError("Choose a booked participant.");
      return;
    }

    startTransition(async () => {
      let result: Awaited<ReturnType<typeof setParticipantSlotRotation>>;

      try {
        result = await setParticipantSlotRotation(
          opportunityId,
          selectedBooking.id,
          rotationMinutes,
        );
      } catch (rotationError) {
        console.error("Set rotation action failed", rotationError);
        setError("Could not set rotation.");
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
        disabled={bookings.length === 0}
        onClick={() => {
          const firstBooking = bookings[0];
          setSelectedBookingId(firstBooking?.id ?? "");
          setSelectedValue(
            firstBooking?.rotationMinutes === null || !firstBooking
              ? "none"
              : String(firstBooking.rotationMinutes),
          );
          setCustomValue(
            firstBooking?.rotationMinutes === null || !firstBooking
              ? ""
              : String(firstBooking.rotationMinutes),
          );
          setIsOpen(true);
        }}
        className="inline-flex h-7 items-center gap-1 rounded-lg bg-white/10 px-2 text-xs font-black text-white transition hover:bg-white/20 disabled:cursor-not-allowed disabled:text-white/40"
      >
        <RotateCw size={14} /> Set Rotation
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
                  Set Rotation
                </h2>
                <p className="mt-1 text-sm font-semibold text-slate-500">
                  Choose the rhythm for this participant slot.
                </p>
              </div>
              <button
                type="button"
                onClick={closeModal}
                className="rounded-lg px-2 py-1 text-sm font-black text-slate-500 hover:bg-slate-100"
              >
                Close
              </button>
            </div>

            {bookings.length > 1 ? (
              <label className="mt-4 grid gap-1 text-sm font-bold text-slate-700">
                Participant
                <select
                  value={selectedBooking?.id ?? ""}
                  onChange={(event) => {
                    const nextBooking = bookings.find(
                      (booking) => booking.id === event.target.value,
                    );

                    setSelectedBookingId(event.target.value);
                    setSelectedValue(
                      nextBooking?.rotationMinutes === null || !nextBooking
                        ? "none"
                        : String(nextBooking.rotationMinutes),
                    );
                    setCustomValue(
                      nextBooking?.rotationMinutes === null || !nextBooking
                        ? ""
                        : String(nextBooking.rotationMinutes),
                    );
                  }}
                  className="h-10 rounded-xl border border-slate-200 px-3 font-semibold outline-none focus:border-sky-400"
                >
                  {bookings.map((booking) => (
                    <option key={booking.id} value={booking.id}>
                      {booking.athleteName || "Participant"}
                    </option>
                  ))}
                </select>
              </label>
            ) : (
              <p className="mt-4 rounded-xl bg-slate-50 px-3 py-2 text-sm font-bold text-slate-700">
                {selectedBooking?.athleteName || "Participant"}
              </p>
            )}

            <div className="mt-4 grid grid-cols-2 gap-2">
              {rotationOptions.map((option) => (
                <label
                  key={option.value}
                  className={`cursor-pointer rounded-xl border px-3 py-2 text-sm font-black transition ${
                    selectedValue === option.value
                      ? "border-sky-300 bg-sky-50 text-sky-800"
                      : "border-slate-200 text-slate-700 hover:bg-slate-50"
                  }`}
                >
                  <input
                    type="radio"
                    name={`rotation-${selectedBooking?.id ?? "slot"}`}
                    value={option.value}
                    checked={selectedValue === option.value}
                    onChange={() => setSelectedValue(option.value)}
                    className="sr-only"
                  />
                  {option.label}
                </label>
              ))}
            </div>

            {selectedValue === "custom" ? (
              <label className="mt-3 grid gap-1 text-sm font-bold text-slate-700">
                Custom minutes
                <input
                  type="number"
                  min="0.1"
                  step="0.1"
                  value={customValue}
                  onChange={(event) => setCustomValue(event.target.value)}
                  className="h-10 rounded-xl border border-slate-200 px-3 font-semibold outline-none focus:border-sky-400"
                  placeholder="4"
                />
              </label>
            ) : null}

            {error ? (
              <p className="mt-3 rounded-lg bg-rose-50 p-2 text-sm font-semibold text-rose-700">
                {error}
              </p>
            ) : null}

            <div className="mt-4 flex justify-end gap-2">
              <button
                type="button"
                onClick={closeModal}
                disabled={isPending}
                className="h-10 rounded-xl border border-slate-200 px-4 text-sm font-black text-slate-700 disabled:text-slate-400"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={saveRotation}
                disabled={isPending}
                className="h-10 rounded-xl bg-slate-950 px-4 text-sm font-black text-white disabled:bg-slate-300"
              >
                {isPending ? "Saving..." : "Save"}
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

function parseRotation(selectedValue: string, customValue: string) {
  if (selectedValue === "none") {
    return null;
  }

  const rawValue = selectedValue === "custom" ? customValue : selectedValue;
  const parsed = Number(rawValue);

  if (!Number.isFinite(parsed) || parsed <= 0) {
    return undefined;
  }

  return Number(parsed.toFixed(2));
}
