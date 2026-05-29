"use client";

import Image from "next/image";
import Link from "next/link";
import { CalendarDays, Globe2, MapPin, Users } from "lucide-react";
import { AppShell } from "@/components/AppShell";
import { Badge } from "@/components/Badge";
import { FollowButton } from "@/components/FollowButton";
import { InterestButton } from "@/components/InterestButton";
import { getOpportunity } from "@/lib/demo-data";
import {
  formatDateRange,
  formatPrice,
  opportunityViewModel,
} from "@/lib/opportunities";
import { useDemoState } from "@/lib/use-demo-state";
import type { ReactNode } from "react";

export function OpportunityDetailClient({ id }: { id: string }) {
  const [state] = useDemoState();
  const opportunity =
    state.opportunities.find((item) => item.id === id) ?? getOpportunity(id);

  if (!opportunity) {
    return (
      <AppShell active="home">
        <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
          <h1 className="text-2xl font-black">Opportunity not found</h1>
          <Link href="/app" className="mt-4 inline-flex font-bold text-sky-700">
            Back to Home
          </Link>
        </div>
      </AppShell>
    );
  }

  const view = opportunityViewModel(opportunity);
  const isUnavailable =
    opportunity.status !== "published" || opportunity.availableSpots <= 0;

  return (
    <AppShell active="home">
      <div className="grid gap-5 lg:grid-cols-[1fr_360px]">
        <article className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex flex-wrap gap-2">
            <Badge tone={opportunity.type === "camp" ? "blue" : "green"}>
              {view.typeLabel}
            </Badge>
            {view.isLastMinute ? (
              <Badge tone="amber">Last-minute opportunity</Badge>
            ) : null}
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
              {view.tunnel ? (
                <Link className="text-sky-700" href={`/app/tunnels/${view.tunnel.id}`}>
                  {view.tunnel.name}
                </Link>
              ) : (
                view.tunnelDisplayName ?? "Selected tunnel"
              )}
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
              <p>Registration deadline: {opportunity.registrationDeadline}</p>
            </div>
          </div>

          {view.coach ? (
            <div className="mt-5 rounded-2xl border border-slate-200 p-3">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
                <Link
                  href={`/app/coaches/${view.coach.id}`}
                  className="flex flex-1 items-center gap-3"
                >
                  <Image
                    src={view.coach.avatarUrl}
                    alt=""
                    width={56}
                    height={56}
                    className="size-14 rounded-2xl object-cover"
                  />
                  <div>
                    <p className="text-sm text-slate-500">Coach</p>
                    <p className="font-bold text-slate-900">{view.coach.name}</p>
                  </div>
                </Link>
                <FollowButton
                  targetType="coach"
                  targetId={view.coach.id}
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
          {view.tunnel ? (
            <FollowButton
              targetType="tunnel"
              targetId={view.tunnel.id}
              label="Follow tunnel"
            />
          ) : null}
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
