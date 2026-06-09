"use client";

import { useMemo, useState, useTransition } from "react";
import { CalendarPlus, Plus, Save, Send, Trash2 } from "lucide-react";
import {
  saveCampTimetable,
  type TimetableSlotInput,
} from "@/app/app/organizer/opportunities/actions";

type TimetableSlotDraft = {
  localId: string;
  id?: string;
  startTime: string;
  durationMinutes: number;
};

type TimetableDayDraft = {
  localId: string;
  date: string;
  slots: TimetableSlotDraft[];
};

type InitialTimetableSlot = {
  id: string;
  slotDate: string;
  startTime: string;
  durationMinutes: number;
  capacity: number;
};

type CampTimetableEditorProps = {
  opportunityId: string;
  opportunityStartDate: string;
  initialSlots: InitialTimetableSlot[];
};

export function CampTimetableEditor({
  opportunityId,
  opportunityStartDate,
  initialSlots,
}: CampTimetableEditorProps) {
  const initialDays = useMemo(
    () => buildInitialDays(initialSlots, opportunityStartDate),
    [initialSlots, opportunityStartDate],
  );
  const [days, setDays] = useState<TimetableDayDraft[]>(initialDays);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [isPending, startTransition] = useTransition();

  function addDay() {
    setDays((currentDays) => [
      ...currentDays,
      {
        localId: makeLocalId(),
        date: nextDate(getLatestDate(currentDays) ?? opportunityStartDate),
        slots: [createSlotDraft()],
      },
    ]);
  }

  function updateDay(dayId: string, date: string) {
    setDays((currentDays) =>
      currentDays.map((day) => (day.localId === dayId ? { ...day, date } : day)),
    );
  }

  function removeDay(dayId: string) {
    setDays((currentDays) =>
      currentDays.length === 1
        ? [{ ...currentDays[0], slots: [] }]
        : currentDays.filter((day) => day.localId !== dayId),
    );
  }

  function addSlot(dayId: string) {
    setDays((currentDays) =>
      currentDays.map((day) =>
        day.localId === dayId
          ? { ...day, slots: [...day.slots, createSlotDraft()] }
          : day,
      ),
    );
  }

  function updateSlot(
    dayId: string,
    slotId: string,
    updates: Partial<TimetableSlotDraft>,
  ) {
    setDays((currentDays) =>
      currentDays.map((day) =>
        day.localId === dayId
          ? {
              ...day,
              slots: day.slots.map((slot) =>
                slot.localId === slotId ? { ...slot, ...updates } : slot,
              ),
            }
          : day,
      ),
    );
  }

  function removeSlot(dayId: string, slotId: string) {
    setDays((currentDays) =>
      currentDays.map((day) =>
        day.localId === dayId
          ? { ...day, slots: day.slots.filter((slot) => slot.localId !== slotId) }
          : day,
      ),
    );
  }

  function submit(publish: boolean) {
    setMessage("");
    setError("");

    const slots = days.flatMap<TimetableSlotInput>((day) =>
      day.slots.map((slot) => ({
        id: slot.id,
        slotDate: day.date,
        startTime: roundTimeToHalfHour(slot.startTime),
        durationMinutes: slot.durationMinutes,
        capacity: getSlotCapacity(slot.durationMinutes),
      })),
    );

    startTransition(async () => {
      const result = await saveCampTimetable(opportunityId, slots, publish);

      if (!result.ok) {
        setError(result.message);
        return;
      }

      setMessage(result.message);
    });
  }

  return (
    <div className="grid gap-4">
      {days.map((day, dayIndex) => (
        <section
          key={day.localId}
          className="rounded-2xl border border-slate-300 bg-white shadow-sm"
        >
          <div className="rounded-t-2xl border-b border-slate-200 bg-slate-50 p-3">
            <div className="flex items-start justify-between gap-3">
              <label className="grid flex-1 gap-2">
                <span className="text-base font-black tracking-tight text-slate-950">
                  Day {dayIndex + 1}
                </span>
                <span className="text-xs font-black uppercase text-slate-500">
                  Date
                </span>
                <input
                  type="date"
                  value={day.date}
                  onChange={(event) => updateDay(day.localId, event.target.value)}
                  className="h-11 rounded-xl border border-slate-300 bg-white px-3 text-sm font-black text-slate-900 outline-none focus:border-sky-400"
                />
              </label>
              <button
                type="button"
                aria-label="Delete day"
                onClick={() => removeDay(day.localId)}
                className="mt-8 flex h-11 items-center justify-center gap-2 rounded-xl border border-rose-200 bg-rose-50 px-3 text-sm font-black text-rose-700 transition hover:bg-rose-100"
              >
                <Trash2 size={17} />
                <span className="hidden sm:inline">Delete Day</span>
              </button>
            </div>
          </div>

          <div className="p-3">
            <div className="mb-3 flex items-center justify-between">
              <h2 className="text-sm font-black uppercase text-slate-500">
                Slots
              </h2>
              <span className="text-xs font-bold text-slate-400">
                30 min blocks
              </span>
            </div>

            <div className="grid gap-2">
              {day.slots.map((slot) => {
                const capacity = getSlotCapacity(slot.durationMinutes);

                return (
                  <div
                    key={slot.localId}
                    className="grid grid-cols-[minmax(72px,1fr)_82px_76px_34px] items-end gap-1.5 rounded-xl border border-slate-200 bg-white p-2 sm:grid-cols-[minmax(120px,1fr)_110px_100px_38px] sm:gap-2"
                  >
                    <label className="grid gap-1">
                      <span className="text-[0.68rem] font-black uppercase text-slate-500">
                        Slot
                      </span>
                      <input
                        type="time"
                        step="1800"
                        value={slot.startTime}
                        onChange={(event) =>
                          updateSlot(day.localId, slot.localId, {
                            startTime: roundTimeToHalfHour(event.target.value),
                          })
                        }
                        onBlur={(event) =>
                          updateSlot(day.localId, slot.localId, {
                            startTime: roundTimeToHalfHour(event.target.value),
                          })
                        }
                        className="h-9 min-w-0 rounded-lg border border-slate-200 px-2 text-sm font-black text-slate-900 outline-none focus:border-sky-400"
                      />
                    </label>

                    <label className="grid gap-1">
                      <span className="text-[0.68rem] font-black uppercase text-slate-500">
                        Minutes
                      </span>
                      <select
                        value={slot.durationMinutes}
                        onChange={(event) =>
                          updateSlot(day.localId, slot.localId, {
                            durationMinutes: Number(event.target.value),
                          })
                        }
                        className="h-9 min-w-0 rounded-lg border border-slate-200 bg-white px-2 text-sm font-black text-slate-900 outline-none focus:border-sky-400"
                      >
                        <option value={10}>10 min</option>
                        <option value={15}>15 min</option>
                      </select>
                    </label>

                    <div className="grid gap-1">
                      <span className="text-[0.68rem] font-black uppercase text-slate-500">
                        Capacity
                      </span>
                      <p className="flex h-9 items-center rounded-lg bg-slate-100 px-2 text-sm font-black text-slate-700">
                        {capacity} {capacity === 1 ? "spot" : "spots"}
                      </p>
                    </div>

                    <button
                      type="button"
                      aria-label="Delete slot"
                      onClick={() => removeSlot(day.localId, slot.localId)}
                      className="flex size-9 items-center justify-center rounded-lg border border-rose-200 bg-rose-50 text-rose-700 transition hover:bg-rose-100"
                    >
                      <Trash2 size={15} />
                    </button>
                  </div>
                );
              })}
            </div>

            <button
              type="button"
              onClick={() => addSlot(day.localId)}
              className="mt-3 flex h-10 w-full items-center justify-center gap-2 rounded-xl border border-slate-200 text-sm font-bold text-slate-700 transition hover:bg-slate-50"
            >
              <Plus size={16} /> Add Slot
            </button>
          </div>
        </section>
      ))}

      <button
        type="button"
        onClick={addDay}
        className="flex h-11 items-center justify-center gap-2 rounded-xl border border-sky-200 bg-sky-50 text-sm font-black text-sky-700 transition hover:bg-sky-100"
      >
        <CalendarPlus size={17} /> Add Day
      </button>

      <div className="sticky bottom-3 grid gap-2 rounded-2xl border border-slate-200 bg-white/95 p-2 shadow-lg backdrop-blur sm:grid-cols-2">
        <button
          type="button"
          disabled={isPending}
          onClick={() => submit(false)}
          className="flex h-11 items-center justify-center gap-2 rounded-xl border border-slate-200 text-sm font-black text-slate-700 transition hover:bg-slate-50 disabled:text-slate-400"
        >
          <Save size={17} /> {isPending ? "Saving..." : "Save Draft"}
        </button>
        <button
          type="button"
          disabled={isPending}
          onClick={() => submit(true)}
          className="flex h-11 items-center justify-center gap-2 rounded-xl bg-sky-600 text-sm font-black text-white transition hover:bg-sky-700 disabled:bg-slate-300"
        >
          <Send size={17} /> {isPending ? "Publishing..." : "Publish Schedule"}
        </button>
      </div>

      {message ? (
        <p className="rounded-xl bg-sky-50 p-3 text-sm font-semibold text-sky-700">
          {message}
        </p>
      ) : null}
      {error ? (
        <p className="rounded-xl bg-rose-50 p-3 text-sm font-semibold text-rose-700">
          {error}
        </p>
      ) : null}
    </div>
  );
}

