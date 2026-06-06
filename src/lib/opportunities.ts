import type { Opportunity } from "./types";

const lastMinuteWindowDays = 10;
const publicOpportunityOrigin = "https://flyloop.one";

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

export function isOpportunityFull(opportunity: Opportunity) {
  if (opportunity.type !== "camp") {
    return opportunity.availableSpots <= 0 || opportunity.status === "full";
  }

  return (
    opportunity.status === "full" ||
    opportunity.availableSpots <= 0 ||
    (opportunity.hasPublishedTimetable === true &&
      (opportunity.remainingTimetableMinutes ?? 0) <= 0)
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

export function formatOpportunityDate(
  type: Opportunity["type"],
  startDate: string,
  endDate: string,
) {
  return type === "huck_jam"
    ? formatSingleDate(startDate)
    : formatDateRange(startDate, endDate);
}

export function formatSingleDate(value: string) {
  const date = parseDate(value);

  if (!date) {
    return "Date to be confirmed";
  }

  return new Intl.DateTimeFormat("en", {
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(date);
}

export function formatPrice(price: number, currency: string) {
  const currencyLabel = currency === "EUR" ? "€" : currency;
  return `${new Intl.NumberFormat("en", {
    maximumFractionDigits: 0,
  }).format(price)} ${currencyLabel}`;
}

export function formatPriceLabel(type: Opportunity["type"], minutes?: string | null) {
  return type === "huck_jam"
    ? "Participation Fee"
    : `per ${formatPriceAppliesToMinutes(minutes)} min`;
}

export function formatPriceAppliesToMinutes(minutes?: string | null) {
  const parsed = Number(minutes);
  return Number.isFinite(parsed) && parsed > 0 ? formatNumber(parsed) : "60";
}

export function formatSessionTimeRange(
  sessionStart?: string | null,
  sessionEnd?: string | null,
) {
  if (!sessionStart || !sessionEnd) {
    return "";
  }

  return `${formatSessionTime(sessionStart)} - ${formatSessionTime(sessionEnd)}`;
}

export function getCapacityLines(opportunity: Opportunity) {
  const acceptedAthletes = Math.max(
    opportunity.totalCapacity - opportunity.availableSpots,
    0,
  );

  if (opportunity.type === "huck_jam") {
    return [`${acceptedAthletes} / ${opportunity.totalCapacity} Participants`];
  }

  if (!opportunity.hasPublishedTimetable) {
    return [`${opportunity.availableSpots} / ${opportunity.totalCapacity} Spots Available`];
  }

  return [
    `${acceptedAthletes} / ${opportunity.totalCapacity} Athletes`,
    `${opportunity.remainingTimetableMinutes ?? 0} min available`,
  ];
}

export function getPublicOpportunityPath(id: string) {
  return `/opportunity/${id}`;
}

export function getPublicOpportunityUrl(id: string) {
  return `${publicOpportunityOrigin}${getPublicOpportunityPath(id)}`;
}

export function getOpportunityShareText(opportunity: Opportunity, url: string) {
  const typeLabel = formatOpportunityType(opportunity.type);
  const dateText = formatOpportunityDate(
    opportunity.type,
    opportunity.startDate,
    opportunity.endDate,
  );
  const tunnelName = opportunity.tunnelName ?? "the tunnel";

  return [
    `Join my ${typeLabel} on Flyloop`,
    "",
    opportunity.title,
    dateText,
    tunnelName,
    "",
    "Register now",
    "",
    url,
  ].join("\n");
}

function parseDate(value: string) {
  const date = new Date(`${value}T00:00:00.000Z`);
  return Number.isNaN(date.getTime()) ? null : date;
}

function formatSessionTime(value: string) {
  return value.slice(0, 5);
}

function formatNumber(value: number) {
  return new Intl.NumberFormat("en", {
    maximumFractionDigits: 2,
  }).format(value);
}
