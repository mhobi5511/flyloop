import type { Opportunity } from "./types";

const lastMinuteWindowDays = 10;

export function isLastMinuteOpportunity(
  opportunity: Opportunity,
  now = new Date(),
) {
  if (!opportunity.registrationDeadline) {
    return false;
  }

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
  return {
    ...opportunity,
    coachDisplayName: opportunity.coachName,
    tunnelDisplayName: opportunity.tunnelName,
    tunnelDisplayDistanceKm: opportunity.tunnelDistanceKm ?? null,
    isLastMinute:
      opportunity.isLastMinute ?? isLastMinuteOpportunity(opportunity),
    typeLabel: formatOpportunityType(opportunity.type),
  };
}

export function formatDateRange(startDate: string, endDate: string) {
  const formatter = new Intl.DateTimeFormat("en", {
    month: "short",
    day: "numeric",
  });

  const start = parseDate(startDate);
  const end = parseDate(endDate);

  if (!start && !end) {
    return "Date to be confirmed";
  }

  if (!start) {
    return formatter.format(end as Date);
  }

  if (!end) {
    return formatter.format(start);
  }

  const formattedStart = formatter.format(start);
  const formattedEnd = formatter.format(end);
  return formattedStart === formattedEnd
    ? formattedStart
    : `${formattedStart} - ${formattedEnd}`;
}

export function formatPrice(price: number, currency: string) {
  return `${new Intl.NumberFormat("en", {
    maximumFractionDigits: 0,
  }).format(price)} ${currency}`;
}

function parseDate(value: string) {
  const date = new Date(`${value}T00:00:00.000Z`);
  return Number.isNaN(date.getTime()) ? null : date;
}
