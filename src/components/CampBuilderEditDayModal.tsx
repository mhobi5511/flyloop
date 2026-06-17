"use client";

import { useMemo, useState, useTransition } from "react";
import { createPortal } from "react-dom";
import { Plus, Save, X } from "lucide-react";
import { saveCampTimetable } from "@/app/app/organizer/opportunities/actions";

type CampSlot = {
  id: string;
  slotDate: string;
  startTime: string;
  durationMinutes: number;
  capacity: number;
};

type CampBuilderEditDayModalProps = {
  camp: {
    id: string;
    startDate: string;
    endDate: string;
    timetableSlots: CampSlot[];
  };
  date: string;
};

type DaySlotDraft = {
  id?: string;
  slotDate: string;
  startTime: string;
  durationMinutes: number;
  capacity: number;
};

const rotationOptions = [10, 15] as const;

export function CampBuilderEditDayModal({ camp, date }: CampBuilderEditDayModalProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [selectedTimes, setSelectedTimes] = useState<string[]>([]);
  const [rotationLength, setRotationLength] = useState<(typeof rotationOptions)[number]>(15);
  const [error, setError] = useState("");
  const [isPending, startTransition] = useTransition();

  const daySlots = useMemo(
    () =>
      camp.timetableSlots
        .filter((slot) => slot.slotDate === date)
        .map((slot) => ({
          id: slot.id,
          slotDate: slot.slotDate,
          startTime: slot.startTime.slice(0, 5),
          durationMinutes: slot.durationMinutes,
          capacity: slot.capacity,
        }))
        .sort((a, b) => a.startTime.localeCompare(b.startTime)),
    [camp.timetableSlots, date],
  );
  const daySlotsByTime = useMemo(
    () => new Map(daySlots.map((slot) => [slot.startTime, slot])),
    [daySlots],
  );
  const halfHourIntervals = useMemo(() => buildHalfHourIntervals(), []);
  const timeColumns = useMemo(() => buildTimeColumns(halfHourIntervals), [halfHourIntervals]);

  function openEditor() {
    setError("");
    setSelectedTimes(daySlots.map((slot) => slot.startTime));
    setRotationLength(daySlots[0]?.durationMinutes === 10 ? 10 : 15);
    setIsOpen(true);
  }

  function closeEditor() {
    if (isPending) return;
    setIsOpen(false);
  }

  function toggleSlot(startTime: string) {
    setSelectedTimes((current) =>
      current.includes(startTime)
        ? current.filter((item) => item !== startTime)
        : [...current, startTime].sort(),
    );
  }

  function buildNextSlots(): DaySlotDraft[] {
    const currentSlots = camp.timetableSlots
      .filter((slot) => slot.slotDate !== date)
      .map((slot) => ({
        id: slot.id,
        slotDate: slot.slotDate,
        startTime: slot.startTime.slice(0, 5),
        durationMinutes: slot.durationMinutes,
        capacity: slot.capacity,
      }));

    const selectedSlots = selectedTimes.map((startTime) => {
      const existing = daySlotsByTime.get(startTime);

      return {
        id: existing?.id,
        slotDate: date,
        startTime,
        durationMinutes: rotationLength,
        capacity: getSlotCapacity(rotationLength),
      };
    });

    return [...currentSlots, ...selectedSlots];
  }

  function apply() {
    setError("");

    startTransition(async () => {
      const result = await saveCampTimetable(camp.id, buildNextSlots(), false, {
        redirectOnPublish: false,
      });

      if (!result.ok) {
        setError(result.message);
        return;
      }

      setIsOpen(false);
    });
  }

  return (
    <>
      <button
        type="button"
        onClick={openEditor}
        className="inline-flex h-8 items-center gap-1.5 rounded-lg bg-sky-600 px-2.5 text-xs font-black text-white transition hover:bg-sky-700"
      >
        <Plus size={14} /> Edit Day
      </button>

      {isOpen && typeof document !== "undefined"
        ? createPortal(
            <div className="fixed inset-0 z-[100] grid place-items-center bg-slate-950/50 p-4">
              <div className="flex max-h-[calc(100vh-2rem)] w-full max-w-3xl flex-col overflow-hidden rounded-3xl bg-white shadow-2xl">
                <div className="flex items-center justify-between gap-4 border-b border-slate-200 px-4 py-4 sm:px-6">
                  <div>
                    <p className="text-xs font-black uppercase tracking-[0.14em] text-sky-700">
                      {formatLongDay(date)}
                    </p>
                    <h3 className="mt-1 text-lg font-black tracking-tight text-slate-950">
                      Manual Slots
                    </h3>
                  </div>
                  <button
                    type="button"
                    onClick={closeEditor}
                    className="inline-flex size-10 items-center justify-center rounded-xl border border-slate-200 text-slate-500 transition hover:bg-slate-50 hover:text-slate-800"
                  >
                    <X size={18} />
                  </button>
                </div>

                <div className="grid min-h-0 gap-4 px-4 py-4 sm:px-6">
                  <div className="grid gap-3">
                    <div className="grid gap-1">
                      <label className="text-[0.7rem] font-black uppercase tracking-[0.08em] text-slate-500">
                        Rotation
                      </label>
                      <select
                        value={rotationLength}
                        onChange={(event) =>
                          setRotationLength(
                            Number(event.target.value) as (typeof rotationOptions)[number],
                          )
                        }
                        className="h-11 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm font-bold text-slate-950 outline-none focus:border-sky-400"
                      >
                        {rotationOptions.map((option) => (
                          <option key={option} value={option}>
                            {option} min
                          </option>
                        ))}
                      </select>
                    </div>

                    <div className="rounded-3xl border border-slate-200 bg-slate-50 p-3">
                      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
                        {timeColumns.map((column, columnIndex) => (
                          <div
                            key={columnIndex}
                            className="grid gap-1.5"
                          >
                            {column.map((time) => {
                              const isSelected = selectedTimes.includes(time);
                              return (
                                <button
                                  key={time}
                                  type="button"
                                  onClick={() => toggleSlot(time)}
                                  className={`flex min-h-11 items-center justify-between gap-2 rounded-2xl border px-3 py-2.5 text-left transition ${
                                    isSelected
                                      ? "border-sky-300 bg-sky-50 text-sky-900 shadow-sm"
                                      : "border-transparent bg-white text-slate-700 hover:border-sky-200 hover:bg-slate-50"
                                  }`}
                                >
                                  <div className="flex min-w-0 items-center gap-2">
                                    <span className="text-sm font-black text-slate-950">
                                      {time}
                                    </span>
                                  </div>
                                  <span
                                    className={`inline-flex rounded-full border px-2 py-0.5 text-[0.65rem] font-black uppercase tracking-[0.08em] ${
                                      isSelected
                                        ? "border-sky-500 bg-sky-600 text-white"
                                        : "border-slate-300 bg-white text-slate-400"
                                    }`}
                                  >
                                    {isSelected ? "On" : "Off"}
                                  </span>
                                </button>
                              );
                            })}
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>

                  {error ? (
                    <p className="rounded-2xl bg-rose-50 p-3 text-sm font-bold text-rose-700">
                      {error}
                    </p>
                  ) : null}

                  <div className="flex justify-end gap-2">
                    <button
                      type="button"
                      onClick={closeEditor}
                      className="h-11 rounded-xl border border-slate-200 px-4 text-sm font-black text-slate-700"
                    >
                      Close
                    </button>
                    <button
                      type="button"
                      onClick={apply}
                      disabled={isPending}
                      className="inline-flex h-11 items-center gap-2 rounded-xl bg-sky-600 px-4 text-sm font-black text-white disabled:bg-slate-300"
                    >
                      <Save size={16} /> {isPending ? "Applying..." : "Apply"}
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

function buildHalfHourIntervals() {
  return Array.from({ length: 48 }, (_, index) => minutesToTime(index * 30));
}

function buildTimeColumns(times: string[]) {
  const columnLength = Math.ceil(times.length / 4);

  return Array.from({ length: 4 }, (_, columnIndex) =>
    times.slice(columnIndex * columnLength, (columnIndex + 1) * columnLength),
  );
}

function minutesToTime(value: number) {
  const normalizedMinutes = ((value % 1440) + 1440) % 1440;
  const hours = Math.floor(normalizedMinutes / 60);
  const minutes = normalizedMinutes % 60;

  return `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}`;
}

function getSlotCapacity(durationMinutes: number) {
  return durationMinutes === 10 ? 3 : 2;
}

function formatLongDay(value: string) {
  return new Intl.DateTimeFormat("en", {
    weekday: "long",
    month: "short",
    day: "numeric",
  }).format(new Date(`${value}T00:00:00`));
}
