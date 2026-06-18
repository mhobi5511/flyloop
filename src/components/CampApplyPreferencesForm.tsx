"use client";

import { useMemo, useState, useTransition } from "react";
import type { ReactNode } from "react";
import { CheckCircle2, ChevronLeft, Send } from "lucide-react";
import { useRouter } from "next/navigation";
import {
  sendOpportunityInterest,
  type CampDayPreferenceInput,
} from "@/app/app/opportunities/actions";
import {
  formatCampPreferenceMinutes,
  getCampDays,
} from "@/lib/camp-days";
import type { CampTunnelTimeMode, TunnelTimeStatus } from "@/lib/types";

type CampApplyPreferencesFormProps = {
  opportunityId: string;
  campStartDate: string;
  campEndDate: string;
  tunnelTimeMode?: CampTunnelTimeMode;
  isFull?: boolean;
};

const preferenceOptions = [
  { value: 0, label: "No flying" },
  { value: 30, label: formatCampPreferenceMinutes(30) },
  { value: 45, label: formatCampPreferenceMinutes(45) },
  { value: 60, label: formatCampPreferenceMinutes(60) },
  { value: 75, label: formatCampPreferenceMinutes(75) },
  { value: 90, label: formatCampPreferenceMinutes(90) },
];

type ApplicationStep = "preferences" | "tunnel-time" | "submit";

