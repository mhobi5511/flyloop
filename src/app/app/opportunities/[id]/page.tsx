import Link from "next/link";
import { notFound } from "next/navigation";
import { CalendarDays, Globe2, MapPin, Users } from "lucide-react";
import { AppShell } from "@/components/AppShell";
import { Badge } from "@/components/Badge";
import { FollowButton } from "@/components/FollowButton";
import { InterestButton } from "@/components/InterestButton";
import { OrganizerOpportunityActions } from "@/components/OrganizerOpportunityActions";
import {
  formatDateRange,
  formatPrice,
  formatOpportunityType,
  isLastMinuteOpportunity,
} from "@/lib/opportunities";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { mapOpportunity, type HomeFeedRow } from "@/lib/supabase/mappers";
import type { ReactNode } from "react";
import type { InterestStatus } from "@/lib/types";

export default async function OpportunityDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createSupabaseServerClient();

  const { data: row } = await supabase
    .from("published_opportunities_with_context")
    .select("*")
    .eq("id", id)
    .maybeSingle();

  if (!row) {
    notFound();
  }

  const {
    data: { user },
  } = await supabase.auth.getUser();
  const opportunity = mapOpportunity(row as HomeFeedRow);
  const { data: viewerInterest } =
    user && user.id !== opportunity.createdBy
      ? await supabase
          .from("opportunity_interests")
          .select("status")
          .eq("opportunity_id", opportunity.id)
          .eq("athlete_id", user.id)
          .maybeSingle()
      : { data: null };
  const viewerInterestStatus =
    (viewerInterest?.status as InterestStatus | undefined) ?? undefined;
  const isOrganizer = user?.id === opportunity.createdBy;
  const isUnavailable =
    opportunity.status !== "published" || opportunity.availableSpots <= 0;
  const isLastMinute =
    opportunity.isLastMinute ?? isLastMinuteOpportunity(opportunity);
  const description = getMeaningfulDescription(opportunity.description);
  const detailRows = getDetailRows({
    skillLevel: opportunity.skillLevel,
    disciplines: opportunity.disciplines,
    minMinutesOrHours: opportunity.minMinutesOrHours,
    registrationDeadline: opportunity.registrationDeadline,
  });

  return (
    <AppShell active="home">
      <div className="grid gap-5 lg:grid-cols-[1fr_360px]">
        <article className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex flex-wrap gap-2">
            <Badge tone={opportunity.type === "camp" ? "blue" : "green"}>
              {formatOpportunityType(opportunity.type)}
            </Badge>
            {isLastMinute ? <Badge tone="amber">Last-minute opportunity</Badge> : null}
            <Badge tone={isUnavailable ? "red" : "slate"}>
              {opportunity.status}
            </Badge>
          </div>

          <h1 className="mt-4 text-4xl font-black leading-tight tracking-tight">
            {opportunity.title}
          </h1>
          {description ? (
            <p className="mt-3 text-base leading-7 text-slate-600">
              {description}
            </p>
          ) : null}

          <div className="mt-6 grid gap-3 sm:grid-cols-2">
            <Info icon={<CalendarDays size={18} />} label="Dates">
              {formatDateRange(opportunity.startDate, opportunity.endDate)}
            </Info>
            <Info icon={<MapPin size={18} />} label="Tunnel">
              <Link className="text-sky-700" href={`/app/tunnels/${opportunity.tunnelId}`}>
                {opportunity.tunnelName}
              </Link>
              <span className="block text-slate-600">
                {formatLocation(opportunity.tunnelCity, opportunity.tunnelCountry)}
              </span>
            </Info>
            <Info icon={<Users size={18} />} label="Availability">
              {opportunity.availableSpots} of {opportunity.totalCapacity} spots open
            </Info>
            {opportunity.languages.length > 0 ? (
              <Info icon={<Globe2 size={18} />} label="Languages">
                {opportunity.languages.join(", ")}
              </Info>
            ) : null}
          </div>

          <div className="mt-6 rounded-2xl bg-slate-50 p-4">
            <p className="text-sm font-bold text-slate-700">Details</p>
            {detailRows.length > 0 ? (
              <div className="mt-3 grid gap-2 text-sm text-slate-600">
                {detailRows.map((row) => (
                  <p key={row.label}>
                    {row.label}: {row.value}
                  </p>
                ))}
              </div>
            ) : (
              <p className="mt-3 text-sm leading-6 text-slate-600">
                Please speak with the coach or organizer for details.
              </p>
            )}
          </div>

          {opportunity.coachFollowId ? (
            <div className="mt-5 rounded-2xl border border-slate-200 p-3">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
                <div className="flex flex-1 items-center gap-3">
                  <div className="grid size-14 place-items-center rounded-2xl bg-sky-50 font-black text-sky-700">
                    {opportunity.coachName?.slice(0, 1) ?? "O"}
                  </div>
                  <div>
                    <p className="text-sm text-slate-500">Organizer</p>
                    <p className="font-bold text-slate-900">
                      {opportunity.coachName ?? "Organizer"}
                    </p>
                  </div>
                </div>
                {!isOrganizer ? (
                  <FollowButton
                    targetType="coach"
                    targetId={opportunity.coachFollowId}
                    label="Follow organizer"
                  />
                ) : null}
              </div>
            </div>
          ) : null}
        </article>

        <aside className="grid content-start gap-4">
          <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
            <p className="text-sm font-bold text-slate-500">Price</p>
            <p className="mt-1 text-3xl font-black">
              {formatPrice(opportunity.price, opportunity.currency)}
            </p>
            <p className="mt-2 text-sm text-slate-600">
              Contact happens outside Flyloop via{" "}
              {opportunity.contactMethod === "whatsapp" ? "WhatsApp" : "Instagram"}.
            </p>
          </div>
          {isOrganizer ? (
            <OrganizerOpportunityActions opportunityId={opportunity.id} />
          ) : (
            <InterestButton
              opportunityId={opportunity.id}
              disabled={isUnavailable}
              initialStatus={viewerInterestStatus}
            />
          )}
          {!isOrganizer ? (
            <FollowButton
              targetType="tunnel"
              targetId={opportunity.tunnelId}
              label="Follow tunnel"
            />
          ) : null}
        </aside>
      </div>
    </AppShell>
  );
}

