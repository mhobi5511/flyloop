"use client";

import Link from "next/link";
import { AtSign, MessageCircle, Plus } from "lucide-react";
import { currentAthlete, getOpportunity } from "@/lib/demo-data";
import { formatDateRange } from "@/lib/opportunities";
import { updateInterestStatus } from "@/lib/demo-store";
import { useDemoState } from "@/lib/use-demo-state";
import type { InterestStatus } from "@/lib/types";

export function CoachDashboardClient() {
  const [state, setState] = useDemoState();
  const myOpportunities = state.opportunities.filter(
    (opportunity) => opportunity.createdBy === "coach-rafa",
  );

  function setStatus(id: string, status: InterestStatus) {
    setState(updateInterestStatus(id, status));
  }

  return (
    <div className="grid gap-5 lg:grid-cols-[0.85fr_1.15fr]">
      <section>
        <div className="flex items-start justify-between gap-3">
          <div>
            <h1 className="text-3xl font-black tracking-tight">
              Coach dashboard
            </h1>
            <p className="mt-2 text-sm leading-6 text-slate-600">
              See demand signals and contact interested athletes externally.
            </p>
          </div>
          <Link
            href="/app/create"
            className="flex h-11 shrink-0 items-center gap-2 rounded-xl bg-sky-600 px-4 text-sm font-bold text-white"
          >
            <Plus size={17} /> Post Opportunity
          </Link>
        </div>

        <div className="mt-5 grid gap-3">
          {myOpportunities.map((opportunity) => (
            <Link
              key={opportunity.id}
              href={`/app/opportunities/${opportunity.id}`}
              className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm"
            >
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="text-xs font-bold uppercase tracking-[0.16em] text-sky-600">
                    {formatDateRange(opportunity.startDate, opportunity.endDate)}
                  </p>
                  <h2 className="mt-1 font-bold text-slate-950">
                    {opportunity.title}
                  </h2>
                </div>
                <div className="rounded-xl bg-sky-50 px-3 py-2 text-sm font-bold text-sky-700">
                  {opportunity.availableSpots} open
                </div>
              </div>
            </Link>
          ))}
        </div>
      </section>

      <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-bold text-sky-700">Inbound interest</p>
            <h2 className="text-2xl font-black tracking-tight">Athletes</h2>
          </div>
          <span className="rounded-full bg-slate-100 px-3 py-1 text-sm font-bold text-slate-700">
            {state.interests.length}
          </span>
        </div>

        <div className="mt-5 grid gap-4">
          {state.interests.map((interest) => {
            const opportunity =
              state.opportunities.find((item) => item.id === interest.opportunityId) ??
              getOpportunity(interest.opportunityId);
            return (
              <div
                key={interest.id}
                className="rounded-2xl border border-slate-200 p-4"
              >
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <h3 className="font-bold text-slate-950">
                      {currentAthlete.name}
                    </h3>
                    <p className="text-sm text-slate-600">
                      {currentAthlete.country} · {opportunity?.title}
                    </p>
                  </div>
                  <select
                    value={interest.status}
                    onChange={(event) =>
                      setStatus(interest.id, event.target.value as InterestStatus)
                    }
                    className="h-10 rounded-xl border border-slate-200 bg-white px-3 text-sm font-semibold text-slate-700 outline-none focus:border-sky-400"
                  >
                    <option value="pending">Pending</option>
                    <option value="accepted">Accepted</option>
                    <option value="declined">Declined</option>
                    <option value="waitlist">Waitlist</option>
                  </select>
                </div>

                <div className="mt-4 grid gap-2 sm:grid-cols-2">
                  <a
                    href={`https://wa.me/${currentAthlete.phone.replace(/\D/g, "")}`}
                    className="flex h-11 items-center justify-center gap-2 rounded-xl bg-emerald-500 text-sm font-bold text-white"
                  >
                    <MessageCircle size={17} /> WhatsApp
                  </a>
                  <a
                    href={`https://instagram.com/${currentAthlete.instagram}`}
                    className="flex h-11 items-center justify-center gap-2 rounded-xl border border-slate-200 text-sm font-bold text-slate-700"
                  >
                    <AtSign size={17} /> Instagram
                  </a>
                </div>
                <p className="mt-3 text-xs font-semibold text-slate-500">
                  Phone: {currentAthlete.phone}
                </p>
              </div>
            );
          })}
        </div>
      </section>
    </div>
  );
}
