"use client";

import Image from "next/image";
import Link from "next/link";
import {
  ArrowLeft,
  ArrowRight,
  Bell,
  CalendarClock,
  CheckCircle2,
  Clock3,
  Plus,
  Share2,
  Users,
  X,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, type ReactNode } from "react";
import { ApplicantStatusActions } from "@/components/ApplicantStatusActions";
import { SlotReleaseRequestActions } from "@/components/SlotReleaseRequestActions";
import {
  CreateOpportunityForm,
  type InheritedCoachProfile,
  type TunnelOption,
} from "@/components/CreateOpportunityForm";
import { formatOpportunityType } from "@/lib/opportunities";
import { isOpportunityCompleted } from "@/lib/opportunity-lifecycle";
import type { InterestStatus, OpportunityStatus, OpportunityType } from "@/lib/types";

export type CoachWorkspaceCamp = {
  id: string;
  title: string;
  type: OpportunityType;
  status: OpportunityStatus;
  startDate: string;
  endDate: string;
  dateLabel: string;
  tunnelLabel: string;
  tunnelSharedAt: string | null;
  athleteCount: number;
  pendingApplications: number;
  waitlistApplications: number;
  draftChanges: number;
  unassignedAthletes: number;
  actionScore: number;
  hasAttention: boolean;
  applicants: CoachWorkspaceApplicant[];
  releaseRequests: CoachWorkspaceReleaseRequest[];
  createdAt: string | null;
};

export type CoachWorkspaceApplicant = {
  id: string;
  interestId: string;
  name: string;
  status: InterestStatus;
  removalRequestedAt: string | null;
  tunnelTimeStatus: string | null;
  campTitle: string;
};

export type CoachWorkspaceReleaseRequest = {
  id: string;
  bookingId: string;
  name: string;
  campTitle: string;
};

export type CoachWorkspaceAttentionItem = {
  id: string;
  group:
    | "Applications Waiting"
    | "Waitlist"
    | "Tunnel Not Informed"
    | "Draft Changes Pending"
    | "Release Requests"
    | "Unassigned Athletes";
  kind: "application" | "waitlist" | "tunnel" | "draft" | "release" | "unassigned";
  title: string;
  description: string;
  campId: string;
  campTitle: string;
  interestId?: string;
  bookingId?: string;
  workshopLabel?: string;
};

export type CoachWorkspaceActivityItem = {
  id: string;
  title: string;
  body: string;
  timestamp: string;
};

export type CoachWorkspaceNotificationItem = {
  id: string;
  title: string;
  body: string;
  timestamp: string;
};

type CoachCommandCenterWorkspaceProps = {
  coachName: string;
  camps: CoachWorkspaceCamp[];
  huckJams: CoachWorkspaceCamp[];
  attentionItems: CoachWorkspaceAttentionItem[];
  activityItems: CoachWorkspaceActivityItem[];
  notifications: CoachWorkspaceNotificationItem[];
  tunnels: TunnelOption[];
  inheritedCoachProfile?: InheritedCoachProfile;
};

const attentionGroupOrder: CoachWorkspaceAttentionItem["group"][] = [
  "Applications Waiting",
  "Waitlist",
  "Tunnel Not Informed",
  "Draft Changes Pending",
  "Release Requests",
  "Unassigned Athletes",
];

