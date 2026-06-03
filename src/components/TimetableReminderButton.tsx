"use client";

import { useState, useTransition } from "react";
import { Bell, CheckCircle2 } from "lucide-react";
import { setTimetableReminder } from "@/app/app/opportunities/actions";

type TimetableReminderButtonProps = {
  opportunityId: string;
  initialReminderSet?: boolean;
};

export function TimetableReminderButton({
  opportunityId,
  initialReminderSet = false,
}: TimetableReminderButtonProps) {
  const [hasReminder, setHasReminder] = useState(initialReminderSet);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [isPending, startTransition] = useTransition();

  function remindMe() {
    setMessage("");
    setError("");

    startTransition(async () => {
      const result = await setTimetableReminder(opportunityId);

      if (!result.ok) {
        setError(result.message);
        return;
      }

      setHasReminder(true);
      setMessage(result.message);
    });
  }

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-3 shadow-sm">
      <button
        type="button"
        disabled={isPending || hasReminder}
        onClick={remindMe}
        className="flex h-11 w-full items-center justify-center gap-2 rounded-xl bg-sky-600 px-4 text-sm font-black text-white transition hover:bg-sky-700 disabled:cursor-not-allowed disabled:bg-slate-300"
      >
        {hasReminder ? <CheckCircle2 size={17} /> : <Bell size={17} />}
        {hasReminder
          ? "Reminder set"
          : isPending
            ? "Setting reminder..."
            : "Notify me when times are available"}
      </button>
      <p className="mt-2 text-center text-sm font-semibold leading-6 text-slate-600">
        {message ||
          (hasReminder
            ? "You'll be notified when times are available."
            : "No application is created and no capacity is held.")}
      </p>
      {error ? (
        <p className="mt-3 rounded-xl bg-rose-50 p-3 text-sm font-semibold text-rose-700">
          {error}
        </p>
      ) : null}
    </div>
  );
}
