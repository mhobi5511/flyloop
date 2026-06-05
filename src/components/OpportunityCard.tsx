import Link from "next/link";
import { CalendarDays, MapPin, Users } from "lucide-react";
import { ApplicationStatusBadge } from "./ApplicationStatusBadge";
import { Badge } from "./Badge";
import {
  formatOpportunityDate,
  formatPrice,
  formatPriceAppliesToMinutes,
  formatPriceLabel,
  formatSessionTimeRange,
  getCapacityLines,
  opportunityViewModel,
} from "@/lib/opportunities";
import type { Opportunity } from "@/lib/types";
import { applicantBorderClass } from "./ApplicationStatusBadge";

type OpportunityCardProps = {
  opportunity: Opportunity;
  compact?: boolean;
  dense?: boolean;
  currentUserId?: string;
  discoveryBadges?: Array<{
    label: string;
    tone: "amber" | "blue" | "green" | "slate";
  }>;
};

export function OpportunityCard({
  opportunity,
  compact = false,
  dense = false,
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
  const capacityLines = getCapacityLines(opportunity);
  const sessionRange =
    opportunity.type === "huck_jam"
      ? formatSessionTimeRange(opportunity.sessionStart, opportunity.sessionEnd)
      : "";
  const dateLabel = formatOpportunityDate(
    opportunity.type,
    opportunity.startDate,
    opportunity.endDate,
  );
  const unreadCount = opportunity.unreadNotificationCount ?? 0;

  return (
    <Link
      href={href}
      className={`block rounded-2xl border border-slate-200 bg-white shadow-sm transition hover:-translate-y-0.5 hover:shadow-md ${dense ? "p-3" : "p-4"} ${statusBorder}`}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className={`flex flex-wrap ${dense ? "mb-1.5 gap-1.5" : "mb-2 gap-2"}`}>
            {unreadCount > 0 ? <UnreadBadge count={unreadCount} /> : null}
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
                className={`rounded-full px-2 font-bold ${dense ? "py-0.5 text-[0.68rem]" : "py-1 text-xs"} ${badgeClass(
                  badge.tone,
                )}`}
              >
                {badge.label}
              </span>
            ))}
          </div>
          <h3 className={`${dense ? "line-clamp-1 text-base" : "text-lg"} font-bold tracking-tight text-slate-950`}>
            {opportunity.title}
          </h3>
          <div className={`${dense ? "mt-0.5 gap-0 text-xs" : "mt-1 gap-0.5 text-sm"} grid text-slate-600`}>
            <p className="line-clamp-1">{view.coachDisplayName ?? "Organizer-led"}</p>
            <p className="font-semibold text-slate-700">
              {view.tunnelDisplayName ?? "Tunnel"}
            </p>
            {!dense ? <p>{location}</p> : null}
          </div>
        </div>
        <div className={`shrink-0 rounded-xl bg-sky-50 text-right ${dense ? "px-2.5 py-1.5" : "px-3 py-2"}`}>
          {dense ? (
            <div className="whitespace-nowrap text-xs font-black text-sky-800">
              {formatCompactPrice(opportunity)}
            </div>
          ) : (
            <>
              <div className="text-sm font-bold text-sky-800">
                {formatPrice(opportunity.price, opportunity.currency)}
              </div>
              <div className="max-w-24 text-xs leading-4 text-sky-600">
                {formatPriceLabel(opportunity.type, opportunity.minMinutesOrHours)}
              </div>
            </>
          )}
        </div>
      </div>

      {!compact ? (
        <p className="mt-4 line-clamp-2 text-sm leading-6 text-slate-600">
          {opportunity.description}
        </p>
      ) : null}

      {dense ? (
        <>
          <div className="mt-2 flex items-center gap-1.5 text-xs font-semibold text-slate-600">
            <CalendarDays size={14} className="shrink-0 text-sky-600" />
            <span className="line-clamp-1">
              {dateLabel}
              {sessionRange ? ` - ${sessionRange}` : ""} - {capacityLines[0]}
            </span>
          </div>
          {capacityLines[1] ? (
            <div className="mt-1 flex items-center gap-1.5 text-xs font-semibold text-slate-600">
              <Users size={14} className="shrink-0 text-sky-600" />
              <span>{capacityLines[1]}</span>
            </div>
          ) : null}
        </>
      ) : (
        <div className="mt-4 grid gap-2 text-xs font-semibold text-slate-600 sm:grid-cols-3">
          <div className="flex items-center gap-1.5">
            <CalendarDays size={15} className="text-sky-600" />
            <span>{dateLabel}</span>
          </div>
          {sessionRange ? (
            <div className="flex items-center gap-1.5">
              <CalendarDays size={15} className="text-sky-600" />
              <span>{sessionRange}</span>
            </div>
          ) : (
            <div className="flex items-center gap-1.5">
              <MapPin size={15} className="text-sky-600" />
              <span>{location}</span>
            </div>
          )}
          <div className="flex items-center gap-1.5">
            <Users size={15} className="text-sky-600" />
            <span>{capacityLines[0]}</span>
          </div>
          {capacityLines[1] ? (
            <div className="flex items-center gap-1.5">
              <Users size={15} className="text-sky-600" />
              <span>{capacityLines[1]}</span>
            </div>
          ) : null}
        </div>
      )}
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

function formatCompactPrice(opportunity: Opportunity) {
  const amount = new Intl.NumberFormat("en", {
    maximumFractionDigits: 0,
  }).format(opportunity.price);
  const currencyLabel = opportunity.currency === "EUR" ? "€" : opportunity.currency;
  const suffix =
    opportunity.type === "huck_jam"
      ? " Participation Fee"
      : ` per ${formatPriceAppliesToMinutes(opportunity.minMinutesOrHours)} min`;

  return `${amount} ${currencyLabel}${suffix}`;
}

function UnreadBadge({ count }: { count: number }) {
  return (
    <span
      aria-label={`${count} unread notification${count === 1 ? "" : "s"}`}
      className="grid min-w-5 place-items-center rounded-full bg-slate-950 px-1.5 py-0.5 text-xs font-black leading-4 text-white"
    >
      {count}
    </span>
  );
}
