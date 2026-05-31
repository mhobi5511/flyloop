"use client";

import { useEffect, useMemo, useRef, useState, type FormEvent } from "react";
import { OpportunityCard } from "@/components/OpportunityCard";
import type { Opportunity } from "@/lib/types";

type GlobalCampSearchProps = {
  initialCountry: string;
  initialMonth: string;
  initialCoach: string;
  initialTunnel: string;
  countryOptions: string[];
  monthOptions: Array<{ value: string; label: string }>;
  opportunities: Opportunity[];
  excludedOpportunityIds: string[];
  currentUserId: string;
};

type SearchState = {
  country: string;
  month: string;
  coach: string;
  tunnel: string;
  submitted: boolean;
};

export function GlobalCampSearch({
  initialCountry,
  initialMonth,
  initialCoach,
  initialTunnel,
  countryOptions,
  monthOptions,
  opportunities,
  excludedOpportunityIds,
  currentUserId,
}: GlobalCampSearchProps) {
  const sectionRef = useRef<HTMLElement | null>(null);
  const [country, setCountry] = useState(initialCountry);
  const [month, setMonth] = useState(initialMonth);
  const [coach, setCoach] = useState(initialCoach);
  const [tunnel, setTunnel] = useState(initialTunnel);
  const [search, setSearch] = useState<SearchState>({
    country: initialCountry,
    month: initialMonth,
    coach: initialCoach,
    tunnel: initialTunnel,
    submitted: Boolean(initialCountry || initialMonth || initialCoach || initialTunnel),
  });
  const [isSearching, setIsSearching] = useState(false);
  const excludedIds = useMemo(
    () => new Set(excludedOpportunityIds),
    [excludedOpportunityIds],
  );
  const results = useMemo(() => {
    if (!search.submitted) {
      return [];
    }

    return opportunities.filter((opportunity) => {
      const countryMatches =
        !search.country || opportunity.tunnelCountry === search.country;
      const monthMatches =
        !search.month || opportunity.startDate?.slice(0, 7) === search.month;
      const coachMatches =
        !search.coach ||
        normalize(opportunity.coachName).includes(normalize(search.coach));
      const tunnelMatches =
        !search.tunnel ||
        normalize(opportunity.tunnelName).includes(normalize(search.tunnel));

      return (
        countryMatches &&
        monthMatches &&
        coachMatches &&
        tunnelMatches &&
        !excludedIds.has(opportunity.id)
      );
    });
  }, [excludedIds, opportunities, search]);

  useEffect(() => {
    if (!search.submitted) {
      return;
    }

    const timeout = window.setTimeout(() => {
      sectionRef.current?.scrollIntoView({
        behavior: "smooth",
        block: "start",
      });
      setIsSearching(false);
    }, 80);

    return () => window.clearTimeout(timeout);
  }, [search]);

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setIsSearching(true);
    setSearch({
      country,
      month,
      coach: coach.trim(),
      tunnel: tunnel.trim(),
      submitted: true,
    });
  }

  function clearSearch() {
    setCountry("");
    setMonth("");
    setCoach("");
    setTunnel("");
    setSearch({ country: "", month: "", coach: "", tunnel: "", submitted: false });
    setIsSearching(false);
  }

  return (
    <section
      id="find-camps-worldwide"
      ref={sectionRef}
      className="scroll-mt-20 mt-6 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm"
    >
      <div>
        <h2 className="text-xl font-black tracking-tight text-slate-950">
          Find Camps Worldwide
        </h2>
        <p className="mt-1 text-sm leading-6 text-slate-600">
          Search all published camps by country, month, coach, or tunnel.
        </p>
      </div>

      <form
        className="mt-4 grid gap-2 sm:grid-cols-2 lg:grid-cols-[1fr_1fr_1fr_1fr_auto]"
        onSubmit={submit}
      >
        <label>
          <span className="sr-only">Country</span>
          <select
            name="country"
            value={country}
            onChange={(event) => setCountry(event.target.value)}
            className="field"
          >
            <option value="">All countries</option>
            {countryOptions.map((item) => (
              <option key={item} value={item}>
                {item}
              </option>
            ))}
          </select>
        </label>
        <label>
          <span className="sr-only">Month</span>
          <select
            name="month"
            value={month}
            onChange={(event) => setMonth(event.target.value)}
            className="field"
          >
            <option value="">All months</option>
            {monthOptions.map((item) => (
              <option key={item.value} value={item.value}>
                {item.label}
              </option>
            ))}
          </select>
        </label>
        <label>
          <span className="sr-only">Coach</span>
          <input
            name="coach"
            value={coach}
            onChange={(event) => setCoach(event.target.value)}
            className="field"
            placeholder="Coach"
          />
        </label>
        <label>
          <span className="sr-only">Tunnel</span>
          <input
            name="tunnel"
            value={tunnel}
            onChange={(event) => setTunnel(event.target.value)}
            className="field"
            placeholder="Tunnel"
          />
        </label>
        <button
          type="submit"
          className="h-11 rounded-xl bg-slate-950 px-4 text-sm font-bold text-white sm:col-span-2 lg:col-span-1"
        >
          {isSearching ? "Searching..." : "Find Camp"}
        </button>
      </form>

      {search.submitted ? (
        <button
          type="button"
          onClick={clearSearch}
          className="mt-3 inline-flex text-sm font-bold text-sky-700"
        >
          Clear search
        </button>
      ) : null}

      {search.submitted ? (
        <div className="mt-4 grid gap-3 md:grid-cols-2">
          {isSearching ? (
            <p className="rounded-xl bg-slate-50 p-4 text-sm font-semibold text-slate-600">
              Searching camps...
            </p>
          ) : results.length > 0 ? (
            results.map((opportunity) => (
              <OpportunityCard
                key={opportunity.id}
                opportunity={opportunity}
                dense
                currentUserId={currentUserId}
              />
            ))
          ) : (
            <p className="rounded-xl bg-slate-50 p-4 text-sm font-semibold text-slate-600">
              No camps found for this search.
            </p>
          )}
        </div>
      ) : null}
    </section>
  );
}

function normalize(value?: string) {
  return (value ?? "").trim().toLowerCase();
}
