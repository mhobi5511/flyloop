"use client";

import { useState, type FormEvent } from "react";
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
  currentUserId: string;
};

type SearchState = {
  country: string;
  month: string;
  coach: string;
  tunnel: string;
};

export function GlobalCampSearch({
  initialCountry,
  initialMonth,
  initialCoach,
  initialTunnel,
  countryOptions,
  monthOptions,
  opportunities,
  currentUserId,
}: GlobalCampSearchProps) {
  const [country, setCountry] = useState(initialCountry);
  const [month, setMonth] = useState(initialMonth);
  const [coach, setCoach] = useState(initialCoach);
  const [tunnel, setTunnel] = useState(initialTunnel);
  const [results, setResults] = useState<Opportunity[] | null>(null);
  const [isSearching, setIsSearching] = useState(false);

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const nextSearch = {
      country,
      month,
      coach: coach.trim(),
      tunnel: tunnel.trim(),
    };

    setIsSearching(true);

    try {
      setResults(filterOpportunities(opportunities, nextSearch));
    } catch (searchError) {
      console.error("Find Camps Worldwide search failed", searchError);
      setResults([]);
    } finally {
      setIsSearching(false);
    }
  }

  function clearSearch() {
    setCountry("");
    setMonth("");
    setCoach("");
    setTunnel("");
    setResults(null);
    setIsSearching(false);
  }

  return (
    <section
      id="find-camps-worldwide"
      className="scroll-mt-20 mt-6 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm"
    >
      <div>
        <h2 className="text-xl font-black tracking-tight text-slate-950">
          Find Camps Worldwide
        </h2>
        <p className="mt-1 text-sm leading-6 text-slate-600">
          Search all upcoming Camps and Huck Jams by country, month, coach, or tunnel.
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

      {results !== null && (country || month || coach || tunnel) ? (
        <button
          type="button"
          onClick={clearSearch}
          className="mt-3 inline-flex text-sm font-bold text-sky-700"
        >
          Clear search
        </button>
      ) : null}

      {results !== null ? (
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
                discoveryBadges={getOwnOpportunityBadges(
                  opportunity,
                  currentUserId,
                )}
              />
            ))
          ) : (
            <p className="rounded-xl bg-slate-50 p-4 text-sm font-semibold text-slate-600">
              No camps found.
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

function filterOpportunities(
  opportunities: Opportunity[],
  search: SearchState,
) {
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

    return countryMatches && monthMatches && coachMatches && tunnelMatches;
  });
}

function getOwnOpportunityBadges(
  opportunity: Opportunity,
  currentUserId: string,
) {
  if (opportunity.createdBy !== currentUserId) {
    return [];
  }

  return [
    {
      label: opportunity.type === "huck_jam" ? "Your Huck Jam" : "Your Camp",
      tone: opportunity.type === "huck_jam" ? "green" : "blue",
    } as const,
  ];
}