export function CoachCommandCenterWorkspace({
  coachName,
  camps,
  huckJams,
  attentionItems,
  activityItems,
  notifications,
  tunnels,
  inheritedCoachProfile,
}: CoachCommandCenterWorkspaceProps) {
  const router = useRouter();
  const [creationOpen, setCreationOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<"camps" | "huckJams">("camps");
  const campsManaged = camps.length;
  const athletesCoached = camps.reduce((total, camp) => total + camp.athleteCount, 0);
  const tunnelsVisited = new Set(camps.map((camp) => camp.tunnelLabel)).size;
  const now = new Date();
  const activeCamps = camps.filter((camp) => !isOpportunityCompleted({ endDate: camp.endDate }, now));
  const activeHuckJams = huckJams.filter((camp) => !isOpportunityCompleted({ endDate: camp.endDate }, now));
  const upcomingCamps = activeCamps
    .slice()
    .sort((a, b) => a.startDate.localeCompare(b.startDate) || a.title.localeCompare(b.title))
    .slice(0, 3);
  const groupedAttention = attentionGroupOrder
    .map((group) => ({
      group,
      items: attentionItems.filter((item) => item.group === group),
    }))
    .filter((group) => group.items.length > 0);
  const activeOpportunityCards = activeTab === "camps" ? activeCamps : activeHuckJams;

  return (
    <div className="min-h-dvh bg-slate-100 text-slate-950">
      <div className="mx-auto grid max-w-[96rem] gap-4 p-3 sm:p-4 xl:p-5">
        <section className="rounded-2xl border border-slate-200 bg-white p-3 shadow-sm sm:p-4 xl:p-5">
          <div className="grid gap-3 xl:grid-cols-[minmax(0,1fr)_18rem] xl:items-stretch">
            <div className="grid gap-3">
              <div className="flex items-center gap-3">
                <Image
                  src="/flyloop-icon-192.png"
                  alt="Flyloop"
                  width={40}
                  height={40}
                  className="size-10 rounded-xl shadow-sm"
                />
                <div>
                  <p className="text-xs font-black uppercase tracking-[0.18em] text-sky-700">
                    COACH COMMAND CENTER
                  </p>
                  <p className="mt-1 text-sm font-bold text-slate-500">
                    Powered by Flyloop
                  </p>
                </div>
              </div>

              <div className="min-w-0">
                <h1 className="truncate text-3xl font-black tracking-tight">{coachName}</h1>
                <div className="mt-2 flex flex-wrap gap-2 text-sm font-bold text-slate-600">
                  <span className="inline-flex items-center gap-1.5 rounded-full bg-slate-100 px-2.5 py-1">
                    Camps Managed <span className="text-slate-400">&middot;</span> {campsManaged}
                  </span>
                  <span className="inline-flex items-center gap-1.5 rounded-full bg-slate-100 px-2.5 py-1">
                    Athletes Coached <span className="text-slate-400">&middot;</span> {athletesCoached}
                  </span>
                  <span className="inline-flex items-center gap-1.5 rounded-full bg-slate-100 px-2.5 py-1">
                    Tunnels Visited <span className="text-slate-400">&middot;</span> {tunnelsVisited}
                  </span>
                </div>
              </div>
            </div>

            <div className="grid gap-2 xl:justify-items-stretch">
              <button
                type="button"
                onClick={() => setCreationOpen(true)}
                className="inline-flex h-11 items-center justify-center gap-2 rounded-2xl bg-sky-600 px-4 text-sm font-black text-white transition hover:bg-sky-700"
              >
                <Plus size={17} /> Create Opportunity
              </button>
              <Link
                href="/app"
                className="inline-flex h-11 items-center justify-center gap-2 rounded-2xl border border-slate-200 bg-white px-4 text-sm font-black text-slate-700 transition hover:border-sky-200 hover:bg-sky-50 hover:text-sky-800"
              >
                <ArrowLeft size={17} /> Back to App
              </Link>
            </div>
          </div>
        </section>

        <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_20rem] xl:items-start">
          <main className="min-w-0">
            <CoachCommandCenter
              groupedAttention={groupedAttention}
              activeTab={activeTab}
              onTabChange={setActiveTab}
              activeOpportunityCards={activeOpportunityCards}
              onCreateOpportunity={() => setCreationOpen(true)}
            />
          </main>

          <aside className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm xl:self-start">
            <div className="grid gap-4">
              <SidebarSection title="Recent Activity">
                <div className="grid gap-2">
                  {activityItems.length > 0 ? (
                    activityItems.map((item) => (
                      <article
                        key={item.id}
                        className="rounded-2xl border border-slate-200 bg-slate-50 p-3"
                      >
                        <p className="text-sm font-black text-slate-950">{item.title}</p>
                        {item.body ? (
                          <p className="mt-1 text-sm leading-6 text-slate-600">
                            {item.body}
                          </p>
                        ) : null}
                        <p className="mt-2 text-xs font-bold text-slate-500">
                          {formatRelativeTime(item.timestamp)}
                        </p>
                      </article>
                    ))
                  ) : (
                    <p className="rounded-2xl border border-slate-200 bg-slate-50 p-3 text-sm font-semibold text-slate-500">
                      Recent activity will appear here as work moves through the workspace.
                    </p>
                  )}
                </div>
              </SidebarSection>

              <SidebarSection title="Notifications">
                <div className="grid gap-2">
                  {notifications.length > 0 ? (
                    notifications.map((item) => (
                      <article
                        key={item.id}
                        className="rounded-2xl border border-slate-200 bg-white p-3 shadow-sm"
                      >
                        <div className="flex items-start gap-2">
                          <Bell size={16} className="mt-0.5 shrink-0 text-sky-700" />
                          <div className="min-w-0">
                            <p className="text-sm font-black text-slate-950">
                              {item.title}
                            </p>
                            {item.body ? (
                              <p className="mt-1 text-sm leading-6 text-slate-600">
                                {item.body}
                              </p>
                            ) : null}
                            <p className="mt-2 text-xs font-bold text-slate-500">
                              {formatRelativeTime(item.timestamp)}
                            </p>
                          </div>
                        </div>
                      </article>
                    ))
                  ) : (
                    <p className="rounded-2xl border border-slate-200 bg-slate-50 p-3 text-sm font-semibold text-slate-500">
                      No unread notifications.
                    </p>
                  )}
                </div>
              </SidebarSection>

              <SidebarSection title="Upcoming Camps">
                <div className="grid gap-2">
                  {upcomingCamps.length > 0 ? (
                    upcomingCamps.map((camp) => (
                      <Link
                        key={camp.id}
                        href={`/app/coach-dashboard/${camp.id}`}
                        className="rounded-2xl border border-slate-200 bg-slate-50 p-3 text-left transition hover:border-sky-200 hover:bg-sky-50"
                      >
                        <p className="text-sm font-black text-slate-950">{camp.title}</p>
                        <p className="mt-1 text-xs font-bold text-sky-700">
                          {camp.tunnelLabel}
                        </p>
                        <p className="mt-1 text-sm font-semibold text-slate-600">
                          {camp.dateLabel}
                        </p>
                      </Link>
                    ))
                  ) : (
                    <p className="rounded-2xl border border-slate-200 bg-slate-50 p-3 text-sm font-semibold text-slate-500">
                      No upcoming camps.
                    </p>
                  )}
                </div>
              </SidebarSection>
            </div>
          </aside>
        </div>
      </div>
      {creationOpen ? (
        <CreationModal
          tunnels={tunnels}
          inheritedCoachProfile={inheritedCoachProfile}
          organizerName={coachName}
          onClose={() => setCreationOpen(false)}
          onSuccess={(opportunityId) => {
            setCreationOpen(false);
            router.replace(`/app/coach-dashboard/${opportunityId}`);
            router.refresh();
          }}
        />
      ) : null}
    </div>
  );
}

