import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { CalendarDays, MapPin, Users } from "lucide-react";
import { AppShell } from "@/components/AppShell";
import { Avatar } from "@/components/Avatar";
import { Badge } from "@/components/Badge";
import { FollowButton } from "@/components/FollowButton";
import { InterestButton } from "@/components/InterestButton";
import { ShareOpportunityButton } from "@/components/ShareOpportunityButton";
import {
  formatDateRange,
  formatPrice,
  formatOpportunityType,
  getOpportunityShareText,
  getPublicOpportunityUrl,
  isLastMinuteOpportunity,
} from "@/lib/opportunities";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { mapOpportunity, type HomeFeedRow } from "@/lib/supabase/mappers";
import type { InterestStatus } from "@/lib/types";

type OpportunityDetailRow = HomeFeedRow & {
  coach_profile_image_url?: string | null;
};

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
  const opportunityRow = row as OpportunityDetailRow;
  const opportunity = mapOpportunity(opportunityRow);
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
  const publicUrl = getPublicOpportunityUrl(opportunity.id);
  const shareLabel = `Share ${formatOpportunityType(opportunity.type)}`;
  const shareText = getOpportunityShareText(opportunity, publicUrl);
  const detailRows = getDetailRows({
    description,
    skillLevel: opportunity.skillLevel,
    disciplines: opportunity.disciplines,
    languages: opportunity.languages,
    minMinutesOrHours: opportunity.minMinutesOrHours,
    registrationDeadline: opportunity.registrationDeadline,
  });

  return (
    <AppShell active="home">
      <div className="grid gap-3 lg:grid-cols-[1fr_300px]">
        <article className="rounded-2xl border border-slate-200 bg-white p-3 shadow-sm sm:p-5">
          <div className="flex flex-wrap gap-1.5">
            <Badge tone={opportunity.type === "camp" ? "blue" : "green"}>
              {formatOpportunityType(opportunity.type)}
            </Badge>
            {isLastMinute ? <Badge tone="amber">Last-minute opportunity</Badge> : null}
            <Badge tone={isUnavailable ? "red" : "slate"}>
              {opportunity.status}
            </Badge>
          </div>

          <h1 className="mt-2 text-2xl font-black leading-tight tracking-tight sm:text-4xl">
            {opportunity.title}
          </h1>

          <div className="mt-2 grid gap-1.5 rounded-xl bg-slate-50 px-3 py-2 text-sm font-bold text-slate-800">
            <p className="flex items-center gap-2">
              <CalendarDays size={16} className="text-sky-700" />
              {formatDateRange(opportunity.startDate, opportunity.endDate)}
            </p>
            <p className="flex items-center gap-2">
              <Users size={16} className="text-sky-700" />
              {opportunity.availableSpots} of {opportunity.totalCapacity} spots open
            </p>
          </div>

          <div className="mt-4 flex flex-col gap-2 rounded-xl border border-slate-200 px-3 py-2.5 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex min-w-0 items-start gap-2 text-sky-700">
              <MapPin size={17} className="mt-0.5 shrink-0" />
              <div className="min-w-0">
                <Link
                  className="block truncate text-sm font-black text-slate-900"
                  href={`/app/tunnels/${opportunity.tunnelId}`}
                >
                  {opportunity.tunnelName}
                </Link>
                <p className="text-xs font-semibold text-slate-600">
                  {formatLocation(opportunity.tunnelCity, opportunity.tunnelCountry)}
                </p>
              </div>
            </div>
            {!isOrganizer ? (
              <div className="shrink-0">
                <FollowButton
                  targetType="tunnel"
                  targetId={opportunity.tunnelId}
                  label="Follow Tunnel"
                />
              </div>
            ) : null}
          </div>

          <div className="mt-4 rounded-2xl bg-sky-50 px-4 py-4 text-sky-800">
            <p className="text-xs font-black uppercase tracking-wide text-sky-700">
              Price
            </p>
            <p className="mt-1 text-3xl font-black tracking-tight text-slate-950">
              {formatPrice(opportunity.price, opportunity.currency)}
            </p>
            <p className="mt-0.5 text-sm font-bold text-sky-800">
              {opportunity.type === "huck_jam"
                ? "shared flying time"
                : "per hour incl. coaching"}
            </p>
          </div>

          <div className="mt-4 flex flex-col gap-3 rounded-xl border border-slate-200 px-3 py-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex min-w-0 items-center gap-3">
              <Link href={`/app/users/${profileUserId}`} className="shrink-0">
                <Avatar
                  name={opportunity.coachName ?? personLabel}
                  imageUrl={opportunityRow.coach_profile_image_url}
                  size="md"
                />
              </Link>
              <div className="min-w-0">
                <Link
                  href={`/app/users/${profileUserId}`}
                  className="block truncate text-base font-black text-slate-900 hover:text-sky-700"
                >
                  {opportunity.coachName ?? personLabel}
                </Link>
                <p className="mt-0.5 text-xs font-bold uppercase text-slate-400">
                  {personLabel}
                </p>
              </div>
            </div>
            {opportunity.coachFollowId && !isOrganizer ? (
              <div className="shrink-0">
                <FollowButton
                  targetType="coach"
                  targetId={opportunity.coachFollowId}
                  label={personLabel === "Coach" ? "Follow Coach" : "Follow Organizer"}
                />
              </div>
            ) : null}
          </div>

          <div className="mt-4">
            <InterestButton
              opportunityId={opportunity.id}
              disabled={isUnavailable}
              initialStatus={viewerInterestStatus}
              compact
            />
          </div>

          <div className="mt-3 flex flex-wrap gap-2">
            <ShareOpportunityButton
              label={shareLabel}
              shareText={shareText}
              url={publicUrl}
              compact
            />
          </div>

          {detailRows.length > 0 ? (
            <details className="mt-2 rounded-xl border border-slate-200 bg-white px-3 py-2">
              <summary className="cursor-pointer list-none text-sm font-black text-slate-900">
                Additional Information ▼
              </summary>
              <div className="mt-2 grid gap-1.5 text-sm leading-5 text-slate-600">
                {detailRows.map((row) => (
                  <p key={row.label}>
                    <span className="font-bold text-slate-800">{row.label}:</span>{" "}
                    {row.value}
                  </p>
                ))}
              </div>
            </details>
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
  description,
  skillLevel,
  disciplines,
  languages,
  minMinutesOrHours,
  registrationDeadline,
}: {
  description: string;
  skillLevel: string | null;
  disciplines: string[];
  languages: string[];
  minMinutesOrHours?: string;
  registrationDeadline: string | null;
}) {
  const rows: Array<{ label: string; value: string }> = [];

  if (minMinutesOrHours?.trim()) {
    rows.push({ label: "Minimum time", value: minMinutesOrHours });
  }

  if (skillLevel?.trim()) {
    rows.push({ label: "Skill level", value: skillLevel });
  }

  if (languages.length > 0) {
    rows.push({ label: "Languages", value: languages.join(", ") });
  }

  if (disciplines.length > 0) {
    rows.push({ label: "Disciplines", value: disciplines.join(", ") });
  }

  if (registrationDeadline) {
    rows.push({
      label: "Registration",
      value: formatRegistrationDeadline(registrationDeadline),
    });
  }

  if (description) {
    rows.push({ label: "Description", value: description });
  }

  return rows;
}

function formatRegistrationDeadline(value: string) {
  const date = new Date(`${value}T00:00:00.000Z`);

  if (Number.isNaN(date.getTime())) {
    return "Registration date to be confirmed";
  }

  return `Registration closes ${new Intl.DateTimeFormat("en", {
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(date)}`;
}
