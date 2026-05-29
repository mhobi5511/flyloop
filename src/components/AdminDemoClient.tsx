"use client";

import Link from "next/link";
import { RotateCcw } from "lucide-react";
import { readDemoState, resetDemoState, setDemoRole } from "@/lib/demo-store";
import { useDemoState } from "@/lib/use-demo-state";
import { isLastMinuteOpportunity } from "@/lib/opportunities";
import type { UserRole } from "@/lib/types";

export function AdminDemoClient() {
  const [state, setState] = useDemoState();

  function reset() {
    resetDemoState();
    setState(readDemoState());
  }

  function switchRole(role: UserRole) {
    setState(setDemoRole(role));
  }

  return (
    <div className="mx-auto max-w-5xl">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-3xl font-black tracking-tight">Admin tools</h1>
          <p className="mt-2 text-sm leading-6 text-slate-600">
            Reset local test data, inspect records and switch the visual mode.
          </p>
        </div>
        <button
          type="button"
          onClick={reset}
          className="flex h-11 items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 text-sm font-bold text-slate-700"
        >
          <RotateCcw size={17} /> Reset test data
        </button>
      </div>

      <section className="mt-5 rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
        <h2 className="text-xl font-bold tracking-tight">Visual mode</h2>
        <div className="mt-4 grid grid-cols-3 gap-2">
          {(["athlete", "coach", "admin"] as UserRole[]).map((role) => (
            <button
              key={role}
              type="button"
              onClick={() => switchRole(role)}
              className={`h-11 rounded-xl text-sm font-bold capitalize ${
                state.role === role
                  ? "bg-sky-600 text-white"
                  : "border border-slate-200 bg-white text-slate-700"
              }`}
            >
              {role}
            </button>
          ))}
        </div>
      </section>

      <section className="mt-6 rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="flex items-center justify-between">
          <h2 className="text-xl font-bold tracking-tight">All opportunities</h2>
          <span className="rounded-full bg-slate-100 px-3 py-1 text-sm font-bold text-slate-700">
            {state.opportunities.length}
          </span>
        </div>
        <div className="mt-4 grid gap-3">
          {state.opportunities.map((opportunity) => (
            <Link
              key={opportunity.id}
              href={`/app/opportunities/${opportunity.id}`}
              className="rounded-2xl border border-slate-200 p-4"
            >
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="font-bold text-slate-950">{opportunity.title}</p>
                <div className="flex gap-2">
                  <span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-bold text-slate-600">
                    {opportunity.type === "huck_jam" ? "Huck Jam" : "Camp"}
                  </span>
                  {isLastMinuteOpportunity(opportunity) ? (
                    <span className="rounded-full bg-amber-50 px-2.5 py-1 text-xs font-bold text-amber-700">
                      Last-minute
                    </span>
                  ) : null}
                </div>
              </div>
              <p className="mt-1 text-sm text-slate-600">
                {opportunity.startDate} · {opportunity.availableSpots} open spots
              </p>
            </Link>
          ))}
        </div>
      </section>

      <section className="mt-6 rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="flex items-center justify-between">
          <h2 className="text-xl font-bold tracking-tight">All interests</h2>
          <span className="rounded-full bg-slate-100 px-3 py-1 text-sm font-bold text-slate-700">
            {state.interests.length}
          </span>
        </div>
        <div className="mt-4 grid gap-3">
          {state.interests.map((interest) => {
            const opportunity = state.opportunities.find(
              (item) => item.id === interest.opportunityId,
            );
            return (
              <div
                key={interest.id}
                className="rounded-2xl border border-slate-200 p-4"
              >
                <p className="font-bold text-slate-950">
                  {opportunity?.title ?? "Unknown opportunity"}
                </p>
                <p className="mt-1 text-sm text-slate-600">
                  Lina Demo Athlete · {interest.status}
                </p>
              </div>
            );
          })}
        </div>
      </section>
    </div>
  );
}