function buildInitialDays(
  slots: InitialTimetableSlot[],
  opportunityStartDate: string,
): TimetableDayDraft[] {
  if (slots.length === 0) {
    return [
      {
        localId: makeLocalId(),
        date: opportunityStartDate,
        slots: [createSlotDraft()],
      },
    ];
  }

  const days = new Map<string, TimetableSlotDraft[]>();

  for (const slot of slots) {
    const daySlots = days.get(slot.slotDate) ?? [];
    daySlots.push({
      localId: makeLocalId(),
      id: slot.id,
      startTime: roundTimeToHalfHour(slot.startTime),
      durationMinutes: normalizeDurationMinutes(slot.durationMinutes),
    });
    days.set(slot.slotDate, daySlots);
  }

  return [...days.entries()]
    .sort(([dateA], [dateB]) => dateA.localeCompare(dateB))
    .map(([date, daySlots]) => ({
      localId: makeLocalId(),
      date,
      slots: daySlots.sort((a, b) => a.startTime.localeCompare(b.startTime)),
    }));
}

function createSlotDraft(): TimetableSlotDraft {
  return {
    localId: makeLocalId(),
    startTime: "15:00",
    durationMinutes: 15,
  };
}

function makeLocalId() {
  return crypto.randomUUID();
}

function nextDate(value: string) {
  const date = new Date(`${value}T00:00:00`);
  date.setDate(date.getDate() + 1);
  return date.toISOString().slice(0, 10);
}

