import type { Opportunity } from "./types";

export type OpportunityLifecycleWindow = {
  endDate: string;
  registrationDeadline?: string | null;
};

function endOfDayUtc(value: string) {
  const date = new Date(`${value}T23:59:59.999Z`);
  return Number.isNaN(date.getTime()) ? null : date;
}

function parseNow(now: Date) {
  return new Date(now.getTime());
}

export function isOpportunityCompleted(
  opportunity: OpportunityLifecycleWindow,
  now = new Date(),
) {
  const completedBy = endOfDayUtc(opportunity.endDate);

  if (!completedBy) {
    return false;
  }

  return completedBy.getTime() < parseNow(now).getTime();
}

export function isOpportunityOpenForRegistration(
  opportunity: OpportunityLifecycleWindow,
  now = new Date(),
) {
  const deadline = opportunity.registrationDeadline?.trim();

  if (!deadline) {
    return true;
  }

  const closesAt = endOfDayUtc(deadline);

  if (!closesAt) {
    return false;
  }

  return closesAt.getTime() >= parseNow(now).getTime();
}

export function isOpportunityJoinable(
  opportunity: OpportunityLifecycleWindow,
  now = new Date(),
) {
  return (
    !isOpportunityCompleted(opportunity, now) &&
    isOpportunityOpenForRegistration(opportunity, now)
  );
}

export function isOpportunityCurrent(
  opportunity: OpportunityLifecycleWindow,
  now = new Date(),
) {
  return !isOpportunityCompleted(opportunity, now);
}

export function toLifecycleWindow(
  opportunity: Pick<Opportunity, "endDate" | "registrationDeadline">,
) {
  return {
    endDate: opportunity.endDate,
    registrationDeadline: opportunity.registrationDeadline,
  };
}
