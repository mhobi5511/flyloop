"use client";

import { useMemo, useState, useTransition } from "react";
import { createPortal } from "react-dom";
import { useRouter } from "next/navigation";
import { CalendarDays, Copy, X } from "lucide-react";
import { saveCampTimetable } from "@/app/app/organizer/opportunities/actions";

type CampSlot = {
  id: string;
  slotDate: string;
  startTime: string;
  durationMinutes: number;
  capacity: number;
};

type CampBuilderCopyDayButtonProps = {
  camp: {
    id: string;
    startDate: string;
    endDate: string;
    timetableSlots: CampSlot[];
  };
  date: string;
};

export function CampBuilderCopyDayButton({
  camp,
  date,
}: CampBuilderCopyDayButtonProps) {
  const router = useRouter();
  const [isOpen, setIsOpen] = useState(false);
  const [selectedDates, setSelectedDates] = useState<string[]>([]);
  const [isPending, startTransition] = useTransition();

  const campDates = useMemo(() => getDateRange(camp.startDate, camp.endDate), [camp]);
  const availableDates = useMemo(
    () => campDates.filter((campDate) => campDate !== date),
    [campDates, date],
  );
  const sourceSlots = useMemo(
    () =>
      camp.timetableSlots
        .filter((slot) => slot.slotDate === date)
        .map((slot) => ({
          id: slot.id,
          slotDate: slot.slotDate,
          startTime: slot.startTime.slice(0, 5),
          durationMinutes: slot.durationMinutes,
          capacity: slot.capacity,
        })),
    [camp.timetableSlots, date],
  );

  function openCopyDialog() {
    setSelectedDates([]);
    setIsOpen(true);
  }

  function closeCopyDialog() {
    if (isPending) return;
    setIsOpen(false);
  }

  function copyDay() {
    if (selectedDates.length === 0) {
      return;
    }

    const selectedSet = new Set(selectedDates);
    const existingSlots = camp.timetableSlots
      .filter((slot) => slot.slotDate !== date && !selectedSet.has(slot.slotDate))
      .map((slot) => ({
        id: slot.id,
        slotDate: slot.slotDate,
        startTime: slot.startTime.slice(0, 5),
        durationMinutes: slot.durationMinutes,
        capacity: slot.capacity,
      }));
    const preservedSourceSlots = sourceSlots.map((slot) => ({
      id: slot.id,
      slotDate: slot.slotDate,
      startTime: slot.startTime,
      durationMinutes: slot.durationMinutes,
      capacity: slot.capacity,
    }));
    const copiedSlots = selectedDates.flatMap((targetDate) =>
      sourceSlots.map((slot) => ({
        slotDate: targetDate,
        startTime: slot.startTime,
        durationMinutes: slot.durationMinutes,
        capacity: slot.capacity,
      })),
    );

    startTransition(async () => {
      const result = await saveCampTimetable(
        camp.id,
        [...existingSlots, ...preservedSourceSlots, ...copiedSlots],
        false,
        {
        redirectOnPublish: false,
        },
      );

      if (!result.ok) {
        return;
      }

      setIsOpen(false);
      router.refresh();
    });
  }

  return (
    <>
      <button
        type="button"
        onClick={openCopyDialog}
        className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-2.5 text-xs font-black text-slate-700 transition hover:bg-slate-50"
      >
        <Copy size={14} /> Copy To
      </button>

      {isOpen && typeof document !== "undefined"
        ? createPortal(
            <div className="fixed inset-0 z-[110] grid place-items-center bg-slate-950/60 p-4">
              <div className="w-full max-w-xl rounded-3xl bg-white shadow-2xl">
                <div className="flex items-center justify-between gap-4 border-b border-slate-200 px-4 py-4 sm:px-6">
                  <div>
                    <p className="text-xs font-black uppercase tracking-[0.14em] text-sky-700">
                      {formatLongDay(date)}
                    </p>
                    <h4 className="mt-1 text-lg font-black tracking-tight text-slate-950">
                      Copy To
                    </h4>
                  </div>
                  <button
                    type="button"
                    onClick={closeCopyDialog}
                    className="inline-flex size-10 items-center justify-center rounded-xl border border-slate-200 text-slate-500 transition hover:bg-slate-50 hover:text-slate-800"
                  >
                    <X size={18} />
                  </button>
                </div>

                <div className="grid gap-4 px-4 py-4 sm:px-6">
                  <div className="grid gap-2">
                    {availableDates.map((campDate) => {
                      const isSelected = selectedDates.includes(campDate);

                      return (
                        <label
                          key={campDate}
                          className={`flex items-center justify-between gap-3 rounded-2xl border px-4 py-3 transition ${
                            isSelected
                              ? "border-sky-300 bg-sky-50"
                              : "border-slate-200 bg-white"
                          }`}
                        >
                          <div>
                            <p className="text-sm font-black text-slate-950">
                              {formatLongDay(campDate)}
                            </p>
                            <p className="mt-1 text-xs font-semibold text-slate-500">
                              Copies slots only. Athlete assignments stay off the target day.
                            </p>
                          </div>
                          <input
                            type="checkbox"
                            checked={isSelected}
                            onChange={() =>
                              setSelectedDates((current) =>
                                current.includes(campDate)
                                  ? current.filter((item) => item !== campDate)
                                  : [...current, campDate],
                              )
                            }
                            className="size-5 rounded border-slate-300 text-sky-600 focus:ring-sky-500"
                          />
                        </label>
                      );
                    })}
                  </div>

                  <div className="flex justify-end gap-2">
                    <button
                      type="button"
                      onClick={closeCopyDialog}
                      className="h-11 rounded-xl border border-slate-200 px-4 text-sm font-black text-slate-700"
                    >
                      Cancel
                    </button>
                    <button
                      type="button"
                      onClick={copyDay}
                      disabled={isPending}
                      className="inline-flex h-11 items-center gap-2 rounded-xl bg-sky-600 px-4 text-sm font-black text-white disabled:bg-slate-300"
                    >
                      <CalendarDays size={16} /> {isPending ? "Copying..." : "Copy"}
                    </button>
                  </div>
                </div>
              </div>
            </div>,
            document.body,
          )
        : null}
    </>
  );
}

function getDateRange(startDate: string, endDate: string) {
  const dates: string[] = [];
  const start = new Date(`${startDate}T00:00:00.000Z`);
  const end = new Date(`${endDate || startDate}T00:00:00.000Z`);

  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) {
    return [];
  }

  for (
    const date = new Date(start);
    date.getTime() <= end.getTime();
    date.setUTCDate(date.getUTCDate() + 1)
  ) {
    dates.push(date.toISOString().slice(0, 10));
  }

  return dates;
}

function formatLongDay(value: string) {
  return new Intl.DateTimeFormat("en", {
    weekday: "long",
    month: "short",
    day: "numeric",
  }).format(new Date(`${value}T00:00:00`));
}
