"use client";

import { AppShell } from "@/components/AppShell";
import { OpportunityCard } from "@/components/OpportunityCard";
import { Section } from "@/components/Section";
import { followedCoachIds, followedTunnelIds } from "@/lib/demo-data";
import { isLastMinuteOpportunity, opportunityViewModel } from "@/lib/opportunities";
import { useDemoState } from "@/lib/use-demo-state";

export function HomeFeedClient() {
  const [state] = useDemoState();
  const published = state.opportunities
    .filter((opportunity) => opportunity.status === "published")
    .map(opportunityViewModel);

  const lastMinute = published.filter((opportunity) =>
    isLastMinuteOpportunity(opportunity),
  );
  const upcoming = published
    .filter((opportunity) => !isLastMinuteOpportunity(opportunity))
    .sort(
      (a, b) =>
        (a.tunnelDisplayDistanceKm ?? 9999) -
        (b.tunnelDisplayDistanceKm ?? 9999),
    );
  const followedCoachTargets = new Set([
    ...followedCoachIds,
    ...state.follows
      .filter((follow) => follow.targetType === "coach")
      .map((follow) => follow.targetId),
  ]);
  const followedTunnelTargets = new Set([
    ...followedTunnelIds,
    ...state.follows
      .filter((follow) => follow.targetType === "tunnel")
      .map((follow) => follow.targetId),
  ]);

  const followedCoaches = published.filter(
    (opportunity) =>
      opportunity.coachId && followedCoachTargets.has(opportunity.coachId),
  );
  const followedTunnels = published.filter((opportunity) =>
    followedTunnelTargets.has(opportunity.tunnelId),
  );

  return (
    <AppShell active="home">
      <div className="rounded-3xl bg-gradient-to-br from-sky-600 to-cyan-500 p-5 text-white shadow-sm">
        <p className="text-sm font-bold text-sky-100">Good afternoon, Lina</p>
        <h1 className="mt-2 text-3xl font-black tracking-tight">
          Find flying you can still join.
        </h1>
        <p className="mt-3 max-w-2xl text-sm leading-6 text-sky-50">
          Last-minute opportunities appear first automatically when dates,
          deadline and open capacity line up.
        </p>
      </div>

      {lastMinute.length > 0 ? (
        <Section title="Last-minute near you" eyebrow="Auto detected">
          {lastMinute.map((opportunity) => (
            <OpportunityCard key={opportunity.id} opportunity={opportunity} />
          ))}
        </Section>
      ) : (
        <Section title="Upcoming opportunities">
          {upcoming.map((opportunity) => (
            <OpportunityCard key={opportunity.id} opportunity={opportunity} />
          ))}
        </Section>
      )}

      {lastMinute.length > 0 ? (
        <Section title="Upcoming near you">
          {upcoming.map((opportunity) => (
            <OpportunityCard key={opportunity.id} opportunity={opportunity} />
          ))}
        </Section>
      ) : null}

      <Section title="From followed coaches">
        {followedCoaches.map((opportunity) => (
          <OpportunityCard key={opportunity.id} opportunity={opportunity} compact />
        ))}
      </Section>

      <Section title="From followed tunnels">
        {followedTunnels.map((opportunity) => (
          <OpportunityCard key={opportunity.id} opportunity={opportunity} compact />
        ))}
      </Section>
    </AppShell>
  );
}
