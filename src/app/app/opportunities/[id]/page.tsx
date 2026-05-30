import Link from "next/link";
import { notFound } from "next/navigation";
import { CalendarDays, Globe2, MapPin, Users } from "lucide-react";
import { AppShell } from "@/components/AppShell";
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

  const opportunity = mapOpportunity(row as HomeFeedRow);
  const isUnavailable =
    opportunity.status !== "published" || opportunity.availableSpots <= 0;
  const isLastMinute =
    opportunity.isLastMinute ?? isLastMinuteOpportunity(opportunity);

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
          <p className="mt-3 text-base leading-7 text-slate-600">
            {opportunity.description}
          </p>

          <div className="mt-6 grid gap-3 sm:grid-cols-2">
            <Info icon={<CalendarDays size={18} />} label="Dates">
              {formatDateRange(opportunity.startDate, opportunity.endDate)}
            </Info>
            <Info icon={<MapPin size={18} />} label="Tunnel">
              <Link className="text-sky-700" href={`/app/tunnels/${opportunity.tunnelId}`}>
                {opportunity.tunnelName}
              </Link>
            </Info>
            <Info icon={<Users size={18} />} label="Availability">
              {opportunity.availableSpots} of {opportunity.totalCapacity} spots open
            </Info>
            <Info icon={<Globe2 size={18} />} label="Languages">
              {opportunity.languages.join(", ")}
            </Info>
          </div>

          <div className="mt-6 rounded-2xl bg-slate-50 p-4">
            <p className="text-sm font-bold text-slate-700">Details</p>
            <div className="mt-3 grid gap-2 text-sm text-slate-600">
              <p>Skill level: {opportunity.skillLevel}</p>
              <p>Disciplines: {opportunity.disciplines.join(", ")}</p>
              <p>
                Minimum time: {opportunity.minMinutesOrHours ?? "Organizer confirms"}
              </p>
              <p>
                Registration deadline:{" "}
                {opportunity.registrationDeadline ?? "Organizer confirms"}
              </p>
            </div>
          </div>

          {opportunity.coachId ? (
            <div className="mt-5 rounded-2xl border border-slate-200 p-3">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
                <Link
                  href={`/app/coaches/${opportunity.coachId}`}
                  className="flex flex-1 items-center gap-3"
                >
                  <div className="grid size-14 place-items-center rounded-2xl bg-sky-50 font-black text-sky-700">
                    {opportunity.coachName?.slice(0, 1) ?? "C"}
                  </div>
                  <div>
                    <p className="text-sm text-slate-500">Coach</p>
                    <p className="font-bold text-slate-900">
                      {opportunity.coachName}
                    </p>
                  </div>
                </Link>
                <FollowButton
                  targetType="coach"
                  targetId={opportunity.coachId}
                  label="Follow coach"
                />
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
          <InterestButton opportunityId={opportunity.id} disabled={isUnavailable} />
          <FollowButton
            targetType="tunnel"
            targetId={opportunity.tunnelId}
            label="Follow tunnel"
          />
        </aside>
      </div>
    </AppShell>
  );
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
