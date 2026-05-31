import Link from "next/link";
import { CalendarDays, MapPin, Users } from "lucide-react";
import { ApplicationStatusBadge } from "./ApplicationStatusBadge";
import { Badge } from "./Badge";
import {
  formatDateRange,
  formatPrice,
  formatPriceLabel,
  opportunityViewModel,
} from "@/lib/opportunities";
import type { Opportunity } from "@/lib/types";
import { applicantBorderClass } from "./ApplicationStatusBadge";

type OpportunityCardProps = {
  opportunity: Opportunity;
  compact?: boolean;
  currentUserId?: string;
  discoveryBadges?: Array<{
    label: string;
    tone: "amber" | "blue" | "green" | "slate";
  }>;
};

export function OpportunityCard({
  opportunity,
  compact = false,
  currentUserId,
  discoveryBadges = [],
}: OpportunityCardProps) {
  const view = opportunityViewModel(opportunity);
  const location = formatCardLocation(opportunity);
  const href =
    currentUserId && currentUserId === opportunity.createdBy
      ? `/app/organizer/opportunities/${opportunity.id}`
      : `/app/opportunities/${opportunity.id}`;
  const statusBorder = opportunity.viewerInterestStatus
    ? applicantBorderClass(opportunity.viewerInterestStatus)
    : "";

  return (
    <Link
      href={href}
      className={`block rounded-2xl border border-slate-200 bg-white p-4 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md ${statusBorder}`}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="mb-2 flex flex-wrap gap-2">
            {opportunity.viewerInterestStatus ? (
              <ApplicationStatusBadge status={opportunity.viewerInterestStatus} />
            ) : null}
            <Badge tone={view.type === "camp" ? "blue" : "green"}>
              {view.typeLabel}
            </Badge>
            {view.isLastMinute &&
            !discoveryBadges.some((badge) => badge.label.includes("Last Minute")) ? (
              <Badge tone="amber">Last-minute opportunity</Badge>
            ) : null}
            {discoveryBadges.map((badge) => (
              <span
                key={badge.label}
                className={`rounded-full px-2 py-1 text-xs font-bold ${badgeClass(
                  badge.tone,
                )}`}
              >
                {badge.label}
              </span>
            ))}
          </div>
          <h3 className="text-lg font-bold tracking-tight text-slate-950">
            {opportunity.title}
          </h3>
          <div className="mt-1 grid gap-0.5 text-sm text-slate-600">
            <p>{view.coachDisplayName ?? "Organizer-led"}</p>
            <p className="font-semibold text-slate-700">
              {view.tunnelDisplayName ?? "Tunnel"}
            </p>
            <p>{location}</p>
          </div>
        </div>
        <div className="shrink-0 rounded-xl bg-sky-50 px-3 py-2 text-right">
          <div className="text-sm font-bold text-sky-800">
            {formatPrice(opportunity.price, opportunity.currency)}
          </div>
          <div className="max-w-24 text-xs leading-4 text-sky-600">
            {formatPriceLabel(opportunity.type)}
          </div>
        </div>
      </div>

      {!compact ? (
        <p className="mt-4 line-clamp-2 text-sm leading-6 text-slate-600">
          {opportunity.description}
        </p>
      ) : null}

      <div className="mt-4 grid gap-2 text-xs font-semibold text-slate-600 sm:grid-cols-3">
        <div className="flex items-center gap-1.5">
          <CalendarDays size={15} className="text-sky-600" />
          <span>{formatDateRange(opportunity.startDate, opportunity.endDate)}</span>
        </div>
        <div className="flex items-center gap-1.5">
          <MapPin size={15} className="text-sky-600" />
          <span>{location}</span>
        </div>
        <div className="flex items-center gap-1.5">
          <Users size={15} className="text-sky-600" />
          <span>{opportunity.availableSpots} spots</span>
        </div>
      </div>
    </Link>
  );
}

function formatCardLocation(opportunity: Opportunity) {
  const city = opportunity.tunnelCity?.trim();
  const country = opportunity.tunnelCountry?.trim();

  if (city && country) {
    return `${city}, ${country}`;
  }

  if (city) {
    return city;
  }

  if (country) {
    return country;
  }

  return "Location to be confirmed";
}

function badgeClass(tone: "amber" | "blue" | "green" | "slate") {
  const classes = {
    amber: "bg-orange-50 text-orange-700",
    blue: "bg-sky-50 text-sky-700",
    green: "bg-emerald-50 text-emerald-700",
    slate: "bg-slate-100 text-slate-600",
  };

  return classes[tone];
}