function CoachCommandCenter({
  groupedAttention,
  activeTab,
  onTabChange,
  activeOpportunityCards,
  onCreateOpportunity,
}: {
  groupedAttention: Array<{
    group: CoachWorkspaceAttentionItem["group"];
    items: CoachWorkspaceAttentionItem[];
  }>;
  activeTab: "camps" | "huckJams";
  onTabChange: (value: "camps" | "huckJams") => void;
  activeOpportunityCards: CoachWorkspaceCamp[];
  onCreateOpportunity: () => void;
}) {
  const inboxAttentionItems = groupedAttention
    .flatMap((group) => group.items)
    .slice()
    .sort((a, b) => {
      const delta = getAttentionPriority(a) - getAttentionPriority(b);

      if (delta !== 0) {
        return delta;
      }

      return a.title.localeCompare(b.title);
    });

  return (
    <div className="grid gap-5">
      <section className="grid gap-2.5">
        <div>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h3 className="text-xl font-black tracking-tight text-slate-950">
              Requires Attention
            </h3>
          </div>
        </div>

        <div className="grid gap-2">
          {inboxAttentionItems.length > 0 ? (
            inboxAttentionItems.map((item) => (
              <article
                key={item.id}
                className="group grid gap-3 rounded-2xl border border-slate-200 bg-slate-50 px-3 py-2.5 transition hover:border-sky-200 hover:bg-sky-50/60 md:grid-cols-[auto_minmax(0,1fr)_auto] md:items-center"
              >
                <div className={`grid size-8 shrink-0 place-items-center rounded-lg ${getAttentionTone(item)}`}>
                  {getAttentionIcon(item)}
                </div>

                <div className="min-w-0">
                  <p className="text-sm font-black leading-5 text-slate-950">
                    {item.title}
                  </p>
                  <p className="mt-0.5 text-xs leading-5 text-slate-600">
                    {item.description}
                  </p>
                </div>

                <div className="flex flex-wrap items-center gap-1.5 md:justify-self-end">
                  {item.kind === "application" ? (
                    <ApplicantStatusActions
                      interestId={item.interestId ?? ""}
                      currentStatus="pending"
                      compact
                    />
                  ) : item.kind === "release" ? (
                    <SlotReleaseRequestActions
                      opportunityId={item.campId}
                      bookingId={item.bookingId ?? ""}
                      compact
                    />
                  ) : (
                    <Link
                      href={`/app/coach-dashboard/${item.campId}`}
                      className="inline-flex h-8 items-center rounded-lg bg-white px-3 text-xs font-black text-slate-700 shadow-sm transition hover:bg-sky-700 hover:text-white"
                    >
                      Open Opportunity
                    </Link>
                  )}
                </div>
              </article>
            ))
          ) : (
            <div className="rounded-2xl border border-slate-200 bg-white px-3 py-3 shadow-sm">
              <div className="flex items-start gap-3">
                <div className="grid size-8 shrink-0 place-items-center rounded-lg bg-emerald-50 text-emerald-700">
                  <CheckCircle2 size={16} />
                </div>
                <div className="min-w-0">
                  <h4 className="text-sm font-black text-slate-950">
                    Everything is running smoothly.
                  </h4>
                  <p className="mt-1 text-sm leading-5 text-slate-600">
                    No pending applications. No draft changes. No athletes waiting for action.
                  </p>
                </div>
              </div>
            </div>
          )}
        </div>
      </section>

      <section className="grid gap-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h3 className="text-xl font-black tracking-tight text-slate-950">Opportunities</h3>
        </div>

        <div className="grid gap-0">
          <div className="flex items-end gap-1.5 pl-1">
            <button
              type="button"
              onClick={() => onTabChange("camps")}
              aria-pressed={activeTab === "camps"}
              className={`relative z-10 rounded-t-2xl border px-5 py-3.5 text-base font-black tracking-tight transition ${
                activeTab === "camps"
                  ? "border-slate-200 border-b-white bg-white text-slate-950 shadow-[0_-1px_0_rgba(255,255,255,1),0_1px_10px_rgba(15,23,42,0.1)] scale-[1.02]"
                  : "border-slate-200 bg-slate-200/80 text-slate-700 hover:bg-slate-100 hover:text-slate-900"
              }`}
            >
              Camps
            </button>
            <button
              type="button"
              onClick={() => onTabChange("huckJams")}
              aria-pressed={activeTab === "huckJams"}
              className={`relative rounded-t-2xl border px-5 py-3.5 text-base font-black tracking-tight transition ${
                activeTab === "huckJams"
                  ? "z-10 border-slate-200 border-b-white bg-white text-slate-950 shadow-[0_-1px_0_rgba(255,255,255,1),0_1px_10px_rgba(15,23,42,0.1)] scale-[1.02]"
                  : "border-slate-200 bg-slate-200/80 text-slate-700 hover:bg-slate-100 hover:text-slate-900"
              }`}
            >
              Huckjams
            </button>
          </div>

          <div className="rounded-3xl rounded-tl-none border border-slate-200 bg-white p-3 shadow-sm sm:p-4">
            <div className="grid gap-3 xl:grid-cols-2">
              {activeOpportunityCards.length > 0 ? (
                activeOpportunityCards.map((camp) => (
                  <Link
                    key={camp.id}
                    href={`/app/coach-dashboard/${camp.id}`}
                    className="group flex h-full min-h-[8.75rem] flex-col justify-between rounded-2xl border border-slate-200 bg-white p-3 text-left shadow-sm transition hover:-translate-y-0.5 hover:border-sky-200 hover:shadow-md"
                  >
                    <div>
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="inline-flex items-center rounded-full bg-sky-50 px-2.5 py-1 text-[0.68rem] font-black uppercase tracking-[0.14em] text-sky-700">
                          {formatOpportunityType(camp.type)}
                        </span>
                        {camp.hasAttention ? (
                          <span className="inline-flex items-center rounded-full bg-amber-50 px-2.5 py-1 text-[0.68rem] font-black uppercase tracking-[0.14em] text-amber-800">
                            Needs attention
                          </span>
                        ) : (
                          <span className="inline-flex items-center rounded-full bg-emerald-50 px-2.5 py-1 text-[0.68rem] font-black uppercase tracking-[0.14em] text-emerald-700">
                            On track
                          </span>
                        )}
                        {camp.draftChanges > 0 ? (
                          <span className="inline-flex items-center rounded-full bg-orange-50 px-2.5 py-1 text-[0.68rem] font-black uppercase tracking-[0.14em] text-orange-700">
                            {camp.draftChanges} Draft Changes Pending
                          </span>
                        ) : (
                          <span className="inline-flex items-center rounded-full bg-emerald-50 px-2.5 py-1 text-[0.68rem] font-black uppercase tracking-[0.14em] text-emerald-700">
                            Fully Published
                          </span>
                        )}
                      </div>
                      <h4 className="mt-2 text-lg font-black tracking-tight text-slate-950">
                        {camp.title}
                      </h4>
                      <p className="mt-1 text-sm font-semibold text-slate-600">
                        {camp.dateLabel}
                      </p>
                      <p className="mt-0.5 text-xs font-semibold text-slate-500">
                        {camp.tunnelLabel}
                      </p>
                    </div>

                    <div className="mt-3 grid gap-2">
                      <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
                        <MetricPill label="Athletes" value={camp.athleteCount} tone="slate" />
                        <MetricPill
                          label="Applications"
                          value={camp.pendingApplications}
                          tone={camp.pendingApplications > 0 ? "amber" : "slate"}
                        />
                        <MetricPill
                          label="Waitlist"
                          value={camp.waitlistApplications}
                          tone={camp.waitlistApplications > 0 ? "amber" : "slate"}
                        />
                        <MetricPill
                          label="Draft Changes"
                          value={camp.draftChanges}
                          tone={camp.draftChanges > 0 ? "amber" : "slate"}
                        />
                      </div>
                      <span className="inline-flex h-9 items-center justify-center gap-2 rounded-xl bg-slate-950 px-4 text-sm font-black text-white transition group-hover:bg-sky-700">
                        Open Camp <ArrowRight size={16} />
                      </span>
                    </div>
                  </Link>
                ))
              ) : activeTab === "huckJams" ? (
                <div className="rounded-3xl border border-dashed border-slate-200 bg-white p-5 shadow-sm">
                  <h4 className="text-base font-black text-slate-950">
                    No Huckjams created yet.
                  </h4>
                  <p className="mt-1 text-sm leading-6 text-slate-600">
                    Create a new opportunity to start planning a Huckjam.
                  </p>
                  <button
                    type="button"
                    onClick={onCreateOpportunity}
                    className="mt-4 inline-flex h-10 items-center justify-center rounded-xl bg-sky-600 px-4 text-sm font-black text-white transition hover:bg-sky-700"
                  >
                    Create Opportunity
                  </button>
                </div>
              ) : (
                <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
                  <h4 className="text-base font-black text-slate-950">No active camps yet.</h4>
                  <button
                    type="button"
                    onClick={onCreateOpportunity}
                    className="mt-4 inline-flex h-10 items-center justify-center rounded-xl bg-sky-600 px-4 text-sm font-black text-white transition hover:bg-sky-700"
                  >
                    Create Opportunity
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}

function MetricPill({
  label,
  value,
  tone,
}: {
  label: string;
  value: number;
  tone: "slate" | "amber";
}) {
  const toneClass =
    tone === "amber"
      ? "border-amber-200 bg-amber-50 text-amber-800"
      : "border-slate-200 bg-slate-50 text-slate-700";

  return (
    <div className={`rounded-2xl border px-3 py-2 ${toneClass}`}>
      <p className="text-[0.68rem] font-black uppercase tracking-[0.14em] text-inherit/70">
        {label}
      </p>
      <p className="mt-1 text-lg font-black text-inherit">{value}</p>
    </div>
  );
}

function getAttentionPriority(item: CoachWorkspaceAttentionItem) {
  if (item.kind === "application") {
    return 0;
  }

  if (item.kind === "waitlist") {
    return 1;
  }

  if (item.kind === "tunnel") {
    return 2;
  }

  if (item.kind === "draft") {
    return 3;
  }

  if (item.kind === "unassigned") {
    return 4;
  }

  return 5;
}

function getAttentionTone(item: CoachWorkspaceAttentionItem) {
  if (item.kind === "application") {
    return "bg-sky-100 text-sky-700";
  }

  if (item.kind === "waitlist") {
    return "bg-amber-100 text-amber-700";
  }

  if (item.kind === "tunnel") {
    return "bg-amber-100 text-amber-700";
  }

  if (item.kind === "draft") {
    return "bg-violet-100 text-violet-700";
  }

  if (item.kind === "unassigned") {
    return "bg-rose-100 text-rose-700";
  }

  return "bg-slate-200 text-slate-700";
}

function getAttentionIcon(item: CoachWorkspaceAttentionItem) {
  if (item.kind === "application") {
    return <Clock3 size={16} />;
  }

  if (item.kind === "waitlist") {
    return <Users size={16} />;
  }

  if (item.kind === "tunnel") {
    return <Share2 size={16} />;
  }

  if (item.kind === "draft") {
    return <CalendarClock size={16} />;
  }

  if (item.kind === "unassigned") {
    return <Users size={16} />;
  }

  return <Bell size={16} />;
}

function CreationModal({
  tunnels,
  inheritedCoachProfile,
  organizerName,
  onClose,
  onSuccess,
}: {
  tunnels: TunnelOption[];
  inheritedCoachProfile?: InheritedCoachProfile;
  organizerName: string;
  onClose: () => void;
  onSuccess: (opportunityId: string) => void;
}) {
  return (
    <div
      className="fixed inset-0 z-50 grid bg-slate-950/40 p-3 md:place-items-center md:p-5"
      role="dialog"
      aria-modal="true"
      onClick={onClose}
    >
      <section
        className="grid max-h-[calc(100dvh-1.5rem)] w-full max-w-5xl grid-rows-[auto_minmax(0,1fr)] overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl md:max-h-[calc(100dvh-2.5rem)]"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-3 border-b border-slate-200 px-4 py-3">
          <div>
            <p className="text-xs font-black uppercase tracking-[0.14em] text-sky-700">
              Create inside Coaching
            </p>
            <h2 className="mt-1 text-xl font-black tracking-tight">
              New Opportunity
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="grid size-9 place-items-center rounded-lg border border-slate-200 text-slate-500 transition hover:bg-slate-50"
            aria-label="Close creation panel"
          >
            <X size={17} />
          </button>
        </div>
        <div className="overflow-y-auto px-4 pb-4">
          <CreateOpportunityForm
            tunnels={tunnels}
            inheritedCoachProfile={inheritedCoachProfile}
            organizerName={organizerName}
            onCancel={onClose}
            onSuccess={onSuccess}
          />
        </div>
      </section>
    </div>
  );
}

function SidebarSection({
  title,
  children,
}: {
  title: string;
  children: ReactNode;
}) {
  return (
    <section className="grid gap-2">
      <p className="text-xs font-black uppercase tracking-[0.16em] text-slate-400">
        {title}
      </p>
      {children}
    </section>
  );
}

function formatRelativeTime(value: string) {
  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "Just now";
  }

  const diffMs = date.getTime() - Date.now();
  const absMinutes = Math.round(Math.abs(diffMs) / 60000);
  const absHours = Math.round(Math.abs(diffMs) / 3600000);
  const absDays = Math.round(Math.abs(diffMs) / 86400000);

  if (Math.abs(diffMs) < 60_000) {
    return "Just now";
  }

  if (Math.abs(diffMs) < 3_600_000) {
    return `${relativeLabel(diffMs, absMinutes, "minute")} ago`;
  }

  if (Math.abs(diffMs) < 86_400_000) {
    return `${relativeLabel(diffMs, absHours, "hour")} ago`;
  }

  if (Math.abs(diffMs) < 7 * 86_400_000) {
    return `${relativeLabel(diffMs, absDays, "day")} ago`;
  }

  return new Intl.DateTimeFormat("en", {
    month: "short",
    day: "numeric",
  }).format(date);
}

function relativeLabel(diffMs: number, value: number, unit: "minute" | "hour" | "day") {
  const suffix = value === 1 ? unit : `${unit}s`;
  return diffMs > 0 ? `in ${value} ${suffix}` : `${value} ${suffix}`;
}
