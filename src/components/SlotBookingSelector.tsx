"use client";

import { useMemo, useState, useTransition } from "react";
import { Check, Clock3, Send } from "lucide-react";
import { useRouter } from "next/navigation";
import { bookOpportunitySlots } from "@/app/app/opportunities/actions";

type SlotOption = {
  id: string;
  slotDate: string;
  startTime: string;
  capacity: number;
  bookedCount: number;
  remainingCapacity: number;
  userHasBooking: boolean;
};

type SlotBookingSelectorProps = {
  opportunityId: string;
  hourlyPrice: number;
  currency: string;
  slots: SlotOption[];
};

const minutesPerSelectedSlot = 15;

export function SlotBookingSelector({
  opportunityId,
  hourlyPrice,
  currency,
  slots,
}: SlotBookingSelectorProps) {
  const router = useRouter();
  const [selectedSlotIds, setSelectedSlotIds] = useState<string[]>([]);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [isPending, startTransition] = useTransition();
  const selectedCount = selectedSlotIds.length;
  const totalMinutes = selectedCount * minutesPerSelectedSlot;
  const estimatedTotal = (hourlyPrice / 60) * totalMinutes;
  const groupedSlots = useMemo(() => groupSlotsByDay(slots), [slots]);

  function toggleSlot(slot: SlotOption) {
    if (slot.remainingCapacity <= 0 || slot.userHasBooking || isPending) {
      return;
    }

    setMessage("");
    setError("");
    setSelectedSlotIds((current) =>
      current.includes(slot.id)
        ? current.filter((slotId) => slotId !== slot.id)
        : [...current, slot.id],
    );
  }

  function bookSlots() {
    setMessage("");
    setError("");

    startTransition(async () => {
      const result = await bookOpportunitySlots(opportunityId, selectedSlotIds);

      if (!result.ok) {
        setError(result.message);
        return;
      }

      setMessage(result.message);
      setSelectedSlotIds([]);
      window.setTimeout(() => {
        router.push(`/app/opportunities/${opportunityId}`);
        router.refresh();
      }, 700);
    });
  }

  return (
    <div className="grid gap-4">
      {groupedSlots.length > 0 ? (
        groupedSlots.map((day) => (
          <section
            key={day.date}
            className="rounded-2xl border border-slate-200 bg-white shadow-sm"
          >
            <header className="rounded-t-2xl border-b border-slate-200 bg-slate-50 px-3 py-3">
              <p className="text-sm font-black uppercase text-slate-500">
                {formatSlotDate(day.date)}
              </p>
            </header>
            <div className="grid gap-2 p-3">
              {day.slots.map((slot) => {
                const isSelected = selectedSlotIds.includes(slot.id);
                const isFull = slot.remainingCapacity <= 0;
                const disabled = isFull || slot.userHasBooking || isPending;

                return (
                  <button
                    key={slot.id}
                    type="button"
                    disabled={disabled}
                    onClick={() => toggleSlot(slot)}
                    className={`grid grid-cols-[1fr_auto] items-center gap-3 rounded-xl border px-3 py-2 text-left transition ${
                      isSelected
                        ? "border-sky-300 bg-sky-50"
                        : "border-slate-200 bg-white hover:bg-slate-50"
                    } disabled:cursor-not-allowed disabled:bg-slate-50 disabled:text-slate-400`}
                  >
                    <span className="flex min-w-0 items-center gap-2">
                      <Clock3
                        size={16}
                        className={isSelected ? "text-sky-700" : "text-slate-400"}
                      />
                      <span>
                        <span className="block text-base font-black text-slate-950">
                          {formatSlotTime(slot.startTime)}
                        </span>
                        <span className="text-xs font-bold text-slate-500">
                          {slot.userHasBooking
                            ? "Booked by you"
                            : isFull
                              ? "Full"
                              : `${slot.remainingCapacity} open`}
                        </span>
                      </span>
                    </span>
                    <span
                      className={`flex size-7 items-center justify-center rounded-full border ${
                        isSelected
                          ? "border-sky-500 bg-sky-600 text-white"
                          : "border-slate-200 bg-white text-transparent"
                      }`}
                    >
                      <Check size={15} />
                    </span>
                  </button>
                );
              })}
            </div>
          </section>
        ))
      ) : (
        <p className="rounded-2xl border border-slate-200 bg-white p-4 text-sm font-semibold text-slate-600">
          No published slots are available yet.
        </p>
      )}

      <section className="sticky bottom-3 rounded-2xl border border-slate-200 bg-white/95 p-3 shadow-lg backdrop-blur">
        <div className="grid grid-cols-3 gap-2 text-center">
          <SummaryValue label="Slots" value={String(selectedCount)} />
          <SummaryValue label="Minutes" value={String(totalMinutes)} />
          <SummaryValue
            label="Estimate"
            value={formatMoney(estimatedTotal, currency)}
          />
        </div>
        <button
          type="button"
          disabled={isPending || selectedCount === 0}
          onClick={bookSlots}
          className="mt-3 flex h-11 w-full items-center justify-center gap-2 rounded-xl bg-sky-600 text-sm font-black text-white transition hover:bg-sky-700 disabled:bg-slate-300"
        >
          <Send size={17} /> {isPending ? "Booking..." : "Book Slots"}
        </button>
        {message ? (
          <p className="mt-3 rounded-xl bg-emerald-50 p-3 text-sm font-semibold text-emerald-700">
            {message}
          </p>
        ) : null}
        {error ? (
          <p className="mt-3 rounded-xl bg-rose-50 p-3 text-sm font-semibold text-rose-700">
            {error}
          </p>
        ) : null}
      </section>
    </div>
  );
}

function SummaryValue({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl bg-slate-50 px-2 py-2">
      <p className="text-[0.68rem] font-black uppercase text-slate-500">{label}</p>
      <p className="mt-0.5 text-sm font-black text-slate-950">{value}</p>
    </div>
  );
}

function groupSlotsByDay(slots: SlotOption[]) {
  const groups = new Map<string, SlotOption[]>();

  for (const slot of slots) {
    const daySlots = groups.get(slot.slotDate) ?? [];
    daySlots.push(slot);
    groups.set(slot.slotDate, daySlots);
  }

  return [...groups.entries()]
    .sort(([dateA], [dateB]) => dateA.localeCompare(dateB))
    .map(([date, daySlots]) => ({
      date,
      slots: daySlots.sort((a, b) => a.startTime.localeCompare(b.startTime)),
    }));
}

function formatSlotDate(value: string) {
  return new Intl.DateTimeFormat("en", {
    month: "short",
    day: "numeric",
    weekday: "short",
  }).format(new Date(`${value}T00:00:00`));
}

function formatSlotTime(value: string) {
  return value.slice(0, 5);
}

function formatMoney(value: number, currency: string) {
  return `${new Intl.NumberFormat("en", {
    maximumFractionDigits: 2,
  }).format(value)} ${currency}`;
}