export function CampApplyPreferencesForm({
  opportunityId,
  campStartDate,
  campEndDate,
  tunnelTimeMode = "athletes_may_use_own_tunnel_time",
  isFull = false,
}: CampApplyPreferencesFormProps) {
  const router = useRouter();
  const days = useMemo(() => getCampDays(campStartDate, campEndDate), [
    campStartDate,
    campEndDate,
  ]);
  const [preferences, setPreferences] = useState<number[]>(
    () => Array.from({ length: Math.max(days.length, 1) }, () => 60),
  );
  const [step, setStep] = useState<ApplicationStep>("preferences");
  const [tunnelTimeStatus, setTunnelTimeStatus] =
    useState<TunnelTimeStatus | "">("");
  const [tunnelAccountEmail, setTunnelAccountEmail] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [isPending, startTransition] = useTransition();
  const requiresCoachManagedTunnelTime =
    tunnelTimeMode === "tunnel_time_must_be_purchased_through_coach";
  const hasTunnelTimeStep = !requiresCoachManagedTunnelTime;
  const stepCount = hasTunnelTimeStep ? 3 : 2;

  function updatePreference(index: number, value: number) {
    setMessage("");
    setError("");
    setPreferences((current) =>
      current.map((minutes, currentIndex) => (currentIndex === index ? value : minutes)),
    );
  }

  function validateTunnelTime() {
    if (!hasTunnelTimeStep) {
      return "";
    }

    if (
      tunnelTimeStatus !== "owns_tunnel_time" &&
      tunnelTimeStatus !== "needs_tunnel_time"
    ) {
      return "Choose whether you already have tunnel time at this tunnel.";
    }

    const email = tunnelAccountEmail.trim();

    if (tunnelTimeStatus === "owns_tunnel_time") {
      if (!email) {
        return "Enter the email address used for your tunnel account.";
      }

      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
        return "Enter a valid tunnel account email address.";
      }
    }

    return "";
  }

  function goToTunnelTime() {
    if (!hasTunnelTimeStep) {
      goToSubmit();
      return;
    }

    setMessage("");
    setError("");
    setStep("tunnel-time");
  }

  function goToSubmit() {
    setMessage("");
    const tunnelTimeError = validateTunnelTime();

    if (tunnelTimeError) {
      setError(tunnelTimeError);
      return;
    }

    setError("");
    setStep("submit");
  }

  function submit() {
    setMessage("");
    const tunnelTimeError = validateTunnelTime();

    if (tunnelTimeError) {
      setError(tunnelTimeError);
      setStep("tunnel-time");
      return;
    }

    setError("");

    const campPreferences: CampDayPreferenceInput[] = days.map((day, index) => ({
      dayId: day.dayId,
      preferredMinutes: preferences[index] ?? 60,
    }));
    const tunnelTimeInput = hasTunnelTimeStep
      ? {
          status: tunnelTimeStatus,
          accountEmail: tunnelAccountEmail,
        }
      : undefined;

    startTransition(async () => {
      const result = await sendOpportunityInterest(
        opportunityId,
        campPreferences,
        tunnelTimeInput,
      );

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
      {requiresCoachManagedTunnelTime ? (
        <div className="rounded-2xl border border-amber-200 bg-amber-50 px-3 py-2 text-sm font-black text-amber-900">
          Tunnel time must be purchased through the coach for this camp.
        </div>
      ) : null}
      <div>
        <h2 className="text-2xl font-black tracking-tight text-slate-950">
          Apply with your preferences
        </h2>
        <p className="mt-1 text-sm font-semibold text-slate-600">
          Choose your preferred flying minutes and add your tunnel time availability.
        </p>
      </div>

      <div className={`grid gap-2 text-xs font-black uppercase tracking-wide ${stepCount === 2 ? "grid-cols-2" : "grid-cols-3"}`}>
        <StepPill active={step === "preferences"} done={step !== "preferences"}>
          Flight Preferences
        </StepPill>
        {hasTunnelTimeStep ? (
          <StepPill active={step === "tunnel-time"} done={step === "submit"}>
            Tunnel Time
          </StepPill>
        ) : null}
        <StepPill active={step === "submit"} done={false}>
          Submit
        </StepPill>
      </div>

      {step === "preferences" ? (
        <>
          <div className="grid gap-3">
            {days.map((day, index) => (
              <label
                key={day.dayId}
                className="grid gap-1 rounded-2xl border border-slate-200 bg-slate-50 p-3"
              >
                <span className="text-sm font-black text-slate-950">
                  {day.label}
                </span>
                <select
                  value={preferences[index] ?? 60}
                  onChange={(event) =>
                    updatePreference(index, Number(event.target.value))
                  }
                  className="h-11 rounded-xl border border-slate-200 bg-white px-3 text-sm font-bold text-slate-950 outline-none focus:border-sky-400"
                >
                  {preferenceOptions.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </label>
            ))}
          </div>

          <button
            type="button"
            onClick={hasTunnelTimeStep ? goToTunnelTime : goToSubmit}
            className="inline-flex h-12 items-center justify-center gap-2 rounded-xl bg-sky-600 px-4 text-base font-black text-white shadow-sm transition hover:bg-sky-700"
          >
            Continue
          </button>
        </>
      ) : null}

      {hasTunnelTimeStep && step === "tunnel-time" ? (
        <div className="grid gap-4">
          <fieldset className="grid gap-2">
            <legend className="text-sm font-black text-slate-950">
              Do you already have tunnel time at this tunnel?
            </legend>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                aria-pressed={tunnelTimeStatus === "owns_tunnel_time"}
                onClick={() => {
                  setError("");
                  setTunnelTimeStatus("owns_tunnel_time");
                }}
                className={`h-12 rounded-xl border px-4 text-sm font-black transition ${
                  tunnelTimeStatus === "owns_tunnel_time"
                    ? "border-emerald-300 bg-emerald-50 text-emerald-800"
                    : "border-slate-200 bg-white text-slate-700 hover:border-sky-300"
                }`}
              >
                Yes
              </button>
              <button
                type="button"
                aria-pressed={tunnelTimeStatus === "needs_tunnel_time"}
                onClick={() => {
                  setError("");
                  setTunnelTimeStatus("needs_tunnel_time");
                  setTunnelAccountEmail("");
                }}
                className={`h-12 rounded-xl border px-4 text-sm font-black transition ${
                  tunnelTimeStatus === "needs_tunnel_time"
                    ? "border-rose-200 bg-rose-50 text-rose-800"
                    : "border-slate-200 bg-white text-slate-700 hover:border-sky-300"
                }`}
              >
                No
              </button>
            </div>
          </fieldset>

          {tunnelTimeStatus === "owns_tunnel_time" ? (
            <label className="grid gap-1">
              <span className="text-sm font-black text-slate-950">
                Tunnel Account Email
              </span>
              <input
                type="email"
                value={tunnelAccountEmail}
                onChange={(event) => {
                  setError("");
                  setTunnelAccountEmail(event.target.value);
                }}
                required
                placeholder="name@example.com"
                className="h-11 rounded-xl border border-slate-200 bg-white px-3 text-sm font-bold text-slate-950 outline-none focus:border-sky-400"
              />
            </label>
          ) : null}

          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={() => {
                setError("");
                setStep("preferences");
              }}
              className="inline-flex h-12 items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-4 text-base font-black text-slate-700 transition hover:border-sky-300"
            >
              <ChevronLeft size={17} /> Back
            </button>
            <button
              type="button"
              onClick={goToSubmit}
              className="inline-flex h-12 items-center justify-center gap-2 rounded-xl bg-sky-600 px-4 text-base font-black text-white shadow-sm transition hover:bg-sky-700"
            >
              Continue
            </button>
          </div>
        </div>
      ) : null}

      {step === "submit" ? (
        <div className="grid gap-4">
          <div className="grid gap-2 rounded-2xl border border-slate-200 bg-slate-50 p-3">
            <p className="text-sm font-black text-slate-950">
              Submit Application
            </p>
            {isFull ? (
              <div className="rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-sm font-semibold leading-6 text-amber-900">
                This camp has already reached its participant capacity.
                <br />
                You can still apply, but there is a high likelihood that your
                application will be placed on the waitlist or declined.
                <br />
                You may continue if you wish.
              </div>
            ) : null}
            <p className="text-sm font-semibold text-slate-600">
              Tunnel Time:{" "}
              {tunnelTimeStatus === "owns_tunnel_time"
                ? "Available"
                : "Not Available"}
            </p>
            {tunnelTimeStatus === "owns_tunnel_time" ? (
              <p className="text-sm font-semibold text-slate-600">
                Tunnel Account Email: {tunnelAccountEmail.trim().toLowerCase()}
              </p>
            ) : null}
          </div>

          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              disabled={isPending}
              onClick={() => {
                setError("");
                setStep("tunnel-time");
              }}
              className="inline-flex h-12 items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-4 text-base font-black text-slate-700 transition hover:border-sky-300 disabled:bg-slate-100"
            >
              <ChevronLeft size={17} /> Back
            </button>
            <button
              type="button"
              disabled={isPending}
              onClick={submit}
              className="inline-flex h-12 items-center justify-center gap-2 rounded-xl bg-sky-600 px-4 text-base font-black text-white shadow-sm transition hover:bg-sky-700 disabled:bg-slate-300"
            >
              <Send size={17} /> {isPending ? "Sending..." : "Submit"}
            </button>
          </div>
        </div>
      ) : null}

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

function StepPill({
  active,
  done,
  children,
}: {
  active: boolean;
  done: boolean;
  children: ReactNode;
}) {
  return (
    <div
      className={`flex min-h-10 items-center justify-center gap-1 rounded-xl px-2 text-center ${
        active
          ? "bg-sky-600 text-white"
          : done
            ? "bg-emerald-50 text-emerald-800"
            : "bg-slate-100 text-slate-500"
      }`}
    >
      {done ? <CheckCircle2 size={14} /> : null}
      <span>{children}</span>
    </div>
  );
}
