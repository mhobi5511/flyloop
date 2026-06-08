import Link from "next/link";
import { CalendarDays, MapPin, Users, UserRound } from "lucide-react";
import { Badge } from "./Badge";
import { NotificationCountBadge } from "./NotificationCountBadge";
import {
  formatOpportunityDate,
  formatPrice,
  formatPriceAppliesToMinutes,
  formatPriceLabel,
  formatSessionTimeRange,
  getCapacityLines,
  isOpportunityFull,
  opportunityViewModel,
} from "@/lib/opportunities";
import type { Opportunity } from "@/lib/types";
import { applicantBorderClass } from "./ApplicationStatusBadge";

type OpportunityCardProps = {
  opportunity: Opportunity;
  compact?: boolean;
  dense?: boolean;
  discoveryLayout?: boolean;
  currentUserId?: string;
  showViewCta?: boolean;
  discoveryBadges?: Array<{
    label: string;
    tone: "amber" | "blue" | "green" | "slate";
  }>;
};

export function OpportunityCard({
  opportunity,
  compact = false,
  dense = false,
  discoveryLayout = false,
  currentUserId,
  showViewCta = false,
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
  const isFull = isOpportunityFull(opportunity);
  const isUserAlreadyIn = opportunity.viewerInterestStatus === "accepted";
  const isOwnOpportunity = Boolean(
    currentUserId && currentUserId === opportunity.createdBy,
  );
  const showFullUnavailableState =
    isFull && !isUserAlreadyIn && !isOwnOpportunity;

  return (
    <Link
      href={href}
      className={`relative block overflow-hidden rounded-2xl border shadow-sm transition ${dense ? "p-3" : "p-4"} ${statusBorder} ${
        showFullUnavailableState
          ? "border-slate-300 bg-slate-50 hover:translate-y-0 hover:shadow-sm"
          : "border-slate-200 bg-white hover:-translate-y-0.5 hover:shadow-md"
      }`}
    >
      <NotificationCountBadge count={unreadCount} />
      {showFullUnavailableState ? (
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 z-0 opacity-80"
          style={{
            backgroundImage:
              "repeating-linear-gradient(135deg, rgba(100, 116, 139, 0.18) 0, rgba(100, 116, 139, 0.18) 8px, transparent 8px, transparent 18px)",
          }}
        />
      ) : null}
      <div className="relative z-10">
        {dense && discoveryLayout ? (
          <div className="flex items-start justify-between gap-3 pr-6">
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-1.5">
                {showFullUnavailableState ? <FullBadge dense={dense} /> : null}
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
                    className={`rounded-full px-2 py-0.5 text-[0.68rem] font-bold ${badgeClass(
                      badge.tone,
                    )}`}
                  >
                    {badge.label}
                  </span>
                ))}
              </div>
              <h3 className="mt-2 line-clamp-2 text-lg font-black tracking-tight text-slate-950">
                {opportunity.title}
              </h3>
            </div>
            <div className="shrink-0 rounded-full bg-sky-50 px-2.5 py-1 text-right">
              <div className="whitespace-nowrap text-[0.72rem] font-black leading-5 text-sky-800">
                {formatCompactPrice(opportunity)}
              </div>
            </div>
          </div>
        ) : (
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <div className={`flex flex-wrap ${dense ? "mb-1.5 gap-1.5" : "mb-2 gap-2"}`}>
                {showFullUnavailableState ? <FullBadge dense={dense} /> : null}
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
              {dense ? (
                <DateLine dateLabel={dateLabel} sessionRange={sessionRange} />
              ) : null}
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
        )}

        {!compact ? (
          <p className="mt-4 line-clamp-2 text-sm leading-6 text-slate-600">
            {opportunity.description}
          </p>
        ) : null}

        {dense ? (
          discoveryLayout ? (
            <div className="mt-3 space-y-3 border-t border-slate-100 pt-3">
              <div className="flex items-start gap-2">
                <CalendarDays size={15} className="mt-0.5 shrink-0 text-sky-600" />
                <div className="min-w-0">
                  <p className="text-sm font-bold leading-5 text-slate-950">
                    {dateLabel}
                    {sessionRange ? ` · ${sessionRange}` : ""}
                  </p>
                </div>
              </div>
              <div className="flex items-start gap-2">
                <MapPin size={15} className="mt-0.5 shrink-0 text-sky-600" />
                <div className="min-w-0">
                  <p className="text-sm font-bold leading-5 text-slate-950">
                    {view.tunnelDisplayName ?? "Tunnel"}
                  </p>
                  <p className="text-sm leading-5 text-slate-600">{location}</p>
                </div>
              </div>
              <div className="flex items-start gap-2">
                <UserRound size={15} className="mt-0.5 shrink-0 text-sky-600" />
                <p className="text-sm font-semibold leading-5 text-slate-700">
                  {view.coachDisplayName ?? "Organizer-led"}
                </p>
              </div>
              <div className="flex items-end justify-between gap-3 border-t border-slate-100 pt-3">
                <div className="flex min-w-0 items-center gap-1.5 text-sm font-semibold text-slate-700">
                  <Users size={15} className="shrink-0 text-sky-600" />
                  <span>{capacityLines[0]}</span>
                </div>
                {showViewCta ? (
                  <span className="shrink-0 rounded-lg bg-slate-950 px-2.5 py-1 text-xs font-black text-white">
                    View
                  </span>
                ) : null}
              </div>
            </div>
          ) : (
            <>
              <div className="mt-2 flex items-end justify-between gap-3">
                <div className="min-w-0">
                  <div className="flex items-center gap-1.5 text-xs font-semibold text-slate-600">
                    <Users size={14} className="shrink-0 text-sky-600" />
                    <span>{capacityLines[0]}</span>
                  </div>
                  {capacityLines[1] ? (
                    <div className="mt-1 flex items-center gap-1.5 text-xs font-semibold text-slate-600">
                      <Users size={14} className="shrink-0 text-sky-600" />
                      <span>{capacityLines[1]}</span>
                    </div>
                  ) : null}
                </div>
                {showViewCta ? (
                  <span className="shrink-0 rounded-lg bg-slate-950 px-2.5 py-1 text-xs font-black text-white">
                    View
                  </span>
                ) : null}
              </div>
            </>
          )
        ) : (
          <div className="mt-4 grid gap-2 text-xs font-semibold text-slate-600 sm:grid-cols-3">
            <DateLine dateLabel={dateLabel} sessionRange={sessionRange} />
            <div className="flex items-center gap-1.5">
              <MapPin size={15} className="text-sky-600" />
              <span>{location}</span>
            </div>
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
      </div>
    </Link>
  );
}

function DateLine({
  dateLabel,
  sessionRange,
}: {
  dateLabel: string;
  sessionRange: string;
}) {
  return (
    <div className="mt-1.5 inline-flex max-w-full items-start gap-1.5 rounded-lg bg-sky-50 px-2 py-1 text-sm font-black leading-5 text-sky-800">
      <CalendarDays size={15} className="shrink-0 text-sky-700" />
      <span className="min-w-0 whitespace-normal break-words">
        {dateLabel}
        {sessionRange ? ` - ${sessionRange}` : ""}
      </span>
    </div>
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

function FullBadge({ dense }: { dense: boolean }) {
  return (
    <span
      className={`rounded-full border border-slate-300 bg-white/95 px-2 font-black text-slate-700 shadow-sm ${
        dense ? "py-0.5 text-[0.68rem]" : "py-1 text-xs"
      }`}
    >
      Full
    </span>
  );
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
