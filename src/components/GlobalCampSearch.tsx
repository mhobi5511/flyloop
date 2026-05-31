"use client";

import { useEffect, useMemo, useRef, useState, type FormEvent } from "react";
import { OpportunityCard } from "@/components/OpportunityCard";
import type { Opportunity } from "@/lib/types";

type GlobalCampSearchProps = {
  initialCountry: string;
  initialMonth: string;
  countryOptions: string[];
  monthOptions: Array<{ value: string; label: string }>;
  opportunities: Opportunity[];
  excludedOpportunityIds: string[];
  currentUserId: string;
};

type SearchState = {
  country: string;
  month: string;
  submitted: boolean;
};

export function GlobalCampSearch({
  initialCountry,
  initialMonth,
  countryOptions,
  monthOptions,
  opportunities,
  excludedOpportunityIds,
  currentUserId,
}: GlobalCampSearchProps) {
  const sectionRef = useRef<HTMLElement | null>(null);
  const [country, setCountry] = useState(initialCountry);
  const [month, setMonth] = useState(initialMonth);
  const [search, setSearch] = useState<SearchState>({
    country: initialCountry,
    month: initialMonth,
    submitted: Boolean(initialCountry || initialMonth),
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

      return (
        countryMatches &&
        monthMatches &&
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
      submitted: true,
    });
  }

  function clearSearch() {
    setCountry("");
    setMonth("");
    setSearch({ country: "", month: "", submitted: false });
    setIsSearching(false);
  }

  return (
    <section
      ref={sectionRef}
      className="scroll-mt-20 mt-8 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm"
    >
      <div>
        <h2 className="text-xl font-black tracking-tight text-slate-950">
          Find Camps Worldwide
        </h2>
        <p className="mt-1 text-sm leading-6 text-slate-600">
          Search all published camps by country and month.
        </p>
      </div>

      <form
        className="mt-4 grid gap-2 sm:grid-cols-[1fr_1fr_auto]"
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
        <button
          type="submit"
          className="h-11 rounded-xl bg-slate-950 px-4 text-sm font-bold text-white"
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
