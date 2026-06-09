"use client";

import { useMemo, useState, useTransition } from "react";
import { Send } from "lucide-react";
import { useRouter } from "next/navigation";
import {
  sendOpportunityInterest,
  type CampDayPreferenceInput,
} from "@/app/app/opportunities/actions";

type CampApplyPreferencesFormProps = {
  opportunityId: string;
  dayCount: number;
};

const preferenceOptions = [30, 45, 60, 75, 90];

export function CampApplyPreferencesForm({
  opportunityId,
  dayCount,
}: CampApplyPreferencesFormProps) {
  const router = useRouter();
  const days = useMemo(
    () =>
      Array.from({ length: Math.max(dayCount, 1) }, (_, index) => ({
        dayId: index + 1,
      })),
    [dayCount],
  );
  const [preferences, setPreferences] = useState<number[]>(
    () => Array.from({ length: Math.max(dayCount, 1) }, () => 60),
  );
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [isPending, startTransition] = useTransition();

  function updatePreference(index: number, value: number) {
    setMessage("");
    setError("");
    setPreferences((current) =>
      current.map((minutes, currentIndex) => (currentIndex === index ? value : minutes)),
    );
  }

  function submit() {
    setMessage("");
    setError("");

    const campPreferences: CampDayPreferenceInput[] = days.map((day, index) => ({
      dayId: day.dayId,
      preferredMinutes: preferences[index] ?? 60,
    }));

    startTransition(async () => {
      const result = await sendOpportunityInterest(opportunityId, campPreferences);

      if (!result.ok) {
        setError(result.message);
        return;
      }

      setMessage(result.message);
      router.refresh();
    });
  }

  return (
    <section className="grid gap-4 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
      <div>
        <h2 className="text-xl font-black tracking-tight text-slate-950">
          Apply with your preferences
        </h2>
        <p className="mt-1 text-sm font-semibold text-slate-600">
          Choose your preferred flying minutes for each camp day. This is not a booking.
        </p>
      </div>

      <div className="grid gap-3">
        {days.map((day, index) => (
          <label
            key={day.dayId}
            className="grid gap-1 rounded-2xl border border-slate-200 bg-slate-50 p-3"
          >
            <span className="text-sm font-black text-slate-950">
              Day {day.dayId}
            </span>
            <select
              value={preferences[index] ?? 60}
              onChange={(event) =>
                updatePreference(index, Number(event.target.value))
              }
              className="h-11 rounded-xl border border-slate-200 bg-white px-3 text-sm font-bold text-slate-950 outline-none focus:border-sky-400"
            >
              {preferenceOptions.map((minutes) => (
                <option key={minutes} value={minutes}>
                  {minutes} minutes
                </option>
              ))}
            </select>
          </label>
        ))}
      </div>

      <button
        type="button"
        disabled={isPending}
        onClick={submit}
        className="inline-flex h-11 items-center justify-center gap-2 rounded-xl bg-sky-600 px-4 text-sm font-black text-white transition hover:bg-sky-700 disabled:bg-slate-300"
      >
        <Send size={17} /> {isPending ? "Sending..." : "Apply"}
      </button>

      {message ? (
        <p className="rounded-xl bg-emerald-50 p-3 text-sm font-semibold text-emerald-700 whitespace-pre-line">
          {message}
        </p>
      ) : null}
      {error ? (
        <p className="rounded-xl bg-rose-50 p-3 text-sm font-semibold text-rose-700 whitespace-pre-line">
          {error}
        </p>
      ) : null}
    </section>
  );
}
