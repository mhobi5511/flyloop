import { AppShell } from "@/components/AppShell";
import { OpportunityCard } from "@/components/OpportunityCard";
import { Section } from "@/components/Section";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { mapOpportunity, type HomeFeedRow } from "@/lib/supabase/mappers";
import type { Opportunity } from "@/lib/types";

export default async function AppHomePage() {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const [{ data: profile }, { data }] = await Promise.all([
    supabase.from("profiles").select("full_name").eq("id", user?.id).maybeSingle(),
    supabase.rpc("get_home_feed"),
  ]);

  const rows = (data ?? []) as HomeFeedRow[];
  const mapped = rows.map((row) => ({
    opportunity: mapOpportunity(row),
    feedPriority: row.feed_priority ?? 5,
    isLastMinute: row.is_last_minute ?? false,
  }));

  const lastMinute: Opportunity[] = [];
  const upcoming: Opportunity[] = [];
  const followedCoaches: Opportunity[] = [];
  const followedTunnels: Opportunity[] = [];

  for (const item of mapped) {
    if (item.isLastMinute) {
      lastMinute.push(item.opportunity);
    } else {
      upcoming.push(item.opportunity);
    }

    if (item.feedPriority === 3) {
      followedCoaches.push(item.opportunity);
    }

    if (item.feedPriority === 4) {
      followedTunnels.push(item.opportunity);
    }
  }

  return (
    <AppShell active="home">
      <div className="rounded-3xl bg-gradient-to-br from-sky-600 to-cyan-500 p-5 text-white shadow-sm">
        <p className="text-sm font-bold text-sky-100">
          Good to see you{profile?.full_name ? `, ${profile.full_name}` : ""}
        </p>
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
      ) : null}

      <Section title={lastMinute.length > 0 ? "Upcoming near you" : "Upcoming opportunities"}>
        {upcoming.length > 0 ? (
          upcoming.map((opportunity) => (
            <OpportunityCard key={opportunity.id} opportunity={opportunity} />
          ))
        ) : (
          <p className="rounded-2xl border border-slate-200 bg-white p-4 text-sm text-slate-600">
            No published opportunities yet.
          </p>
        )}
      </Section>

      {followedCoaches.length > 0 ? (
        <Section title="From followed coaches">
          {followedCoaches.map((opportunity) => (
            <OpportunityCard key={opportunity.id} opportunity={opportunity} compact />
          ))}
        </Section>
      ) : null}

      {followedTunnels.length > 0 ? (
        <Section title="From followed tunnels">
          {followedTunnels.map((opportunity) => (
            <OpportunityCard key={opportunity.id} opportunity={opportunity} compact />
          ))}
        </Section>
      ) : null}
    </AppShell>
  );
}
