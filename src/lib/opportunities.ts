import {
  followedCoachIds,
  followedTunnelIds,
  getCoach,
  getTunnel,
  opportunities,
} from "./demo-data";
import type { Opportunity } from "./types";

const lastMinuteWindowDays = 10;

export function isLastMinuteOpportunity(
  opportunity: Opportunity,
  now = new Date("2026-05-29T12:00:00.000Z"),
) {
  const startsAt = new Date(`${opportunity.startDate}T00:00:00.000Z`);
  const deadline = new Date(`${opportunity.registrationDeadline}T23:59:59.000Z`);
  const daysUntilStart =
    (startsAt.getTime() - now.getTime()) / (1000 * 60 * 60 * 24);

  return (
    opportunity.status === "published" &&
    opportunity.availableSpots > 0 &&
    deadline >= now &&
    daysUntilStart >= 0 &&
    daysUntilStart <= lastMinuteWindowDays
  );
}

export function formatOpportunityType(type: Opportunity["type"]) {
  return type === "huck_jam" ? "Huck Jam" : "Camp";
}

export function opportunityViewModel(opportunity: Opportunity) {
  const coach = getCoach(opportunity.coachId);
  const tunnel = getTunnel(opportunity.tunnelId);
  return {
    ...opportunity,
    coach,
    tunnel,
    coachDisplayName: coach?.name ?? opportunity.coachName,
    tunnelDisplayName: tunnel?.name ?? opportunity.tunnelName,
    tunnelDisplayDistanceKm:
      tunnel?.distanceKm ?? opportunity.tunnelDistanceKm ?? null,
    isLastMinute:
      opportunity.isLastMinute ?? isLastMinuteOpportunity(opportunity),
    typeLabel: formatOpportunityType(opportunity.type),
  };
}

export function getFeedSections() {
  const published = opportunities
    .filter((opportunity) => opportunity.status === "published")
    .map(opportunityViewModel);

  return {
    lastMinute: published.filter((opportunity) => opportunity.isLastMinute),
    nearUser: published
      .filter((opportunity) => !opportunity.isLastMinute)
      .sort(
        (a, b) => (a.tunnel?.distanceKm ?? 9999) - (b.tunnel?.distanceKm ?? 9999),
      ),
    followedCoaches: published.filter(
      (opportunity) =>
        opportunity.coachId && followedCoachIds.includes(opportunity.coachId),
    ),
    followedTunnels: published.filter((opportunity) =>
      followedTunnelIds.includes(opportunity.tunnelId),
    ),
  };
}

export function formatDateRange(startDate: string, endDate: string) {
  const formatter = new Intl.DateTimeFormat("en", {
    month: "short",
    day: "numeric",
  });
  const start = formatter.format(new Date(`${startDate}T00:00:00.000Z`));
  const end = formatter.format(new Date(`${endDate}T00:00:00.000Z`));
  return start === end ? start : `${start} - ${end}`;
}

export function formatPrice(price: number, currency: string) {
  return new Intl.NumberFormat("en", {
    style: "currency",
    currency,
    maximumFractionDigits: 0,
  }).format(price);
}
