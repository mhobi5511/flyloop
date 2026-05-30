import Link from "next/link";
import { CalendarDays, MapPin, Users } from "lucide-react";
import { Badge } from "./Badge";
import {
  formatDateRange,
  formatPrice,
  opportunityViewModel,
} from "@/lib/opportunities";
import type { Opportunity } from "@/lib/types";

type OpportunityCardProps = {
  opportunity: Opportunity;
  compact?: boolean;
};

export function OpportunityCard({ opportunity, compact = false }: OpportunityCardProps) {
  const view = opportunityViewModel(opportunity);

  return (
    <Link
      href={`/app/opportunities/${opportunity.id}`}
      className="block rounded-2xl border border-slate-200 bg-white p-4 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="mb-2 flex flex-wrap gap-2">
            <Badge tone={view.type === "camp" ? "blue" : "green"}>
              {view.typeLabel}
            </Badge>
            {view.isLastMinute ? (
              <Badge tone="amber">Last-minute opportunity</Badge>
            ) : null}
          </div>
          <h3 className="text-lg font-bold tracking-tight text-slate-950">
            {opportunity.title}
          </h3>
          <p className="mt-1 text-sm text-slate-600">
            {view.coachDisplayName ?? "Organizer-led"} at{" "}
            {view.tunnelDisplayName ?? "selected tunnel"}
          </p>
        </div>
        <div className="rounded-xl bg-sky-50 px-3 py-2 text-right">
          <div className="text-sm font-bold text-sky-800">
            {formatPrice(opportunity.price, opportunity.currency)}
          </div>
          <div className="text-xs text-sky-600">from</div>
        </div>
      </div>

      {!compact ? (
        <p className="mt-4 line-clamp-2 text-sm leading-6 text-slate-600">
          {opportunity.description}
        </p>
      ) : null}

      <div className="mt-4 grid grid-cols-3 gap-2 text-xs font-semibold text-slate-600">
        <div className="flex items-center gap-1.5">
          <CalendarDays size={15} className="text-sky-600" />
          <span>{formatDateRange(opportunity.startDate, opportunity.endDate)}</span>
        </div>
        <div className="flex items-center gap-1.5">
          <MapPin size={15} className="text-sky-600" />
          <span>
            {opportunity.locationLabel ??
              (view.tunnelDisplayDistanceKm === null
                ? opportunity.tunnelRegion ?? "Browse"
                : `${Math.round(view.tunnelDisplayDistanceKm)} km away`)}
          </span>
        </div>
        <div className="flex items-center gap-1.5">
          <Users size={15} className="text-sky-600" />
          <span>{opportunity.availableSpots} spots</span>
        </div>
      </div>
    </Link>
  );
}