function formatLocation(city?: string, country?: string) {
  if (city && country) {
    return `${city}, ${country}`;
  }

  return city ?? country ?? "Location to be confirmed";
}

function getMeaningfulDescription(description: string) {
  const trimmed = description.trim();

  if (
    !trimmed ||
    trimmed === "Camp published by a Flyloop organizer." ||
    trimmed === "Huck Jam published on Flyloop."
  ) {
    return "";
  }

  return trimmed;
}

function getDetailRows({
  skillLevel,
  disciplines,
  minMinutesOrHours,
  registrationDeadline,
}: {
  skillLevel: string | null;
  disciplines: string[];
  minMinutesOrHours?: string;
  registrationDeadline: string | null;
}) {
  const rows: Array<{ label: string; value: string }> = [];

  if (skillLevel?.trim()) {
    rows.push({ label: "Skill level", value: skillLevel });
  }

  if (disciplines.length > 0) {
    rows.push({ label: "Disciplines", value: disciplines.join(", ") });
  }

  if (minMinutesOrHours?.trim()) {
    rows.push({ label: "Minimum time", value: minMinutesOrHours });
  }

  if (registrationDeadline) {
    rows.push({ label: "Registration deadline", value: registrationDeadline });
  }

  return rows;
}

function Info({
  icon,
  label,
  children,
}: {
  icon: ReactNode;
  label: string;
  children: ReactNode;
}) {
  return (
    <div className="rounded-2xl border border-slate-200 p-4">
      <div className="flex items-center gap-2 text-sky-700">{icon}</div>
      <p className="mt-2 text-xs font-bold uppercase tracking-[0.16em] text-slate-400">
        {label}
      </p>
      <div className="mt-1 text-sm font-bold text-slate-800">{children}</div>
    </div>
  );
}
