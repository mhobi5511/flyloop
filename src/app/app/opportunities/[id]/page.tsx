import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { CalendarDays, Globe2, MapPin, Users } from "lucide-react";
import { ApplicationStatusBadge } from "@/components/ApplicationStatusBadge";
import { AppShell } from "@/components/AppShell";
import { Avatar } from "@/components/Avatar";
import { Badge } from "@/components/Badge";
import { FollowButton } from "@/components/FollowButton";
import { InterestButton } from "@/components/InterestButton";
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
  if (isOrganizer) {
    redirect(`/app/organizer/opportunities/${opportunity.id}`);
  }

  const isUnavailable =
    opportunity.status !== "published" || opportunity.availableSpots <= 0;
  const isLastMinute =
    opportunity.isLastMinute ?? isLastMinuteOpportunity(opportunity);
  const description = getMeaningfulDescription(opportunity.description);
  const personLabel =
    opportunity.type === "camp" && opportunity.coachName ? "Coach" : "Organizer";
  const profileUserId = opportunity.coachFollowId ?? opportunity.createdBy;
  const detailRows = getDetailRows({
    skillLevel: opportunity.skillLevel,
    disciplines: opportunity.disciplines,
    minMinutesOrHours: opportunity.minMinutesOrHours,
    registrationDeadline: opportunity.registrationDeadline,
  });

  return (
    <AppShell active="home">
      <div className="grid gap-4 lg:grid-cols-[1fr_340px]">
        <article className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
          <div className="flex flex-wrap gap-2">
            {viewerInterestStatus ? (
              <ApplicationStatusBadge status={viewerInterestStatus} />
            ) : null}
            <Badge tone={opportunity.type === "camp" ? "blue" : "green"}>
              {formatOpportunityType(opportunity.type)}
            </Badge>
            {isLastMinute ? <Badge tone="amber">Last-minute opportunity</Badge> : null}
            <Badge tone={isUnavailable ? "red" : "slate"}>
              {opportunity.status}
            </Badge>
          </div>

          <h1 className="mt-3 text-2xl font-black leading-tight tracking-tight sm:text-4xl">
            {opportunity.title}
          </h1>

          <div className="mt-4 grid grid-cols-2 gap-2">
            <Info compact icon={<CalendarDays size={16} />} label="Date">
              {formatDateRange(opportunity.startDate, opportunity.endDate)}
            </Info>
            <Info compact icon={<Users size={16} />} label="Availability">
              {opportunity.availableSpots} of {opportunity.totalCapacity} spots open
            </Info>
          </div>

          <div className="mt-3 rounded-2xl border border-slate-200 p-3">
            <div className="flex items-start gap-2 text-sky-700">
              <MapPin size={17} />
              <div className="min-w-0 flex-1">
                <p className="text-xs font-bold uppercase text-slate-400">Tunnel</p>
                <Link
                  className="mt-0.5 block font-black text-slate-900"
                  href={`/app/tunnels/${opportunity.tunnelId}`}
                >
                  {opportunity.tunnelName}
                </Link>
                <p className="mt-0.5 text-sm font-semibold text-slate-600">
                  {formatLocation(opportunity.tunnelCity, opportunity.tunnelCountry)}
                </p>
              </div>
            </div>
            {!isOrganizer ? (
              <div className="mt-3">
                <FollowButton
                  targetType="tunnel"
                  targetId={opportunity.tunnelId}
                  label="Follow tunnel"
                />
              </div>
            ) : null}
          </div>

          <div className="mt-3 rounded-2xl bg-sky-50 p-3">
            <p className="text-xs font-bold uppercase text-sky-700">Price</p>
            <p className="mt-0.5 text-2xl font-black text-slate-950">
              {formatPrice(opportunity.price, opportunity.currency)}
            </p>
            <p className="text-xs font-semibold text-sky-700">
              {opportunity.type === "huck_jam"
                ? "shared flying time"
                : "per hour incl. coaching"}
            </p>
          </div>

          <div className="mt-3">
            <InterestButton
              opportunityId={opportunity.id}
              disabled={isUnavailable}
              initialStatus={viewerInterestStatus}
              compact
            />
          </div>

          <div className="mt-5 rounded-2xl bg-slate-50 p-4">
            <p className="text-sm font-bold text-slate-700">Details</p>
            {description ? (
              <p className="mt-2 text-sm leading-6 text-slate-600">
                {description}
              </p>
            ) : null}
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

          {opportunity.languages.length > 0 ? (
            <div className="mt-3">
              <Info icon={<Globe2 size={18} />} label="Languages">
                {opportunity.languages.join(", ")}
              </Info>
            </div>
          ) : null}

          {opportunity.coachFollowId ? (
            <div className="mt-5 rounded-2xl border border-slate-200 p-3">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
                <div className="flex flex-1 items-center gap-3">
                  <Link href={`/app/users/${profileUserId}`}>
                    <Avatar name={opportunity.coachName ?? personLabel} size="md" />
                  </Link>
                  <div>
                    <p className="text-sm text-slate-500">
                      {personLabel === "Coach" ? "About the coach" : "Organizer"}
                    </p>
                    <Link
                      href={`/app/users/${profileUserId}`}
                      className="font-bold text-slate-900 hover:text-sky-700"
                    >
                      {opportunity.coachName ?? personLabel}
                    </Link>
                  </div>
                </div>
                {!isOrganizer ? (
                  <FollowButton
                    targetType="coach"
                    targetId={opportunity.coachFollowId}
                    label={personLabel === "Coach" ? "Follow coach" : "Follow organizer"}
                  />
                ) : null}
              </div>
            </div>
          ) : null}
        </article>

        <aside className="hidden content-start gap-4 lg:grid">
          <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
            <p className="text-sm font-bold text-slate-500">Contact</p>
            <p className="mt-2 text-sm leading-6 text-slate-600">
              Contact happens outside Flyloop via{" "}
              {opportunity.contactMethod === "whatsapp" ? "WhatsApp" : "Instagram"}.
            </p>
          </div>
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
  compact = false,
}: {
  icon: ReactNode;
  label: string;
  children: ReactNode;
  compact?: boolean;
}) {
  return (
    <div className={`rounded-2xl border border-slate-200 ${compact ? "p-3" : "p-4"}`}>
      <div className="flex items-center gap-2 text-sky-700">{icon}</div>
      <p className="mt-1 text-xs font-bold uppercase text-slate-400">
        {label}
      </p>
      <div className="mt-1 text-sm font-bold text-slate-800">{children}</div>
    </div>
  );
}
