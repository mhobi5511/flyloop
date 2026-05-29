"use client";

import { useMemo, useState, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { createDemoOpportunity } from "@/lib/demo-store";
import { coaches, tunnels } from "@/lib/demo-data";
import { useDemoState } from "@/lib/use-demo-state";
import type { OpportunityType } from "@/lib/types";

function isoDateFromNow(days: number) {
  const date = new Date();
  date.setDate(date.getDate() + days);
  return date.toISOString().slice(0, 10);
}

export function CreateOpportunityForm() {
  const router = useRouter();
  const [, setState] = useDemoState();
  const [type, setType] = useState<OpportunityType>("camp");
  const [title, setTitle] = useState("Dynamic Camp with Rafa");
  const [coachId, setCoachId] = useState("coach-rafa");
  const [tunnelId, setTunnelId] = useState("tunnel-jochen");
  const [startDate, setStartDate] = useState(isoDateFromNow(5));
  const [endDate, setEndDate] = useState(isoDateFromNow(6));
  const [registrationDeadline, setRegistrationDeadline] = useState(
    isoDateFromNow(2),
  );
  const [price, setPrice] = useState(420);
  const [totalCapacity, setTotalCapacity] = useState(8);

  const willBeLastMinute = useMemo(() => {
    const start = new Date(`${startDate}T00:00:00.000Z`);
    const now = new Date();
    const daysUntilStart =
      (start.getTime() - now.getTime()) / (1000 * 60 * 60 * 24);
    return daysUntilStart >= 0 && daysUntilStart <= 10 && totalCapacity > 0;
  }, [startDate, totalCapacity]);

  function publish() {
    setState(
      createDemoOpportunity({
        type,
        title: title.trim() || "Untitled opportunity",
        coachId,
        tunnelId,
        startDate,
        endDate,
        registrationDeadline,
        price,
        totalCapacity,
        availableSpots: totalCapacity,
      }),
    );
    router.push("/app");
  }

  return (
    <form className="mt-5 grid gap-4 rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="rounded-2xl bg-sky-50 p-4 text-sm font-semibold text-sky-800">
        {willBeLastMinute
          ? "This will appear as last-minute automatically after publishing."
          : "This will appear as an upcoming opportunity after publishing."}
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Type">
          <select
            className="field"
            value={type}
            onChange={(event) => setType(event.target.value as OpportunityType)}
          >
            <option value="camp">Camp</option>
            <option value="huck_jam">Huck Jam</option>
          </select>
        </Field>
        <Field label="Title">
          <input
            className="field"
            value={title}
            onChange={(event) => setTitle(event.target.value)}
          />
        </Field>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Coach">
          <select
            className="field"
            value={coachId}
            onChange={(event) => setCoachId(event.target.value)}
          >
            {type === "huck_jam" ? <option value="">Organizer-led</option> : null}
            {coaches.map((coach) => (
              <option key={coach.id} value={coach.id}>
                {coach.name}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Tunnel">
          <select
            className="field"
            value={tunnelId}
            onChange={(event) => setTunnelId(event.target.value)}
          >
            {tunnels.map((tunnel) => (
              <option key={tunnel.id} value={tunnel.id}>
                {tunnel.name}
              </option>
            ))}
          </select>
        </Field>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <Field label="Start date">
          <input
            type="date"
            className="field"
            value={startDate}
            onChange={(event) => setStartDate(event.target.value)}
          />
        </Field>
        <Field label="End date">
          <input
            type="date"
            className="field"
            value={endDate}
            onChange={(event) => setEndDate(event.target.value)}
          />
        </Field>
        <Field label="Registration deadline">
          <input
            type="date"
            className="field"
            value={registrationDeadline}
            onChange={(event) => setRegistrationDeadline(event.target.value)}
          />
        </Field>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Price">
          <input
            type="number"
            className="field"
            value={price}
            onChange={(event) => setPrice(Number(event.target.value))}
          />
        </Field>
        <Field label="Capacity">
          <input
            type="number"
            className="field"
            value={totalCapacity}
            onChange={(event) => setTotalCapacity(Number(event.target.value))}
          />
        </Field>
      </div>

      <button
        type="button"
        onClick={publish}
        className="mt-2 h-12 rounded-xl bg-sky-600 text-sm font-bold text-white"
      >
        Publish opportunity
      </button>
    </form>
  );
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="grid gap-1 text-sm font-bold text-slate-700">
      {label}
      {children}
    </label>
  );
}
