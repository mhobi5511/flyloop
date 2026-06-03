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
  capacity: number;
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
        date: nextDate(currentDays.at(-1)?.date ?? opportunityStartDate),
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
        startTime: slot.startTime,
        durationMinutes: slot.durationMinutes,
        capacity: slot.capacity,
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
    <div className="grid gap-3">
      {days.map((day, dayIndex) => (
        <section
          key={day.localId}
          className="rounded-2xl border border-slate-200 bg-white p-3 shadow-sm"
        >
          <div className="flex items-center justify-between gap-2">
            <label className="grid flex-1 gap-1">
              <span className="text-xs font-black uppercase text-slate-500">
                Day {dayIndex + 1}
              </span>
              <input
                type="date"
                value={day.date}
                onChange={(event) => updateDay(day.localId, event.target.value)}
                className="h-10 rounded-xl border border-slate-200 px-3 text-sm font-bold text-slate-900 outline-none focus:border-sky-400"
              />
            </label>
            <button
              type="button"
              aria-label="Delete day"
              onClick={() => removeDay(day.localId)}
              className="mt-5 flex size-10 items-center justify-center rounded-xl border border-rose-200 text-rose-700 transition hover:bg-rose-50"
            >
              <Trash2 size={17} />
            </button>
          </div>

          <div className="mt-3 grid gap-2">
            {day.slots.map((slot) => (
              <div
                key={slot.localId}
                className="grid grid-cols-[1fr_86px_44px] items-end gap-2 sm:grid-cols-[1fr_110px_110px_44px]"
              >
                <label className="grid gap-1">
                  <span className="text-xs font-bold text-slate-500">Start</span>
                  <input
                    type="time"
                    value={slot.startTime}
                    onChange={(event) =>
                      updateSlot(day.localId, slot.localId, {
                        startTime: event.target.value,
                      })
                    }
                    className="h-10 rounded-xl border border-slate-200 px-3 text-sm font-bold text-slate-900 outline-none focus:border-sky-400"
                  />
                </label>
                <label className="grid gap-1">
                  <span className="text-xs font-bold text-slate-500">Mins</span>
                  <input
                    type="number"
                    min="1"
                    value={slot.durationMinutes}
                    onChange={(event) =>
                      updateSlot(day.localId, slot.localId, {
                        durationMinutes: Number(event.target.value),
                      })
                    }
                    className="h-10 rounded-xl border border-slate-200 px-2 text-sm font-bold text-slate-900 outline-none focus:border-sky-400"
                  />
                </label>
                <label className="hidden gap-1 sm:grid">
                  <span className="text-xs font-bold text-slate-500">Capacity</span>
                  <input
                    type="number"
                    min="1"
                    value={slot.capacity}
                    onChange={(event) =>
                      updateSlot(day.localId, slot.localId, {
                        capacity: Number(event.target.value),
                      })
                    }
                    className="h-10 rounded-xl border border-slate-200 px-2 text-sm font-bold text-slate-900 outline-none focus:border-sky-400"
                  />
                </label>
                <button
                  type="button"
                  aria-label="Delete slot"
                  onClick={() => removeSlot(day.localId, slot.localId)}
                  className="flex size-10 items-center justify-center rounded-xl border border-slate-200 text-slate-600 transition hover:bg-slate-50"
                >
                  <Trash2 size={16} />
                </button>
                <label className="col-span-3 grid gap-1 sm:hidden">
                  <span className="text-xs font-bold text-slate-500">Capacity</span>
                  <input
                    type="number"
                    min="1"
                    value={slot.capacity}
                    onChange={(event) =>
                      updateSlot(day.localId, slot.localId, {
                        capacity: Number(event.target.value),
                      })
                    }
                    className="h-10 rounded-xl border border-slate-200 px-3 text-sm font-bold text-slate-900 outline-none focus:border-sky-400"
                  />
                </label>
              </div>
            ))}
          </div>

          <button
            type="button"
            onClick={() => addSlot(day.localId)}
            className="mt-3 flex h-10 w-full items-center justify-center gap-2 rounded-xl border border-slate-200 text-sm font-bold text-slate-700 transition hover:bg-slate-50"
          >
            <Plus size={16} /> Add Slot
          </button>
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
          <Send size={17} /> {isPending ? "Publishing..." : "Publish Timetable"}
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
      startTime: normalizeTime(slot.startTime),
      durationMinutes: slot.durationMinutes,
      capacity: slot.capacity,
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
    capacity: 1,
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

function normalizeTime(value: string) {
  return value.length >= 5 ? value.slice(0, 5) : value;
}