function getLatestDate(days: TimetableDayDraft[]) {
  const dates = days
    .map((day) => day.date)
    .filter((date) => /^\d{4}-\d{2}-\d{2}$/.test(date))
    .sort();

  return dates.at(-1);
}

function roundTimeToHalfHour(value: string) {
  if (!/^\d{2}:\d{2}/.test(value)) {
    return "15:00";
  }

  const [hourPart, minutePart] = value.split(":");
  const hours = Number(hourPart);
  const minutes = Number(minutePart);

  if (!Number.isFinite(hours) || !Number.isFinite(minutes)) {
    return "15:00";
  }

  const totalMinutes = hours * 60 + minutes;
  const roundedMinutes = Math.round(totalMinutes / 30) * 30;
  const normalizedMinutes = ((roundedMinutes % 1440) + 1440) % 1440;
  const roundedHours = Math.floor(normalizedMinutes / 60);
  const roundedMinutePart = normalizedMinutes % 60;

  return `${String(roundedHours).padStart(2, "0")}:${String(
    roundedMinutePart,
  ).padStart(2, "0")}`;
}

function normalizeDurationMinutes(value: number) {
  return value === 10 ? 10 : 15;
}

function getSlotCapacity(durationMinutes: number) {
  return 30 / normalizeDurationMinutes(durationMinutes);
}
