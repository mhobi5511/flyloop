"use client";

import dynamic from "next/dynamic";
import Image from "next/image";
import Link from "next/link";
import { useEffect, useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  CalendarClock,
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  Clock3,
  CircleDollarSign,
  ExternalLink,
  Link as LinkIcon,
  MapPin,
  Menu,
  PanelLeftClose,
  PanelLeftOpen,
  Plus,
  Save,
  Settings,
  Share2,
  Send,
  UserPlus,
  Users,
  WalletCards,
  X,
} from "lucide-react";
import {
  publishDraftOpportunity,
  updateOpportunity,
  type OpportunityFormInput,
} from "@/app/app/create/actions";
import { deleteOpportunity } from "@/app/app/opportunities/actions";
import { saveCampTimetable, type TimetableSlotInput } from "@/app/app/organizer/opportunities/actions";
import { CampBuilderCopyDayButton } from "@/components/CampBuilderCopyDayButton";
import { CampBuilderEditDayModal } from "@/components/CampBuilderEditDayModal";
import { ApplicantStatusActions } from "@/components/ApplicantStatusActions";
import {
  AssignSlotButton,
  type AssignSlotParticipant,
} from "@/components/AssignSlotButton";
import { Avatar } from "@/components/Avatar";
import { SlotReleaseRequestActions } from "@/components/SlotReleaseRequestActions";
import { ModalBackdrop } from "@/components/ModalBackdrop";
import { ShareOpportunityButton } from "@/components/ShareOpportunityButton";
import { TunnelDashboardShareButton } from "@/components/TunnelDashboardShareButton";
import {
  formatPrice,
  getOpportunityShareText,
  getPublicOpportunityUrl,
} from "@/lib/opportunities";
import {
  formatTimetableDate,
  formatTimetableMoney,
  formatTimetableTime,
  groupTimetableSlotsByDay,
  type TimetableSlot,
} from "@/lib/timetable";
import {
  formatCampDayPreferenceLabel,
  formatCampPreferenceMinutes,
} from "@/lib/camp-days";
import {
  createDummyParticipantForOpportunity,
  createOpportunityInviteLink,
  setCampParticipantSelfBooking,
} from "@/app/app/organizer/opportunities/actions";
import {
  formatInterestStatusLabel,
  formatLongDay,
  getDateRange,
  type CampPreference,
  type CampWorkspace,
  type Participant,
} from "@/components/coach-dashboard-shared";
import type {
  InterestStatus,
} from "@/lib/types";

type TabletPanel = "participants" | "participant" | null;
type WorkspaceViewport = "mobile" | "tablet" | "desktop";
type AttentionItem = {
  label: string;
  tone: "amber" | "slate";
  target: "applicants" | "participant" | "timetable" | "share";
  count: number;
  participantId?: string;
};

type HuckjamRegistration = {
  id: string;
  name: string;
  profileImageUrl: string;
  createdAt: string;
  relativeTime: string;
  status: InterestStatus;
};

type CoachDashboardWorkspaceProps = {
  selectedCampId: string;
  camps: CampWorkspace[];
};

const participantColors = [
  { bg: "#0369a1", soft: "#e0f2fe", text: "#075985" },
  { bg: "#047857", soft: "#d1fae5", text: "#065f46" },
  { bg: "#b45309", soft: "#fef3c7", text: "#92400e" },
  { bg: "#7c3aed", soft: "#ede9fe", text: "#5b21b6" },
  { bg: "#be123c", soft: "#ffe4e6", text: "#9f1239" },
  { bg: "#0f766e", soft: "#ccfbf1", text: "#115e59" },
  { bg: "#4338ca", soft: "#e0e7ff", text: "#3730a3" },
  { bg: "#c2410c", soft: "#ffedd5", text: "#9a3412" },
];

const emptyParticipantColorMap = new Map<
  string,
  (typeof participantColors)[number]
>();
const emptyAssignableParticipants: AssignSlotParticipant[] = [];

const ParticipantProfileModal = dynamic(() =>
  import("@/components/ParticipantProfileModal").then(
    (module) => module.ParticipantProfileModal,
  ),
  { loading: () => <LazyModalFallback label="Loading participant profile..." /> },
);
const MassBookingModal = dynamic(
  () =>
    import("@/components/MassBookingModal").then(
      (module) => module.MassBookingModal,
    ),
  { loading: () => <LazyModalFallback label="Loading mass booking..." /> },
);

function LazyModalFallback({ label }: { label: string }) {
  return (
    <div
      className="fixed inset-0 z-[70] grid place-items-center bg-slate-950/50 p-4"
      role="status"
      aria-live="polite"
    >
      <div className="inline-flex items-center gap-3 rounded-2xl bg-white px-4 py-3 text-sm font-black text-slate-700 shadow-xl">
        <span
          className="size-4 animate-spin rounded-full border-2 border-slate-200 border-t-sky-600"
          aria-hidden="true"
        />
        {label}
      </div>
    </div>
  );
}

export function CoachDashboardWorkspace({
  selectedCampId,
  camps,
}: CoachDashboardWorkspaceProps) {
  const workspaceViewport = useWorkspaceViewport();
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
  const [headerPanel, setHeaderPanel] = useState<"share" | null>(null);
  const [tabletPanel, setTabletPanel] = useState<TabletPanel>(null);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [desktopDayStart, setDesktopDayStart] = useState(0);
  const [selectedParticipantId, setSelectedParticipantId] = useState("");
  const [profileModalParticipantId, setProfileModalParticipantId] = useState("");
  const [massBookingParticipantId, setMassBookingParticipantId] = useState("");
  const [isAddParticipantOpen, setIsAddParticipantOpen] = useState(false);
  const [participantAdditions, setParticipantAdditions] = useState<
    Record<string, Participant[]>
  >({});
  const [selfBookingOverrides, setSelfBookingOverrides] = useState<
    Record<string, boolean>
  >({});
  const [selfBookingPendingIds, setSelfBookingPendingIds] = useState<Set<string>>(
    () => new Set(),
  );
  const [selfBookingError, setSelfBookingError] = useState("");
  const sourceActiveCamp = useMemo(
    () => camps.find((camp) => camp.id === selectedCampId) ?? camps[0],
    [camps, selectedCampId],
  );
  const activeCamp = useMemo(() => {
    if (!sourceActiveCamp) {
      return sourceActiveCamp;
    }

    const additions = participantAdditions[sourceActiveCamp.id] ?? [];
    const existingParticipantIds = new Set(
      sourceActiveCamp.participants.map((participant) => participant.id),
    );
    const mergedParticipants = [
      ...sourceActiveCamp.participants,
      ...additions.filter((participant) => !existingParticipantIds.has(participant.id)),
    ];

    return {
      ...sourceActiveCamp,
      participants: mergedParticipants.map((participant) =>
        Object.prototype.hasOwnProperty.call(selfBookingOverrides, participant.id)
          ? {
              ...participant,
              selfBookingEnabled: selfBookingOverrides[participant.id],
            }
          : participant,
        ),
    };
  }, [participantAdditions, selfBookingOverrides, sourceActiveCamp]);
  const workspaceIndexes = useMemo(
    () => (activeCamp ? buildWorkspaceIndexes(activeCamp) : null),
    [activeCamp],
  );
  const participant =
    workspaceIndexes?.participantsById.get(selectedParticipantId) ??
    null;
  const profileModalParticipant =
    workspaceIndexes?.participantsById.get(profileModalParticipantId) ?? null;
  const massBookingParticipant =
    workspaceIndexes?.participantsById.get(massBookingParticipantId) ?? null;
  const publicUrl = useMemo(
    () => (activeCamp ? getPublicOpportunityUrl(activeCamp.id) : ""),
    [activeCamp],
  );
  const shareText = useMemo(
    () =>
      activeCamp
        ? getOpportunityShareText(
            {
              id: activeCamp.id,
              type: activeCamp.type,
              bookingMode: activeCamp.bookingMode,
              title: activeCamp.title,
              tunnelId: activeCamp.tunnelId,
              tunnelName: activeCamp.tunnelName,
              startDate: activeCamp.startDate,
              endDate: activeCamp.endDate,
              registrationDeadline: activeCamp.registrationDeadline,
              price: activeCamp.price,
              currency: activeCamp.currency,
              totalCapacity: activeCamp.totalCapacity,
              availableSpots: activeCamp.availableSpots,
              sessionStart: activeCamp.sessionStart,
              sessionEnd: activeCamp.sessionEnd,
              description: activeCamp.description,
              languages: [],
              disciplines: [],
              skillLevel: null,
              status: activeCamp.status,
              contactMethod: "whatsapp",
              createdBy: "",
            },
            publicUrl,
          )
        : "",
    [activeCamp, publicUrl],
  );
  const visibleDays = useMemo(
    () => (activeCamp ? getVisibleTimetableDays(activeCamp, activeCamp.timetableSlots) : []),
    [activeCamp],
  );
  const attention = useMemo(
    () => (activeCamp ? getAttentionItems(activeCamp) : []),
    [activeCamp],
  );
  const unpublishedChangeCount = useMemo(
    () => (activeCamp ? getUnpublishedChangeCount(activeCamp.timetableSlots) : 0),
    [activeCamp],
  );
  const hasPublishedTimetable = useMemo(
    () => activeCamp?.timetableSlots.some((slot) => slot.isPublished === true) ?? false,
    [activeCamp],
  );
  const huckjamOverview = useMemo(
    () => (activeCamp?.type === "huck_jam" ? getHuckjamOverview(activeCamp) : null),
    [activeCamp],
  );
  const participantColorMap =
    workspaceIndexes?.participantColorMap ?? emptyParticipantColorMap;
  const assignableParticipantsBySlotId =
    workspaceIndexes?.assignableParticipantsBySlotId;
  const tunnelDashboardShared = Boolean(activeCamp?.tunnelSharedAt);
  const hasUnpublishedChanges = unpublishedChangeCount > 0;
  const showTimetableStatus = hasPublishedTimetable || hasUnpublishedChanges;
  const isHuckJam = activeCamp?.type === "huck_jam";
  const renderDesktopWorkspace =
    workspaceViewport === null || workspaceViewport === "desktop";
  const renderTabletWorkspace =
    workspaceViewport === null || workspaceViewport === "tablet";

  function focusApplicants() {
    setSelectedParticipantId("");
    setIsSidebarCollapsed(false);
    setTabletPanel("participants");
  }

  function handleAttentionClick(item: AttentionItem) {
    if (item.target === "applicants") {
      focusApplicants();
      return;
    }

    if (item.target === "participant" && item.participantId) {
      setSelectedParticipantId(item.participantId);
      setIsSidebarCollapsed(false);
      setTabletPanel("participant");
      return;
    }

    if (item.target === "share") {
      setHeaderPanel("share");
      return;
    }

    setTabletPanel(null);
    document
      .getElementById("coach-live-timetable")
      ?.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  if (!activeCamp) {
    return (
      <div className="min-h-dvh bg-slate-100 p-6 text-slate-950">
        <div className="mx-auto max-w-3xl rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <p className="text-sm font-black uppercase tracking-[0.18em] text-sky-700">
            Coach Dashboard
          </p>
          <h1 className="mt-2 text-3xl font-black">No workspaces yet</h1>
          <p className="mt-2 text-sm font-semibold text-slate-600">
            Create your first Camp or Huck Jam to start running your coaching
            workspace.
          </p>
        </div>
      </div>
    );
  }

  const desktopDayCount = Math.min(visibleDays.length, 5);
  const clampedDesktopDayStart = Math.min(
    desktopDayStart,
    Math.max(visibleDays.length - desktopDayCount, 0),
  );
  const desktopDays = visibleDays.slice(
    clampedDesktopDayStart,
    clampedDesktopDayStart + desktopDayCount,
  );
  const canPageBack = clampedDesktopDayStart > 0;
  const canPageForward = clampedDesktopDayStart + desktopDayCount < visibleDays.length;
  async function toggleParticipantSelfBooking(
    participantId: string,
    nextEnabled: boolean,
  ) {
    const targetParticipant = activeCamp.participants.find(
      (item) => item.id === participantId,
    );

    if (
      !targetParticipant ||
      targetParticipant.selfBookingEnabled === nextEnabled ||
      selfBookingPendingIds.has(participantId)
    ) {
      return;
    }

    const previousEnabled = targetParticipant.selfBookingEnabled;
    setSelfBookingError("");
    setSelfBookingOverrides((current) => ({
      ...current,
      [participantId]: nextEnabled,
    }));
    setSelfBookingPendingIds((current) => new Set(current).add(participantId));

    try {
      const result = await setCampParticipantSelfBooking(
        targetParticipant.interestId,
        nextEnabled,
      );

      if (!result.ok) {
        setSelfBookingOverrides((current) => ({
          ...current,
          [participantId]: previousEnabled,
        }));
        setSelfBookingError(result.message);
      }
    } catch (toggleError) {
      console.error("Self-booking update failed", toggleError);
      setSelfBookingOverrides((current) => ({
        ...current,
        [participantId]: previousEnabled,
      }));
      setSelfBookingError("Could not update self-booking.");
    } finally {
      setSelfBookingPendingIds((current) => {
        const next = new Set(current);
        next.delete(participantId);
        return next;
      });
    }
  }

  function openMassBooking(participantId: string) {
    setMassBookingParticipantId(participantId);
  }

  function handleParticipantAdded(participant: Participant) {
    if (!activeCamp) {
      return;
    }

    setParticipantAdditions((current) => {
      const existing = current[activeCamp.id] ?? [];
      const withoutDuplicate = existing.filter((item) => item.id !== participant.id);
      return {
        ...current,
        [activeCamp.id]: [...withoutDuplicate, participant],
      };
    });
    setSelectedParticipantId(participant.id);
    setTabletPanel("participant");
  }

  return (
    <div className="min-h-dvh bg-slate-100 text-slate-950">
      <div className="grid w-full gap-4 p-3 sm:p-4 xl:p-5">
        <header className="hidden rounded-2xl border border-slate-200 bg-white p-3 shadow-sm sm:p-4 xl:block">
          <div className="grid gap-3 xl:grid-cols-[minmax(0,2.1fr)_minmax(0,1fr)] xl:items-stretch">
            <div className="grid content-start">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="flex items-center gap-2">
                  <Image
                    src="/flyloop-icon-192.png"
                    alt="Flyloop"
                    width={40}
                    height={40}
                    className="size-10 rounded-xl"
                  />
                  <div>
                    <p className="text-sm font-black uppercase tracking-[0.16em] text-sky-700">
                      Coach Operations Workspace
                    </p>
                    <p className="text-sm font-bold text-slate-500">
                      Powered by Flyloop
                    </p>
                  </div>
                </div>
              </div>
              <div className="mt-3 grid gap-3 lg:grid-cols-[minmax(0,1fr)_20rem] lg:items-end">
                <div className="min-w-0">
                  <h1 className="truncate text-3xl font-black tracking-tight">
                    {activeCamp.title}
                  </h1>
                  <div className="mt-2 flex flex-wrap gap-2 text-sm font-bold text-slate-600">
                    <span className="inline-flex items-center gap-1.5 rounded-full bg-slate-100 px-2.5 py-1">
                      <MapPin size={15} /> {activeCamp.tunnelName}
                    </span>
                    <span className="inline-flex items-center gap-1.5 rounded-full bg-slate-100 px-2.5 py-1">
                      <CalendarDays size={15} /> {activeCamp.dateLabel}
                    </span>
                    <span className="inline-flex items-center gap-1.5 rounded-full bg-slate-100 px-2.5 py-1">
                      <WalletCards size={15} />{" "}
                      {formatPrice(activeCamp.price, activeCamp.currency)}
                    </span>
                  </div>
                </div>
              </div>
              {!isHuckJam ? (
                <div className="mt-3 grid gap-2 md:grid-cols-3">
                  <FlightCapacityCard
                    hasTimetable={activeCamp.timetableSlots.length > 0}
                    bookedMinutes={activeCamp.summary.totalBookedMinutes}
                    availableMinutes={activeCamp.summary.totalAvailableMinutes}
                  />
                  <StatCard label="Open Slots" value={activeCamp.summary.openSlots} />
                  <StatCard
                    label="Estimated Revenue"
                    value={formatTimetableMoney(
                      activeCamp.summary.estimatedRevenue,
                      activeCamp.currency,
                    )}
                  />
                </div>
              ) : null}
            </div>
            <div className="grid h-full gap-3 self-stretch xl:grid-cols-3">
              <UtilityCard
                tone="sky"
                icon={<Share2 size={19} />}
                title="Invite Athletes"
                description="Share this opportunity with athletes."
              >
                <ShareOpportunityButton
                  label="Invite"
                  shareText={shareText}
                  url={publicUrl}
                  copyUrlOnly
                  compact
                  fill
                  variant="primary"
                />
              </UtilityCard>
              <UtilityCard
                tone={tunnelDashboardShared ? "amber" : "slate"}
                icon={<Users size={19} />}
                title="Tunnel Dashboard"
                description="Share live schedules with the tunnel."
                status={
                  tunnelDashboardShared
                    ? "✅ Shared With Tunnel"
                    : "⚠ Not Shared Yet"
                }
              >
                <TunnelDashboardShareButton
                  opportunityId={activeCamp.id}
                  opportunityTitle={activeCamp.title}
                  tunnelSharedAt={activeCamp.tunnelSharedAt}
                  label="Share"
                  compact
                  fill
                />
              </UtilityCard>
              <UtilityCard
                tone="slate"
                icon={<Settings size={19} />}
                title="Opportunity Settings"
                description="Edit dates, pricing, capacity and details."
              >
                <button
                  type="button"
                  onClick={() => setIsSettingsOpen(true)}
                  className="inline-flex h-10 w-full items-center justify-center rounded-xl bg-slate-950 px-3 text-sm font-bold text-white shadow-sm transition hover:bg-slate-800"
                >
                  Open Settings
                </button>
              </UtilityCard>
            </div>
          </div>
        </header>

        <header className="hidden items-center gap-2 rounded-2xl border border-slate-200 bg-white p-2 shadow-sm md:flex xl:hidden">
          <button
            type="button"
            onClick={() => setTabletPanel("participants")}
            className="grid size-10 shrink-0 place-items-center rounded-xl border border-slate-200 text-slate-700"
            aria-label="Open participant sidebar"
          >
            <Menu size={19} />
          </button>
          <button
            type="button"
            onClick={() =>
              setHeaderPanel((current) => (current === "share" ? null : "share"))
            }
            className="inline-flex h-10 items-center justify-center gap-1.5 rounded-xl border border-slate-200 px-3 text-sm font-black text-slate-700"
          >
            <Share2 size={16} /> Share
          </button>
        </header>

        <nav className="hidden rounded-2xl border border-sky-200 bg-sky-50 px-4 py-3 shadow-sm md:block">
          <Link
            href="/app/coach-dashboard"
            className="inline-flex items-center gap-2 text-lg font-black text-sky-800 transition hover:text-sky-900"
          >
            <ChevronLeft size={19} /> Back to Coach Command Center
          </Link>
        </nav>

      <div id="coach-live-timetable" className="hidden md:block" />
      {renderDesktopWorkspace ? (
      <main className="hidden gap-4 xl:grid">
        <section
          className={`grid items-start gap-4 ${
            isSidebarCollapsed
              ? "xl:grid-cols-[3.25rem_minmax(0,1fr)]"
              : "xl:grid-cols-[19rem_minmax(0,1fr)]"
          }`}
        >
          <aside className="grid content-start gap-3">
            <button
              type="button"
              onClick={() => setIsSidebarCollapsed((current) => !current)}
              className="inline-flex h-11 items-center justify-center gap-2 rounded-2xl border border-slate-200 bg-white px-3 text-sm font-black text-slate-700 shadow-sm transition hover:bg-slate-50"
              aria-label={isSidebarCollapsed ? "Expand sidebar" : "Collapse sidebar"}
            >
              {isSidebarCollapsed ? (
                <PanelLeftOpen size={18} />
              ) : (
                <>
                  <PanelLeftClose size={18} />
                  <span>Collapse sidebar</span>
                </>
              )}
            </button>
            {isSidebarCollapsed ? (
              <div className="grid justify-items-center gap-3 rounded-2xl border border-slate-200 bg-white px-2 py-3 text-center shadow-sm">
                <p className="[writing-mode:vertical-rl] text-xs font-black uppercase tracking-[0.14em] text-slate-500">
                  Participants
                </p>
                <p className="[writing-mode:vertical-rl] text-xs font-black uppercase tracking-[0.14em] text-slate-400">
                  {activeCamp.participants.length} total
                </p>
              </div>
            ) : (
              <>
                {isHuckJam ? (
                  <HuckjamSidebarSummary overview={huckjamOverview!} />
                ) : null}
                <button
                  type="button"
                  onClick={() => setIsAddParticipantOpen(true)}
                  className="inline-flex h-11 items-center justify-center gap-2 rounded-2xl bg-sky-600 px-3 text-sm font-black text-white shadow-sm transition hover:bg-sky-700"
                >
                  <Plus size={17} /> Add Participant
                </button>
                <ParticipantColumns
                  participants={activeCamp.participants}
                  selectedParticipantId={selectedParticipantId}
                  onSelectParticipant={setSelectedParticipantId}
                  onSelectApplicants={focusApplicants}
                  onToggleSelfBooking={toggleParticipantSelfBooking}
                  selfBookingPendingIds={selfBookingPendingIds}
                  selfBookingError={selfBookingError}
                  onOpenMassBooking={openMassBooking}
                  isCamp={activeCamp.type === "camp"}
                />
                {participant ? (
                  <ParticipantPanel
                    key={participant.id}
                    participant={participant}
                    camp={activeCamp}
                    onClear={() => setSelectedParticipantId("")}
                    onOpenProfile={() => setProfileModalParticipantId(participant.id)}
                  />
                ) : (
                  <section className="rounded-2xl border border-slate-200 bg-white p-3 shadow-sm">
                    <p className="text-sm font-bold text-slate-500">
                      Select a participant to see details and booked slots.
                    </p>
                  </section>
                )}
              </>
            )}
          </aside>

          <div className="grid min-w-0 gap-4">
            {isHuckJam ? (
              <HuckjamOverviewPanel camp={activeCamp} overview={huckjamOverview!} />
            ) : (
          <section className="min-w-0 rounded-2xl border border-slate-200 bg-white shadow-sm">
            <div className="border-b border-slate-200 bg-white px-4 py-4">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="flex min-w-0 items-baseline gap-3">
                  <h2 className="shrink-0 text-xl font-black tracking-tight">Schedule</h2>
                  <p className="truncate text-xs font-black uppercase tracking-[0.12em] text-slate-400">
                    {visibleDays.length > desktopDays.length
                      ? `${clampedDesktopDayStart + 1}-${clampedDesktopDayStart + desktopDays.length} days of ${visibleDays.length} days`
                      : `${visibleDays.length} day${visibleDays.length === 1 ? "" : "s"}`}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  {showTimetableStatus ? (
                    <span
                      className={`inline-flex h-9 items-center rounded-full border px-3 text-xs font-black ${
                        hasUnpublishedChanges
                          ? "border-amber-200 bg-amber-50 text-amber-700"
                          : "border-emerald-200 bg-emerald-50 text-emerald-700"
                      }`}
                    >
                      {hasUnpublishedChanges
                        ? `Draft changes pending (${unpublishedChangeCount})`
                        : "Timetable fully published"}
                    </span>
                  ) : null}
                  {activeCamp.type === "camp" ? (
                    <PublishTimetableButton camp={activeCamp} />
                  ) : null}
                  <button
                    type="button"
                    onClick={() =>
                      setDesktopDayStart((current) => Math.max(current - 1, 0))
                    }
                    disabled={!canPageBack}
                    className="grid size-9 place-items-center rounded-lg border border-slate-200 text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:text-slate-300"
                    aria-label="Previous day"
                  >
                    <ChevronLeft size={17} />
                  </button>
                  <button
                    type="button"
                    onClick={() =>
                      setDesktopDayStart((current) =>
                        Math.min(
                          current + 1,
                          Math.max(visibleDays.length - desktopDayCount, 0),
                        ),
                      )
                    }
                    disabled={!canPageForward}
                    className="grid size-9 place-items-center rounded-lg border border-slate-200 text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:text-slate-300"
                    aria-label="Next day"
                  >
                    <ChevronRight size={17} />
                  </button>
                </div>
              </div>
            </div>
            <div className="pb-2">
              <div
                className="grid min-h-[34rem] gap-3"
                style={{
                  gridTemplateColumns: `repeat(${Math.max(desktopDays.length, 1)}, minmax(0, 1fr))`,
                }}
              >
                {desktopDays.map((day) => (
                  <section
                    key={day.date}
                    className="min-w-0 rounded-xl border border-slate-200 bg-slate-50"
                  >
                    <div className="sticky top-0 z-10 border-b border-slate-200 bg-slate-50 px-3 py-2">
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <h3 className="text-sm font-black text-slate-950">
                            {formatLongDay(day.date)}
                          </h3>
                          <p className="text-xs font-bold text-slate-500">
                            {day.slots.length} slots
                          </p>
                        </div>
                        {activeCamp.type === "camp" ? (
                          <div className="flex flex-col items-end gap-1">
                            <EditDayButton camp={activeCamp} date={day.date} />
                            <CampBuilderCopyDayButton camp={activeCamp} date={day.date} />
                          </div>
                        ) : null}
                      </div>
                    </div>
                    <div className="grid gap-2 p-2">
                      {day.slots.length > 0 ? (
                        day.slots.map((slot) => {
                          const isFull = slot.bookings.length >= slot.capacity;
                          const isDraftSlot = slot.isPublished === false;

                          return (
                            <article
                              key={slot.id}
                              className={`relative overflow-hidden rounded-xl border bg-white p-2 shadow-sm transition ${
                                isDraftSlot
                                  ? "border-dashed border-orange-300 bg-orange-50/35"
                                  : isFull
                                    ? "border-emerald-200"
                                    : "border-slate-200"
                              }`}
                            >
                              <div
                                className={`mb-2 flex items-center justify-between gap-2 rounded-lg px-2 py-1.5 ${
                                  isDraftSlot ? "bg-white" : "bg-slate-50"
                                }`}
                              >
                                <p className="inline-flex items-center gap-1.5 text-base font-black text-slate-950">
                                  <Clock3 size={15} className="text-sky-700" />
                                  {formatTimetableTime(slot.startTime)}
                                  {isDraftSlot ? (
                                    <span className="text-slate-300">|</span>
                                  ) : null}
                                  {isDraftSlot ? (
                                    <span className="rounded-full border border-orange-200 bg-orange-50 px-2.5 py-0.5 text-xs font-black uppercase tracking-[0.08em] text-orange-700">
                                      Draft
                                    </span>
                                  ) : null}
                                </p>
                                <span className="inline-flex items-center gap-1.5">
                                  <span
                                    className={`rounded-full px-2 py-0.5 text-[0.68rem] font-black ${
                                      isFull
                                        ? "bg-emerald-50 text-emerald-700"
                                        : "bg-slate-100 text-slate-600"
                                    }`}
                                  >
                                    {slot.bookings.length}/{slot.capacity}
                                  </span>
                                </span>
                              </div>
                              <div className="grid gap-1">
                                {slot.bookings.map((booking) => {
                                  const colors = participantColorMap.get(booking.userId);
                                  const releaseRequested = Boolean(booking.releaseRequestedAt);

                                  return (
                                    <div key={booking.id} className="grid gap-1.5">
                                      <div
                                        className="grid w-full rounded-md border-l-4 px-2.5 py-2 text-left shadow-sm"
                                        style={{
                                          backgroundColor: colors?.soft,
                                          borderColor:
                                            booking.isFinal === false
                                              ? "#f97316"
                                              : colors?.bg,
                                          color: colors?.text,
                                        }}
                                      >
                                        <span className="block truncate text-sm font-black">
                                          {booking.athleteName}
                                        </span>
                                        <span className="mt-0.5 flex flex-wrap items-center gap-2 text-xs font-bold opacity-80">
                                          <span>{booking.minutes} min</span>
                                          {booking.isFinal === false ? (
                                            <span className="rounded-full border border-orange-200 bg-orange-50 px-2.5 py-0.5 text-xs font-black uppercase tracking-[0.08em] text-orange-700">
                                              Draft
                                            </span>
                                          ) : null}
                                          {releaseRequested ? (
                                            <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[0.68rem] font-black uppercase text-amber-800">
                                              Release Requested
                                            </span>
                                          ) : null}
                                        </span>
                                        <div className="flex flex-wrap items-center gap-1.5 px-1">
                                          {releaseRequested ? (
                                            <SlotReleaseRequestActions
                                              opportunityId={activeCamp.id}
                                              bookingId={booking.id}
                                              compact
                                            />
                                          ) : null}
                                        </div>
                                      </div>
                                    </div>
                                  );
                                })}
                                {Array.from({
                                  length: Math.max(
                                    slot.capacity - slot.bookings.length,
                                    0,
                                  ),
                                }).map((_, index) => (
                                  <div
                                    key={`${slot.id}-open-${index}`}
                                    className="grid gap-2 rounded-md border border-dashed border-slate-300 bg-white px-2.5 py-2"
                                  >
                                    <p className="text-xs font-black uppercase tracking-[0.12em] text-slate-400">
                                      Open slot
                                    </p>
                                    <AssignSlotButton
                                      opportunityId={activeCamp.id}
                                      slotId={slot.id}
                                      participants={
                                        assignableParticipantsBySlotId?.get(slot.id) ??
                                        emptyAssignableParticipants
                                      }
                                    />
                                  </div>
                                ))}
                              </div>
                            </article>
                          );
                        })
                      ) : (
                        <div className="rounded-lg border border-dashed border-slate-300 bg-white px-3 py-6 text-center">
                          <p className="text-sm font-black text-slate-500">
                            No slots yet
                          </p>
                        </div>
                      )}
                    </div>
                  </section>
                ))}
              </div>
            </div>
          </section>
            )}
          </div>
        </section>
      </main>
      ) : null}

      {renderTabletWorkspace ? (
      <main className="hidden gap-3 md:grid xl:hidden">
        {isHuckJam ? (
          <HuckjamOverviewPanel camp={activeCamp} overview={huckjamOverview!} compact />
        ) : (
          <>
            <section className="min-w-0 rounded-2xl border border-slate-200 bg-white p-3 shadow-sm">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <h2 className="text-lg font-black tracking-tight">Schedule</h2>
                  <p className="mt-0.5 text-xs font-bold text-slate-500">
                    {activeCamp.dateLabel}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  {showTimetableStatus ? (
                    <span
                      className={`inline-flex h-9 items-center rounded-full border px-3 text-xs font-black ${
                        hasUnpublishedChanges
                          ? "border-amber-200 bg-amber-50 text-amber-700"
                          : "border-emerald-200 bg-emerald-50 text-emerald-700"
                      }`}
                    >
                      {hasUnpublishedChanges
                        ? `Draft changes pending (${unpublishedChangeCount})`
                        : "Timetable fully published"}
                    </span>
                  ) : null}
                  {activeCamp.type === "camp" ? (
                    <PublishTimetableButton camp={activeCamp} compact />
                  ) : null}
                  <button
                    type="button"
                    onClick={() => setTabletPanel("participants")}
                    className="inline-flex h-9 items-center gap-1.5 rounded-xl border border-slate-200 px-3 text-xs font-black text-slate-700"
                  >
                    <Menu size={15} /> Participants
                  </button>
                </div>
              </div>
              <div className="mt-3 overflow-x-auto pb-2">
                <div
                  className="grid min-h-[34rem] gap-3"
                  style={{
                    gridTemplateColumns: `repeat(${Math.max(visibleDays.length, 1)}, minmax(14rem, 1fr))`,
                  }}
                >
                  {visibleDays.map((day) => (
                    <section
                      key={day.date}
                      className="min-w-0 rounded-xl border border-slate-200 bg-slate-50"
                    >
                      <div className="sticky top-0 z-10 border-b border-slate-200 bg-slate-50 px-3 py-2">
                        <div className="flex items-start justify-between gap-2">
                          <div>
                            <h3 className="text-sm font-black text-slate-950">
                              {formatLongDay(day.date)}
                            </h3>
                            <p className="text-xs font-bold text-slate-500">
                              {day.slots.length} slots
                            </p>
                          </div>
                          {activeCamp.type === "camp" ? (
                            <div className="flex flex-col items-end gap-1">
                              <EditDayButton camp={activeCamp} date={day.date} />
                              <CampBuilderCopyDayButton camp={activeCamp} date={day.date} />
                            </div>
                          ) : null}
                        </div>
                      </div>
                      <div className="grid gap-2 p-2">
                        {day.slots.length > 0 ? (
                          day.slots.map((slot) => {
                            const isFull = slot.bookings.length >= slot.capacity;
                            const isDraftSlot = slot.isPublished === false;

                            return (
                              <article
                                key={slot.id}
                                className={`relative rounded-lg border bg-white p-2 ${
                                  isDraftSlot
                                    ? "border-dashed border-orange-300 bg-orange-50/35"
                                    : isFull
                                      ? "border-emerald-200"
                                      : "border-slate-200"
                                }`}
                              >
                                <div className="mb-2 flex items-center justify-between gap-2">
                                  <p className="inline-flex items-center gap-1.5 text-sm font-black">
                                    <Clock3 size={15} className="text-sky-700" />
                                    {formatTimetableTime(slot.startTime)}
                                    {isDraftSlot ? (
                                      <span className="text-slate-300">|</span>
                                    ) : null}
                                    {isDraftSlot ? (
                                      <span className="rounded-full border border-orange-200 bg-orange-50 px-2.5 py-0.5 text-xs font-black uppercase tracking-[0.08em] text-orange-700">
                                        Draft
                                      </span>
                                    ) : null}
                                  </p>
                                  <span className="inline-flex items-center gap-1.5">
                                    <span
                                      className={`rounded-full px-2 py-0.5 text-[0.68rem] font-black ${
                                        isFull
                                          ? "bg-emerald-50 text-emerald-700"
                                          : "bg-slate-100 text-slate-600"
                                      }`}
                                    >
                                      {slot.bookings.length}/{slot.capacity}
                                    </span>
                                  </span>
                                </div>
                                <div className="grid gap-1">
                                  {slot.bookings.map((booking) => {
                                    const colors = participantColorMap.get(booking.userId);

                                    return (
                                      <button
                                        key={booking.id}
                                        type="button"
                                        onClick={() => {
                                          const match =
                                            workspaceIndexes?.participantsByUserId.get(
                                              booking.userId,
                                            );
                                          if (match) {
                                            setSelectedParticipantId(match.id);
                                            setTabletPanel("participant");
                                          }
                                        }}
                                        className="grid rounded-md border-l-4 px-2.5 py-2 text-left text-white shadow-sm"
                                        style={{
                                          backgroundColor: colors?.bg,
                                          borderColor:
                                            booking.isFinal === false
                                              ? "#f97316"
                                              : colors?.bg,
                                        }}
                                      >
                                        <span className="block truncate text-sm font-black">
                                          {booking.athleteName}
                                        </span>
                                        <span className="flex items-center gap-2 text-xs font-bold text-white/80">
                                          <span>{booking.minutes} min</span>
                                          {booking.isFinal === false ? (
                                            <span className="rounded-full border border-orange-200 bg-orange-50 px-2.5 py-0.5 text-xs font-black uppercase tracking-[0.08em] text-orange-700">
                                              Draft
                                            </span>
                                          ) : null}
                                        </span>
                                      </button>
                                    );
                                  })}
                                  {Array.from({
                                    length: Math.max(slot.capacity - slot.bookings.length, 0),
                                  }).map((_, index) => (
                                    <div
                                      key={`${slot.id}-tablet-open-${index}`}
                                      className="grid gap-2 rounded-md border border-dashed border-slate-300 bg-white px-2.5 py-2"
                                    >
                                      <p className="text-xs font-black uppercase tracking-[0.12em] text-slate-400">
                                        Open slot
                                      </p>
                                      <AssignSlotButton
                                        opportunityId={activeCamp.id}
                                        slotId={slot.id}
                                        participants={
                                          assignableParticipantsBySlotId?.get(slot.id) ??
                                          emptyAssignableParticipants
                                        }
                                      />
                                    </div>
                                  ))}
                                </div>
                              </article>
                            );
                          })
                        ) : (
                          <div className="rounded-lg border border-dashed border-slate-300 bg-white px-3 py-6 text-center">
                            <p className="text-sm font-black text-slate-500">
                              No slots yet
                            </p>
                          </div>
                        )}
                      </div>
                    </section>
                  ))}
                </div>
              </div>
            </section>
            <CampSettingsPanel
              key={`tablet-${activeCamp.id}`}
              camp={activeCamp}
            />
          </>
        )}
      </main>
      ) : null}

      {tabletPanel ? (
        <TabletSlideOver
          title={tabletPanel === "participant" ? "Participant" : "Participants"}
          onClose={() => setTabletPanel(null)}
        >
          {tabletPanel === "participant" && participant ? (
            <ParticipantPanel
              participant={participant}
              camp={activeCamp}
              onClear={() => {
                setSelectedParticipantId("");
                setTabletPanel("participants");
              }}
              onOpenProfile={() => setProfileModalParticipantId(participant.id)}
            />
          ) : (
            <div className="grid gap-3">
              {isHuckJam ? (
                <HuckjamSidebarSummary overview={huckjamOverview!} />
              ) : (
                <AttentionPanel items={attention} onAction={handleAttentionClick} />
              )}
              <button
                type="button"
                onClick={() => setIsAddParticipantOpen(true)}
                className="inline-flex h-11 items-center justify-center gap-2 rounded-2xl bg-sky-600 px-3 text-sm font-black text-white shadow-sm transition hover:bg-sky-700"
              >
                <Plus size={17} /> Add Participant
              </button>
              <ParticipantColumns
                participants={activeCamp.participants}
                selectedParticipantId={selectedParticipantId}
                onSelectParticipant={(id) => {
                  setSelectedParticipantId(id);
                  setTabletPanel("participant");
                }}
                onSelectApplicants={focusApplicants}
                onToggleSelfBooking={toggleParticipantSelfBooking}
                selfBookingPendingIds={selfBookingPendingIds}
                selfBookingError={selfBookingError}
                onOpenMassBooking={openMassBooking}
                isCamp={activeCamp.type === "camp"}
              />
            </div>
          )}
        </TabletSlideOver>
      ) : null}

      <main className="p-4 md:hidden">
        <div className="rounded-2xl border border-white/10 bg-white p-5">
          <p className="text-sm font-black uppercase tracking-[0.16em] text-sky-700">
            Desktop workspace available
          </p>
          <h1 className="mt-2 text-2xl font-black">Coach Dashboard</h1>
          <p className="mt-2 text-sm font-semibold leading-6 text-slate-600">
            This control-tower workspace is optimized for desktop and tablet.
            Your mobile coaching pages stay available as usual.
          </p>
        </div>
      </main>
      {headerPanel === "share" ? (
        <CenteredModal title="Utilities" onClose={() => setHeaderPanel(null)}>
          <div className="grid gap-2">
            <UtilityCard
              tone="sky"
              icon={<Share2 size={19} />}
              title="Invite Athletes"
              description="Share this opportunity with athletes."
            >
              <ShareOpportunityButton
                label="Invite"
                shareText={shareText}
                url={publicUrl}
                copyUrlOnly
                compact
                fill
                variant="primary"
              />
            </UtilityCard>
            <UtilityCard
              tone={tunnelDashboardShared ? "amber" : "slate"}
              icon={<Users size={19} />}
              title="Tunnel Dashboard"
              description="Share live schedules with the tunnel."
              status={
                tunnelDashboardShared ? "✅ Shared With Tunnel" : "⚠ Not Shared Yet"
              }
            >
              <TunnelDashboardShareButton
                opportunityId={activeCamp.id}
                opportunityTitle={activeCamp.title}
                tunnelSharedAt={activeCamp.tunnelSharedAt}
                label="Share"
                compact
                fill
              />
            </UtilityCard>
            <UtilityCard
              tone="slate"
              icon={<Settings size={19} />}
              title="Opportunity Settings"
              description="Edit pricing, capacity and details."
            >
              <button
                type="button"
                onClick={() => {
                  setHeaderPanel(null);
                  setIsSettingsOpen(true);
                }}
                className="inline-flex h-10 w-full items-center justify-center rounded-xl bg-slate-950 px-3 text-sm font-bold text-white shadow-sm transition hover:bg-slate-800"
              >
                Open Settings
              </button>
            </UtilityCard>
          </div>
        </CenteredModal>
      ) : null}
      {isSettingsOpen ? (
        <CenteredModal title="Opportunity Settings" onClose={() => setIsSettingsOpen(false)}>
          <CampSettingsPanel
            key={`modal-${activeCamp.id}`}
            camp={activeCamp}
            onDeleteComplete={() => setIsSettingsOpen(false)}
          />
        </CenteredModal>
      ) : null}
      {isAddParticipantOpen ? (
        <AddParticipantModal
          opportunityId={activeCamp.id}
          opportunityTitle={activeCamp.title}
          opportunityType={activeCamp.type}
          onClose={() => setIsAddParticipantOpen(false)}
          onAdded={handleParticipantAdded}
        />
      ) : null}
      {profileModalParticipant ? (
        <ParticipantProfileModal
          participant={profileModalParticipant}
          onClose={() => setProfileModalParticipantId("")}
        />
      ) : null}
      {massBookingParticipant ? (
        <MassBookingModal
          key={massBookingParticipant.id}
          participant={massBookingParticipant}
          camp={activeCamp}
          onClose={() => setMassBookingParticipantId("")}
        />
      ) : null}
      </div>
    </div>
  );
}

function AddParticipantModal({
  opportunityId,
  opportunityTitle,
  opportunityType,
  onClose,
  onAdded,
}: {
  opportunityId: string;
  opportunityTitle: string;
  opportunityType: "camp" | "huck_jam";
  onClose: () => void;
  onAdded: (participant: Participant) => void;
}) {
  const [mode, setMode] = useState<"options" | "invite" | "dummy">("options");
  const [displayName, setDisplayName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [coachNote, setCoachNote] = useState("");
  const [label, setLabel] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [inviteLink, setInviteLink] = useState("");
  const [isPending, startTransition] = useTransition();

  function generateInviteLink() {
    setMessage("");
    setError("");

    startTransition(async () => {
      const result = await createOpportunityInviteLink(opportunityId);

      if (!result.ok) {
        setError(result.message);
        return;
      }

      const absoluteUrl = new URL(result.inviteUrl, window.location.origin).toString();
      setInviteLink(absoluteUrl);
      try {
        await navigator.clipboard.writeText(absoluteUrl);
        setMessage("Invite link copied.");
      } catch {
        setMessage("Invite link ready.");
      }
    });
  }

  async function shareInvite() {
    const link = inviteLink || new URL(`/opportunity/${opportunityId}?from=invite`, window.location.origin).toString();
    const typeLabel = opportunityType === "camp" ? "Camp" : "Huckjam";
    const shareText = [
      `Hi, here is the Flyloop link for ${opportunityTitle}:`,
      "",
      link,
      "",
      `Create your account and you will be taken directly to the ${typeLabel}.`,
    ].join("\n");

    if (navigator.share) {
      try {
        await navigator.share({ title: opportunityTitle, text: shareText, url: link });
        return;
      } catch {
        // Fall back to WhatsApp below when native sharing is cancelled or unavailable.
      }
    }

    window.open(`https://wa.me/?text=${encodeURIComponent(shareText)}`, "_blank", "noopener,noreferrer");
  }

  function createDummy() {
    setMessage("");
    setError("");

    startTransition(async () => {
      const actionResult = await createDummyParticipantForOpportunity({
        opportunityId,
        displayName,
        email,
        phone,
        coachNote,
        label,
      });

      if (!actionResult.ok || !actionResult.participant) {
        setError(actionResult.message);
        return;
      }

      const participant = createParticipantFromAction(actionResult.participant);
      onAdded(participant);
      setMessage(actionResult.message);
      setDisplayName("");
      setEmail("");
      setPhone("");
      setCoachNote("");
      setLabel("");
    });
  }

  const canCreateDummy = displayName.trim().length > 0;

  return (
    <CenteredModal title="Add Participant" onClose={onClose}>
      <div className="grid gap-4">
        {mode === "options" ? (
          <div className="grid gap-3 sm:grid-cols-2">
            <button
              type="button"
              autoFocus
              onClick={() => setMode("invite")}
              className="grid min-h-44 gap-3 rounded-2xl border border-slate-200 bg-white p-4 text-left transition hover:border-sky-300 hover:bg-sky-50"
            >
              <span className="grid size-10 place-items-center rounded-xl bg-sky-600 text-white">
                <LinkIcon size={18} />
              </span>
              <span>
                <span className="block text-base font-black text-slate-950">
                  Invite participant to Flyloop
                </span>
                <span className="mt-2 block text-sm font-semibold leading-6 text-slate-600">
                  Create a registration link that can be shared through WhatsApp or another messaging app.
                </span>
              </span>
              <span className="mt-auto inline-flex h-10 items-center justify-center gap-2 rounded-xl bg-slate-950 px-3 text-sm font-black text-white">
                Create invite link
              </span>
            </button>
            <button
              type="button"
              onClick={() => setMode("dummy")}
              className="grid min-h-44 gap-3 rounded-2xl border border-slate-200 bg-white p-4 text-left transition hover:border-sky-300 hover:bg-sky-50"
            >
              <span className="grid size-10 place-items-center rounded-xl bg-slate-950 text-white">
                <UserPlus size={18} />
              </span>
              <span>
                <span className="block text-base font-black text-slate-950">
                  Add planning dummy
                </span>
                <span className="mt-2 block text-sm font-semibold leading-6 text-slate-600">
                  Add a temporary participant for internal planning only.
                </span>
              </span>
              <span className="mt-auto inline-flex h-10 items-center justify-center gap-2 rounded-xl bg-sky-600 px-3 text-sm font-black text-white">
                Create dummy
              </span>
            </button>
          </div>
        ) : null}

        {mode === "invite" ? (
          <section className="grid gap-3 rounded-2xl border border-slate-200 bg-white p-3">
            <button
              type="button"
              onClick={() => setMode("options")}
              className="justify-self-start text-xs font-black text-slate-500"
            >
              Back
            </button>
            <button
              type="button"
              disabled={isPending}
              onClick={generateInviteLink}
              className="inline-flex h-11 items-center justify-center gap-2 rounded-xl bg-sky-600 px-3 text-sm font-black text-white transition hover:bg-sky-700 disabled:bg-slate-300"
            >
              <LinkIcon size={17} />
              {isPending ? "Creating..." : "Create invite link"}
            </button>
            {inviteLink ? (
              <div className="grid gap-2">
                <p className="break-all rounded-xl bg-slate-50 px-3 py-2 text-xs font-bold text-slate-600">
                  {inviteLink}
                </p>
                <button
                  type="button"
                  onClick={shareInvite}
                  className="inline-flex h-10 items-center justify-center gap-2 rounded-xl border border-slate-200 px-3 text-sm font-black text-slate-700 transition hover:bg-slate-50"
                >
                  <ExternalLink size={16} /> Share via WhatsApp
                </button>
              </div>
            ) : null}
          </section>
        ) : null}

        {mode === "dummy" ? (
          <section className="grid gap-3 rounded-2xl border border-slate-200 bg-slate-50 p-3">
            <button
              type="button"
              onClick={() => setMode("options")}
              className="justify-self-start text-xs font-black text-slate-500"
            >
              Back
            </button>
            <DashboardField label="Name">
              <input
                value={displayName}
                onChange={(event) => setDisplayName(event.target.value)}
                autoFocus
                className={dashboardInputClass}
              />
            </DashboardField>
            <DashboardField label="Custom label optional">
              <input
                value={label}
                onChange={(event) => setLabel(event.target.value)}
                className={dashboardInputClass}
              />
            </DashboardField>
          <DashboardField label="Email optional">
            <input
              type="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              className={dashboardInputClass}
            />
          </DashboardField>
          <DashboardField label="Phone optional">
            <input
              value={phone}
              onChange={(event) => setPhone(event.target.value)}
              className={dashboardInputClass}
            />
          </DashboardField>
          <DashboardField label="Coach Note optional">
            <textarea
              value={coachNote}
              onChange={(event) => setCoachNote(event.target.value)}
              rows={3}
              className="min-h-20 w-full min-w-0 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-bold text-slate-950 outline-none focus:border-sky-400"
            />
          </DashboardField>
          <button
            type="button"
            disabled={isPending || !canCreateDummy}
            onClick={createDummy}
            className="inline-flex h-11 items-center justify-center gap-2 rounded-xl bg-sky-600 px-3 text-sm font-black text-white transition hover:bg-sky-700 disabled:bg-slate-300"
          >
            <Plus size={17} />
            {isPending ? "Adding..." : "Add"}
          </button>
        </section>
        ) : null}

        {message ? (
          <p className="rounded-xl bg-emerald-50 px-3 py-2 text-sm font-bold text-emerald-700">
            {message}
          </p>
        ) : null}
        {error ? (
          <p className="rounded-xl bg-rose-50 px-3 py-2 text-sm font-bold text-rose-700">
            {error}
          </p>
        ) : null}
      </div>
    </CenteredModal>
  );
}

function createParticipantFromAction(
  participant: NonNullable<
    Awaited<ReturnType<typeof createDummyParticipantForOpportunity>>["participant"]
  >,
): Participant {
  return {
    ...participant,
    dummyParticipantId: participant.dummyParticipantId,
    isDummy: participant.isDummy,
    coachNote: participant.coachNote,
    label: participant.label,
    country: "",
    city: null,
    bio: null,
    instagramHandle: null,
    websiteUrl: null,
    youtubeUrl: null,
    homeTunnelName: null,
    homeTunnelCity: null,
    homeTunnelCountry: null,
    profileImageUrl: "",
    removalRequestedAt: null,
    tunnelTimeStatus: null,
    tunnelAccountEmail: null,
    selfBookingEnabled: false,
    profileStats: null,
  };
}

function CenteredModal({
  title,
  children,
  onClose,
}: {
  title: string;
  children: React.ReactNode;
  onClose: () => void;
}) {
  return (
    <ModalBackdrop
      className="fixed inset-0 z-50 grid place-items-center bg-slate-950/40 p-4"
      role="dialog"
      aria-modal="true"
      onBackdropClick={onClose}
    >
      <section
        className="grid max-h-[calc(100dvh-2rem)] w-full max-w-xl grid-rows-[auto_minmax(0,1fr)] overflow-hidden rounded-2xl border border-slate-200 bg-slate-100 shadow-2xl"
      >
        <div className="flex items-center justify-between gap-3 border-b border-slate-200 bg-white px-4 py-3">
          <h2 className="inline-flex items-center gap-2 text-lg font-black tracking-tight">
            {title === "Opportunity Settings" ? <Settings size={18} /> : null}
            {title}
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="grid size-9 place-items-center rounded-lg border border-slate-200 text-slate-500"
            aria-label="Close settings"
          >
            <X size={17} />
          </button>
        </div>
        <div className="overflow-y-auto p-3">{children}</div>
      </section>
    </ModalBackdrop>
  );
}

function UtilityCard({
  tone,
  icon,
  title,
  description,
  status,
  children,
}: {
  tone: "sky" | "amber" | "slate";
  icon: React.ReactNode;
  title: string;
  description: string;
  status?: string;
  children: React.ReactNode;
}) {
  const toneStyles =
    tone === "amber"
      ? "border-amber-200 bg-gradient-to-br from-amber-50 to-white"
      : tone === "sky"
        ? "border-sky-200 bg-gradient-to-br from-sky-50 to-white"
        : "border-slate-200 bg-gradient-to-br from-slate-50 to-white";

  const iconStyles =
    tone === "amber"
      ? "bg-amber-100 text-amber-700"
      : tone === "sky"
        ? "bg-sky-100 text-sky-700"
        : "bg-slate-100 text-slate-700";

  return (
    <section className={`grid h-full min-h-0 gap-2 rounded-2xl border p-3 text-left shadow-sm ${toneStyles}`}>
      <div className="flex items-start justify-between gap-2">
        <span className={`grid size-10 shrink-0 place-items-center rounded-2xl ${iconStyles}`}>
          {icon}
        </span>
      </div>
      <div className="min-w-0">
        <h2 className="text-sm font-black text-slate-950">{title}</h2>
        <p className="mt-1 text-xs font-semibold leading-4 text-slate-600">{description}</p>
        {status ? (
          <p className="mt-2 inline-flex rounded-full border border-slate-200 bg-white px-2.5 py-0.5 text-[0.7rem] font-black text-slate-600">
            {status}
          </p>
        ) : null}
      </div>
      <div className="mt-auto">{children}</div>
    </section>
  );
}

function TabletSlideOver({
  title,
  children,
  onClose,
}: {
  title: string;
  children: React.ReactNode;
  onClose: () => void;
}) {
  return (
    <div className="fixed inset-0 z-40 bg-slate-950/30 xl:hidden">
      <aside className="ml-auto grid h-full w-[min(26rem,92vw)] grid-rows-[auto_minmax(0,1fr)] border-l border-slate-200 bg-slate-100 shadow-2xl">
        <div className="flex items-center justify-between gap-3 border-b border-slate-200 bg-white px-4 py-3">
          <h2 className="text-lg font-black tracking-tight">{title}</h2>
          <button
            type="button"
            onClick={onClose}
            className="grid size-9 place-items-center rounded-lg border border-slate-200 text-slate-500"
            aria-label="Close tablet panel"
          >
            <X size={17} />
          </button>
        </div>
        <div className="overflow-y-auto p-3">{children}</div>
      </aside>
    </div>
  );
}

function AttentionPanel({
  items,
  onAction,
}: {
  items: AttentionItem[];
  onAction: (item: AttentionItem) => void;
}) {
  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-3 shadow-sm">
      <div className="flex items-center justify-between gap-2">
        <h2 className="text-xs font-black uppercase tracking-[0.16em] text-slate-500">
          Needs attention
        </h2>
        {items.length > 0 ? (
          <span className="rounded-full bg-amber-50 px-2 py-0.5 text-xs font-black text-amber-800">
            {items.length}
          </span>
        ) : null}
      </div>
      <div className="mt-2 grid gap-1.5">
        {items.length > 0 ? (
          items.map((item) => (
            <button
              key={item.label}
              type="button"
              onClick={() => onAction(item)}
              className={`flex min-h-9 items-center justify-between gap-2 rounded-xl border px-2.5 py-1.5 text-left text-sm font-black transition ${
                item.tone === "amber"
                  ? "border-amber-200 bg-amber-50 text-amber-900 hover:bg-amber-100"
                  : "border-slate-200 bg-slate-50 text-slate-700 hover:bg-slate-100"
              }`}
            >
              <span className="min-w-0 truncate">{item.label}</span>
              <span className="shrink-0 text-xs opacity-70">
                {item.target === "timetable" ? "View" : "Open"}
              </span>
            </button>
          ))
        ) : (
          <p className="rounded-xl border border-emerald-200 bg-emerald-50 px-2.5 py-1.5 text-sm font-black text-emerald-700">
            Everything is clear
          </p>
        )}
      </div>
    </section>
  );
}

function ParticipantColumns({
  participants,
  selectedParticipantId,
  onSelectParticipant,
  onSelectApplicants,
  onToggleSelfBooking,
  selfBookingPendingIds,
  selfBookingError,
  onOpenMassBooking,
  isCamp,
}: {
  participants: Participant[];
  selectedParticipantId: string;
  onSelectParticipant: (id: string) => void;
  onSelectApplicants: () => void;
  onToggleSelfBooking: (participantId: string, nextEnabled: boolean) => void;
  selfBookingPendingIds: Set<string>;
  selfBookingError: string;
  onOpenMassBooking: (participantId: string) => void;
  isCamp: boolean;
}) {
  const pending = participants.filter((participant) => participant.status === "pending");
  const accepted = participants.filter((participant) => participant.status === "accepted");
  const waitlist = participants.filter((participant) => participant.status === "waitlist");
  const statusColumns: Array<{
    status: InterestStatus;
    label: string;
    participants: Participant[];
  }> = [
    ...(pending.length > 0
      ? [
          {
            status: "pending" as InterestStatus,
            label: `Applicants (${pending.length})`,
            participants: pending,
          },
        ]
      : []),
    { status: "accepted", label: "Participants", participants: accepted },
    ...(waitlist.length > 0
      ? [{ status: "waitlist" as InterestStatus, label: "Waitlist", participants: waitlist }]
      : []),
  ];

  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-3 shadow-sm">
      {selfBookingError ? (
        <p className="mb-3 rounded-xl bg-rose-50 p-2 text-xs font-semibold text-rose-700">
          {selfBookingError}
        </p>
      ) : null}
      <div className="grid gap-3">
        {statusColumns.map((column) => {
          return (
            <div key={column.status}>
              {column.status === "pending" ? (
                <button
                  type="button"
                  onClick={onSelectApplicants}
                  className="flex w-full items-center justify-between text-left"
                >
                  <h2 className="text-xs font-black uppercase tracking-[0.14em] text-slate-500">
                    {column.label}
                  </h2>
                </button>
              ) : (
                <div className="flex items-center justify-between">
                  <h2 className="text-xs font-black uppercase tracking-[0.14em] text-slate-500">
                    {column.label}
                  </h2>
                  <span className="text-xs font-black text-slate-400">
                    {column.participants.length}
                  </span>
                </div>
              )}
              <div className="mt-2 grid gap-1.5">
                {column.participants.map((participant) => {
                  return (
                    <div
                      key={participant.id}
                      role="button"
                      tabIndex={0}
                      onClick={() => onSelectParticipant(participant.id)}
                      onKeyDown={(event) => {
                        if (event.key === "Enter" || event.key === " ") {
                          event.preventDefault();
                          onSelectParticipant(participant.id);
                        }
                      }}
                      className={`grid min-w-0 rounded-xl border px-2 py-2 text-left transition ${
                        selectedParticipantId === participant.id
                          ? "border-sky-300 bg-sky-50"
                          : "border-slate-200 hover:bg-slate-50"
                      }`}
                    >
                      <div className="flex items-start gap-2">
                        <div className="flex min-w-0 flex-1 items-center gap-2 px-1 py-0.5">
                          <Avatar
                            name={participant.name}
                            imageUrl={participant.profileImageUrl}
                            size="sm"
                          />
                          <div className="min-w-0 flex-1">
                            <p className="truncate text-sm font-black text-slate-950">
                              {participant.name}
                            </p>
                            {participant.participantStatus !== "registered" ? (
                              <span className="mt-1 inline-flex rounded-full bg-slate-100 px-2 py-0.5 text-[0.62rem] font-black uppercase tracking-[0.08em] text-slate-500">
                                Guest
                              </span>
                            ) : null}
                          </div>
                        </div>
                      </div>
                      {participant.status === "accepted" ? (
                        <div className="mt-2 grid justify-items-center gap-1.5">
                          {isCamp && participant.accountUserId ? (
                            <button
                              type="button"
                              disabled={selfBookingPendingIds.has(participant.id)}
                              onClick={(event) => {
                                event.stopPropagation();
                                onToggleSelfBooking(
                                  participant.id,
                                  !participant.selfBookingEnabled,
                                );
                              }}
                              className={`inline-flex items-center gap-1.5 rounded-full border px-2 py-0.5 text-[0.62rem] font-black uppercase tracking-[0.08em] transition disabled:cursor-wait disabled:opacity-60 ${
                                participant.selfBookingEnabled
                                  ? "border-sky-200 bg-sky-50 text-sky-700 hover:bg-sky-100"
                                  : "border-slate-200 bg-white text-slate-500 hover:bg-slate-50"
                              }`}
                              aria-label={`Toggle self booking for ${participant.name}`}
                            >
                              <span>Self Booking</span>
                              <span
                                className={`rounded-full px-1.5 py-0.5 ${
                                  participant.selfBookingEnabled
                                    ? "bg-sky-600 text-white"
                                    : "bg-slate-200 text-slate-600"
                                }`}
                              >
                                {participant.selfBookingEnabled ? "ON" : "OFF"}
                              </span>
                            </button>
                          ) : null}
                          <button
                            type="button"
                            onClick={(event) => {
                              event.stopPropagation();
                              onOpenMassBooking(participant.id);
                            }}
                            className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-sky-200 bg-sky-50 px-2.5 text-xs font-black text-sky-700 transition hover:bg-sky-100"
                          >
                            <CalendarDays size={14} /> Mass Booking
                          </button>
                        </div>
                      ) : (
                        <div className="mt-2" onClick={(event) => event.stopPropagation()}>
                          <ApplicantStatusActions
                            interestId={participant.interestId}
                            currentStatus={participant.status}
                          />
                        </div>
                      )}
                    </div>
                  );
                })}
                {column.participants.length === 0 ? (
                  <p className="rounded-xl border border-dashed border-slate-200 px-2 py-2 text-sm font-bold text-slate-400">
                    No accepted participants yet
                  </p>
                ) : null}
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}

function getUnpublishedChangeCount(slots: TimetableSlot[]) {
  return slots.reduce((count, slot) => {
    const draftBookings = slot.bookings.filter((booking) => booking.isFinal === false).length;
    return count + (slot.isPublished === false ? 1 : 0) + draftBookings;
  }, 0);
}

function EditDayButton({
  camp,
  date,
}: {
  camp: CampWorkspace;
  date: string;
}) {
  return <CampBuilderEditDayModal camp={camp} date={date} />;
}
function PublishTimetableButton({
  camp,
  compact = false,
}: {
  camp: CampWorkspace;
  compact?: boolean;
}) {
  const router = useRouter();
  const [toast, setToast] = useState("");
  const [error, setError] = useState("");
  const [isPending, startTransition] = useTransition();

  function publish() {
    setToast("");
    setError("");

    const nextSlots: TimetableSlotInput[] = camp.timetableSlots.map((slot) => ({
      id: slot.id,
      slotDate: slot.slotDate,
      startTime: slot.startTime.slice(0, 5),
      durationMinutes: slot.durationMinutes,
      capacity: slot.capacity,
    }));

    startTransition(async () => {
      const result = await saveCampTimetable(camp.id, nextSlots, true, {
        redirectOnPublish: false,
      });

      if (!result.ok) {
        setError(result.message);
        return;
      }

      setToast("Timetable published.");
      router.refresh();
      window.setTimeout(() => setToast(""), 3000);
    });
  }

  return (
    <>
      <button
        type="button"
        onClick={publish}
        disabled={isPending}
        className={`inline-flex h-9 items-center justify-center gap-1.5 rounded-xl bg-emerald-600 px-3 text-xs font-black text-white transition hover:bg-emerald-700 disabled:bg-slate-300 ${
          compact ? "whitespace-nowrap" : ""
        }`}
      >
        <Send size={15} /> {isPending ? "Publishing..." : "Publish Timetable"}
      </button>
      {error ? (
        <p className="max-w-52 text-xs font-semibold text-rose-700">{error}</p>
      ) : null}
      {toast ? (
        <div
          role="status"
          aria-live="polite"
          className="fixed right-4 top-4 z-[80] w-[min(calc(100vw-2rem),20rem)] rounded-2xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm font-bold text-emerald-700 shadow-xl"
        >
          {toast}
        </div>
      ) : null}
    </>
  );
}

function CampSettingsPanel({
  camp,
  onDeleteComplete,
}: {
  camp: CampWorkspace;
  onDeleteComplete?: () => void;
}) {
  const router = useRouter();
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [deleteError, setDeleteError] = useState("");
  const [isDeleteConfirmOpen, setIsDeleteConfirmOpen] = useState(false);
  const [isPending, startTransition] = useTransition();
  const [form, setForm] = useState({
    title: camp.title,
    description: camp.description,
    registrationDeadline: camp.registrationDeadline ?? "",
    price: String(camp.price),
    totalCapacity: String(camp.totalCapacity),
  });

  function updateField(name: keyof typeof form, value: string) {
    setForm((current) => ({ ...current, [name]: value }));
  }

  function save() {
    setMessage("");
    setError("");

    const payload: OpportunityFormInput = {
      type: camp.type,
      bookingMode: "approval_required",
      title: form.title,
      tunnelId: camp.tunnelId,
      startDate: camp.startDate,
      endDate: camp.endDate,
      registrationDeadline: form.registrationDeadline,
      tunnelTimeMode: camp.tunnelTimeMode,
      sessionStart: camp.sessionStart ?? "",
      sessionEnd: camp.sessionEnd ?? "",
      price: Number(form.price),
      currency: camp.currency,
      totalCapacity: Number(form.totalCapacity),
      minMinutesOrHours: camp.priceAppliesToMinutes,
      description: form.description,
      languages: "",
      disciplines: "",
      skillLevel: "",
    };

    startTransition(async () => {
      const result = await updateOpportunity(camp.id, payload);

      if (!result.ok) {
        setError(result.message);
        return;
      }

      setMessage("Camp settings saved.");
      router.refresh();
    });
  }

  function publish() {
    setError("");
    setMessage("");
    startTransition(async () => {
      const result = await publishDraftOpportunity(camp.id);

      if (!result.ok) {
        setError(result.message);
        return;
      }

      setMessage("Camp published.");
      router.refresh();
    });
  }

  function openDeleteConfirm() {
    setDeleteError("");
    setIsDeleteConfirmOpen(true);
  }

  function closeDeleteConfirm() {
    if (isPending) {
      return;
    }

    setDeleteError("");
    setIsDeleteConfirmOpen(false);
  }

  function deleteCamp() {
    setDeleteError("");

    startTransition(async () => {
      const result = await deleteOpportunity(camp.id);

      if (!result.ok) {
        setDeleteError(result.message);
        return;
      }

      setIsDeleteConfirmOpen(false);
      onDeleteComplete?.();
      router.replace("/app/coach-dashboard");
      router.refresh();
    });
  }

  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-3 shadow-sm">
      {camp.status === "draft" ? (
        <div className="flex items-center justify-end gap-2">
          <button
            type="button"
            onClick={publish}
            disabled={isPending}
            className="h-9 rounded-xl bg-emerald-600 px-3 text-xs font-black text-white disabled:bg-slate-300"
          >
            Publish
          </button>
        </div>
      ) : null}
      <div className="mt-3 grid gap-2">
        <DashboardField label="Camp Name">
          <input
            value={form.title}
            onChange={(event) => updateField("title", event.target.value)}
            className={dashboardInputClass}
          />
        </DashboardField>
        <DashboardField label="Description">
          <textarea
            value={form.description}
            onChange={(event) => updateField("description", event.target.value)}
            className={`${dashboardInputClass} h-20 py-2`}
          />
        </DashboardField>
        <DashboardField label="Registration Deadline">
          <input
            type="date"
            value={form.registrationDeadline}
            onChange={(event) =>
              updateField("registrationDeadline", event.target.value)
            }
            className={dashboardInputClass}
          />
        </DashboardField>
        <DashboardField label="Price">
          <input
            inputMode="decimal"
            value={form.price}
            onChange={(event) => updateField("price", event.target.value)}
            className={dashboardInputClass}
          />
        </DashboardField>
        <DashboardField label="Capacity">
          <input
            inputMode="numeric"
            value={form.totalCapacity}
            onChange={(event) => updateField("totalCapacity", event.target.value)}
            className={dashboardInputClass}
          />
        </DashboardField>
      </div>
      <div className="mt-3 grid gap-2">
        <button
          type="button"
          onClick={save}
          disabled={isPending}
          className="inline-flex h-10 w-full items-center justify-center gap-2 rounded-xl bg-sky-600 text-sm font-black text-white disabled:bg-slate-300"
        >
          <Save size={16} /> {isPending ? "Saving..." : "Save Immediately"}
        </button>
        <button
          type="button"
          onClick={openDeleteConfirm}
          disabled={isPending}
          className="inline-flex h-10 w-full items-center justify-center gap-2 rounded-xl border border-rose-200 bg-rose-50 text-sm font-black text-rose-700 transition hover:bg-rose-100 disabled:border-slate-200 disabled:bg-slate-50 disabled:text-slate-400"
        >
          Delete Camp
        </button>
      </div>
      {message ? (
        <p className="mt-2 rounded-xl bg-emerald-50 p-2 text-sm font-bold text-emerald-700">
          {message}
        </p>
      ) : null}
      {error ? (
        <p className="mt-2 rounded-xl bg-rose-50 p-2 text-sm font-bold text-rose-700">
          {error}
        </p>
      ) : null}
      {isDeleteConfirmOpen ? (
        <CenteredModal title="Delete Camp?" onClose={closeDeleteConfirm}>
          <div className="grid gap-4">
            <p className="text-sm font-semibold leading-6 text-slate-600">
              This action cannot be undone.
            </p>
            {deleteError ? (
              <p className="rounded-xl bg-rose-50 p-3 text-sm font-bold text-rose-700">
                {deleteError}
              </p>
            ) : null}
            <div className="flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={closeDeleteConfirm}
                disabled={isPending}
                className="inline-flex h-10 items-center justify-center rounded-xl border border-slate-200 bg-white px-4 text-sm font-black text-slate-700 transition hover:bg-slate-50 disabled:text-slate-400"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={deleteCamp}
                disabled={isPending}
                className="inline-flex h-10 items-center justify-center rounded-xl bg-rose-600 px-4 text-sm font-black text-white transition hover:bg-rose-700 disabled:bg-slate-300"
              >
                {isPending ? "Deleting..." : "Delete Camp"}
              </button>
            </div>
          </div>
        </CenteredModal>
      ) : null}
    </section>
  );
}

function ParticipantPanel({
  participant,
  camp,
  onClear,
  onOpenProfile,
}: {
  participant: Participant;
  camp: CampWorkspace;
  onClear: () => void;
  onOpenProfile: () => void;
}) {
  const [selfBookingEnabled, setSelfBookingEnabled] = useState(
    participant.selfBookingEnabled,
  );
  const [toggleMessage, setToggleMessage] = useState("");
  const [toggleError, setToggleError] = useState("");
  const [isTogglePending, startToggleTransition] = useTransition();

  const bookedSlots = camp.timetableSlots.flatMap((slot) =>
    slot.bookings
      .filter((booking) => booking.userId === participant.userId)
      .map((booking) => ({
        id: booking.id,
        date: slot.slotDate,
        time: slot.startTime,
        minutes: booking.minutes,
        isFinal: booking.isFinal === true,
        releaseRequestedAt: booking.releaseRequestedAt ?? null,
      })),
  );
  const bookedMinutes = bookedSlots.reduce((total, slot) => total + slot.minutes, 0);
  const bookedSlotsByDay = groupBookedSlotsByDay(bookedSlots);
  const preferencesByDay = camp.preferences
    .filter((preference) => preference.participantId === participant.userId)
    .sort((a, b) => a.dayId - b.dayId);

  function updateSelfBooking(nextEnabled: boolean) {
    if (isTogglePending || selfBookingEnabled === nextEnabled) {
      return;
    }

    setToggleMessage("");
    setToggleError("");
    const previousEnabled = selfBookingEnabled;
    setSelfBookingEnabled(nextEnabled);

    startToggleTransition(async () => {
      try {
        const result = await setCampParticipantSelfBooking(
          participant.interestId,
          nextEnabled,
        );

        if (!result.ok) {
          setSelfBookingEnabled(previousEnabled);
          setToggleError(result.message);
          return;
        }

        setToggleMessage(result.message);
      } catch (toggleError) {
        console.error("Self-booking update failed", toggleError);
        setSelfBookingEnabled(previousEnabled);
        setToggleError("Could not update self-booking.");
      }
    });
  }

  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-3 shadow-sm">
      <div className="flex items-start justify-between gap-3">
        <button
          type="button"
          onClick={onOpenProfile}
          className="flex min-w-0 items-center gap-3 rounded-2xl px-1 py-1 text-left transition hover:bg-slate-50"
        >
          <Avatar
            name={participant.name}
            imageUrl={participant.profileImageUrl}
            size="md"
          />
          <div className="min-w-0">
            <h2 className="truncate text-lg font-black text-slate-950">
              {participant.name}
            </h2>
            <p className="truncate text-sm font-bold text-sky-700">View profile</p>
            {participant.isDummy ? (
              <span className="mt-1 inline-flex rounded-full bg-sky-100 px-2 py-0.5 text-[0.68rem] font-black uppercase tracking-[0.08em] text-sky-700">
                Planning only
              </span>
            ) : participant.participantStatus !== "registered" ? (
              <span className="mt-1 inline-flex rounded-full bg-slate-100 px-2 py-0.5 text-[0.68rem] font-black uppercase tracking-[0.08em] text-slate-500">
                Guest
              </span>
            ) : null}
          </div>
        </button>
        <button
          type="button"
          onClick={onClear}
          className="rounded-lg border border-slate-200 px-2 py-1 text-xs font-black text-slate-500"
        >
          Close
        </button>
      </div>
      <div className="mt-3 grid gap-2 sm:grid-cols-2">
        <CompactMetric label="Booked" value={formatBookedTimeSummary(bookedMinutes)} />
        <CompactMetric
          label="Tunnel"
          value={
            participant.tunnelTimeStatus === "owns_tunnel_time"
              ? "Available"
              : "Not available"
          }
          tone={participant.tunnelTimeStatus === "owns_tunnel_time" ? "success" : "slate"}
        />
      </div>
      {camp.type === "camp" && participant.status === "accepted" && !participant.isDummy ? (
        <div className="mt-3 rounded-2xl border border-slate-200 bg-slate-50 p-3">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="text-[0.68rem] font-black uppercase tracking-[0.14em] text-slate-400">
                Self-booking
              </p>
              <p className="mt-1 text-sm font-semibold leading-6 text-slate-600">
                {participant.accountUserId
                  ? "Allow this accepted athlete to choose their own flight times."
                  : "Available after this guest claims a Flyloop account."}
              </p>
            </div>
            <span
              className={`inline-flex h-8 shrink-0 items-center rounded-full px-3 text-[0.68rem] font-black uppercase tracking-[0.08em] ${
                selfBookingEnabled
                  ? "bg-sky-100 text-sky-700"
                  : "bg-white text-slate-500"
              }`}
            >
              {selfBookingEnabled ? "Enabled" : "Off"}
            </span>
          </div>
          <div className="mt-3 grid gap-2 sm:grid-cols-2">
            <button
              type="button"
              disabled={isTogglePending || selfBookingEnabled || !participant.accountUserId}
              onClick={() => updateSelfBooking(true)}
              className="inline-flex h-10 items-center justify-center rounded-xl bg-sky-600 text-sm font-black text-white transition hover:bg-sky-700 disabled:bg-slate-300"
            >
              {isTogglePending && !selfBookingEnabled ? "Enabling..." : "Enable"}
            </button>
            <button
              type="button"
              disabled={isTogglePending || !selfBookingEnabled || !participant.accountUserId}
              onClick={() => updateSelfBooking(false)}
              className="inline-flex h-10 items-center justify-center rounded-xl border border-slate-200 bg-white text-sm font-black text-slate-700 transition hover:bg-slate-50 disabled:text-slate-400"
            >
              {isTogglePending && selfBookingEnabled ? "Disabling..." : "Disable"}
            </button>
          </div>
          <p className="mt-2 text-[0.7rem] font-black uppercase tracking-[0.08em] text-slate-400">
            When enabled, the athlete can select published slots themselves.
          </p>
          {selfBookingEnabled ? (
            <span className="mt-2 inline-flex rounded-full bg-sky-100 px-2.5 py-1 text-[0.64rem] font-black uppercase tracking-[0.08em] text-sky-700">
              SELF-BOOKING ENABLED
            </span>
          ) : null}
          {toggleMessage ? (
            <p className="mt-2 rounded-xl bg-emerald-50 px-3 py-2 text-sm font-semibold text-emerald-700">
              {toggleMessage}
            </p>
          ) : null}
          {toggleError ? (
            <p className="mt-2 rounded-xl bg-rose-50 px-3 py-2 text-sm font-semibold text-rose-700">
              {toggleError}
            </p>
          ) : null}
        </div>
      ) : null}
      {participant.isDummy ? (
        <div className="mt-3 rounded-2xl border border-sky-200 bg-sky-50 p-3">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="text-[0.68rem] font-black uppercase tracking-[0.14em] text-sky-700">
                Planning only
              </p>
              <p className="mt-1 text-sm font-semibold leading-6 text-slate-600">
                This dummy belongs only to this opportunity and has no Flyloop account.
              </p>
            </div>
            <span className="rounded-full bg-white px-2.5 py-1 text-[0.68rem] font-black uppercase tracking-[0.08em] text-sky-700">
              Dummy
            </span>
          </div>
        </div>
      ) : participant.participantStatus !== "registered" ? (
        <div className="mt-3 rounded-2xl border border-sky-200 bg-sky-50 p-3">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="text-[0.68rem] font-black uppercase tracking-[0.14em] text-sky-700">
                Legacy guest
              </p>
              <p className="mt-1 text-sm font-semibold leading-6 text-slate-600">
                Claim links are no longer available. Invite this person with the opportunity link instead.
              </p>
            </div>
            <span className="rounded-full bg-white px-2.5 py-1 text-[0.68rem] font-black uppercase tracking-[0.08em] text-sky-700">
              Guest
            </span>
          </div>
        </div>
      ) : null}
      {participant.status !== "accepted" ? (
        <div className="mt-3 rounded-2xl border border-slate-200 bg-slate-50 p-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <p className="text-[0.68rem] font-black uppercase tracking-[0.14em] text-slate-400">
                Application Actions
              </p>
              <p className="mt-1 text-sm font-semibold text-slate-600">
                Restore the applicant to any workflow state.
              </p>
            </div>
            <span className="rounded-full bg-white px-2.5 py-1 text-xs font-black text-slate-500">
              {formatInterestStatusLabel(participant.status)}
            </span>
          </div>
          <div className="mt-3">
            <ApplicantStatusActions
              key={`${participant.id}-${participant.status}`}
              interestId={participant.interestId}
              currentStatus={participant.status}
            />
          </div>
        </div>
      ) : null}
      <div className="mt-3">
        <details className="group rounded-2xl border border-slate-200 bg-slate-50">
          <summary className="flex cursor-pointer list-none items-center justify-between gap-3 px-3 py-2.5 text-sm font-black text-slate-700 [&::-webkit-details-marker]:hidden">
            <span>Participant Details</span>
            <ChevronRight
              size={16}
              className="shrink-0 text-slate-400 transition group-open:rotate-90"
            />
          </summary>
          <div className="grid gap-1.5 border-t border-slate-200 px-3 py-2.5 text-sm font-semibold text-slate-600">
            <p>Email: {participant.email || "No email"}</p>
            <p>Phone: {participant.phone || "Not provided"}</p>
            {participant.isDummy ? (
              <>
                <p>Label: {participant.label || "None"}</p>
                <p>Note: {participant.coachNote || "None"}</p>
              </>
            ) : null}
            <p>
              Tunnel Time:{" "}
              {participant.tunnelTimeStatus === "owns_tunnel_time"
                ? "Available"
                : participant.tunnelTimeStatus === "needs_tunnel_time"
                  ? "Not available"
                  : "Not provided"}
            </p>
            <p>
              Tunnel Account Email: {participant.tunnelAccountEmail || "Not provided"}
            </p>
          </div>
        </details>
      </div>
      <div className="mt-3 grid gap-3">
        {camp.type === "camp" ? (
          <details className="group rounded-2xl border border-slate-200 bg-slate-50">
            <summary className="flex cursor-pointer list-none items-center justify-between gap-3 px-3 py-2.5 text-sm font-black text-slate-700 [&::-webkit-details-marker]:hidden">
              <span>Preferences ({preferencesByDay.length})</span>
              <ChevronRight
                size={16}
                className="shrink-0 text-slate-400 transition group-open:rotate-90"
              />
            </summary>
            <div className="grid gap-1.5 border-t border-slate-200 px-3 py-2.5">
              {preferencesByDay.length > 0 ? (
                preferencesByDay.map((preference) => (
                  <p
                    key={`${preference.participantId}-${preference.dayId}`}
                    className="rounded-xl bg-white px-3 py-2 text-sm font-semibold text-slate-700"
                  >
                    {formatCampDayPreferenceLabel(
                      camp.startDate,
                      camp.endDate,
                      preference.dayId,
                    )}
                    : {formatCampPreferenceMinutes(preference.preferredMinutes)}
                  </p>
                ))
              ) : (
                <p className="rounded-xl bg-white px-3 py-2 text-sm font-semibold text-slate-500">
                  No preferences submitted.
                </p>
              )}
            </div>
          </details>
        ) : null}
        {camp.type === "camp" ? (
          <details className="group rounded-2xl border border-slate-200 bg-slate-50">
            <summary className="flex cursor-pointer list-none items-center justify-between gap-3 px-3 py-2.5 text-sm font-black text-slate-700 [&::-webkit-details-marker]:hidden">
              <span>Booked Slots ({bookedSlots.length})</span>
              <ChevronRight
                size={16}
                className="shrink-0 text-slate-400 transition group-open:rotate-90"
              />
            </summary>
            <div className="grid gap-1.5 border-t border-slate-200 px-3 py-2.5">
              {bookedSlotsByDay.length > 0 ? (
                bookedSlotsByDay.map((day) => (
                  <section key={day.date} className="grid gap-1.5 rounded-xl bg-white p-2.5">
                    <h4 className="text-sm font-black text-slate-950">
                      {formatTimetableDate(day.date)}
                    </h4>
                    <div className="grid gap-0.5">
                      {day.slots.map((slot) => (
                        <p
                          key={slot.id}
                          className="rounded-lg px-2 py-1 text-sm font-semibold text-slate-700"
                        >
                          {formatTimetableTime(slot.time)} - {slot.minutes} min
                        </p>
                      ))}
                    </div>
                  </section>
                ))
              ) : (
                <p className="rounded-xl bg-white px-3 py-2 text-sm font-black text-amber-700">
                  No slots assigned
                </p>
              )}
            </div>
          </details>
        ) : null}
      </div>
    </section>
  );
}

function HuckjamOverviewPanel({
  camp,
  overview,
  compact = false,
}: {
  camp: CampWorkspace;
  overview: ReturnType<typeof getHuckjamOverview>;
  compact?: boolean;
}) {
  return (
    <section className="min-w-0 rounded-2xl border border-slate-200 bg-white shadow-sm">
      <div className={`grid gap-4 ${compact ? "p-3" : "p-4 sm:p-5"}`}>
        <div className="rounded-[1.75rem] border border-sky-100 bg-[linear-gradient(135deg,#eff6ff_0%,#f8fafc_42%,#ecfeff_100%)] p-4 shadow-[inset_0_1px_0_rgba(255,255,255,0.7)] sm:p-5">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div className="max-w-2xl">
              <p className="text-[0.68rem] font-black uppercase tracking-[0.16em] text-sky-700">
                Huckjam Overview
              </p>
              <h2 className="mt-2 text-2xl font-black tracking-tight text-slate-950 sm:text-[2rem]">
                How full is the event?
              </h2>
              <p className="mt-2 max-w-xl text-sm font-semibold leading-6 text-slate-600">
                Keep an eye on registrations, revenue, and remaining capacity
                without any timetable noise.
              </p>
            </div>
            <div className="grid min-w-[12rem] gap-1.5 rounded-2xl border border-white/80 bg-white/85 px-4 py-3 text-slate-950 shadow-sm backdrop-blur">
              <p className="text-[0.68rem] font-black uppercase tracking-[0.14em] text-slate-400">
                Start countdown
              </p>
              <p className="text-2xl font-black tracking-tight">
                {overview.daysRemaining} days
              </p>
              <div className="inline-flex items-center gap-2 text-sm font-bold text-sky-700">
                <CalendarClock size={16} />
                Until Huckjam starts
              </div>
            </div>
          </div>

          <div
            className={`mt-5 grid gap-3 ${compact ? "md:grid-cols-2" : "md:grid-cols-2 xl:grid-cols-4"}`}
          >
            <HuckjamMetricCard
              label="Registered Participants"
              value={`${overview.confirmedCount} / ${camp.totalCapacity}`}
              icon={<Users size={18} />}
              detail={`${overview.capacityPercent}% of capacity`}
            />
            <HuckjamMetricCard
              label="Revenue"
              value={formatPrice(overview.revenue, camp.currency)}
              icon={<CircleDollarSign size={18} />}
              detail="Confirmed participants x participation fee"
            />
            <HuckjamMetricCard
              label="Available Spots"
              value={overview.availableSpots}
              icon={<CalendarDays size={18} />}
              detail="Remaining places to fill"
            />
            <HuckjamMetricCard
              label="Days Remaining"
              value={overview.daysRemaining}
              icon={<CalendarClock size={18} />}
              detail="Until the Huckjam begins"
            />
          </div>
        </div>

        <div className={`grid gap-4 ${compact ? "" : "xl:grid-cols-[minmax(0,1.2fr)_minmax(20rem,0.8fr)]"}`}>
          <section className="rounded-[1.75rem] border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <p className="text-[0.68rem] font-black uppercase tracking-[0.16em] text-slate-400">
                  Capacity Progress
                </p>
                <h3 className="mt-1 text-xl font-black tracking-tight text-slate-950">
                  {overview.confirmedCount} of {camp.totalCapacity} spots filled
                </h3>
              </div>
              <span className="rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1 text-sm font-black text-emerald-700">
                {overview.capacityPercent}% Full
              </span>
            </div>

            <div className="mt-4">
              <div className="flex items-center justify-between gap-3 text-sm font-bold text-slate-500">
                <span>{overview.confirmedCount} registered participants</span>
                <span>{overview.availableSpots} spots left</span>
              </div>
              <div className="mt-3 h-5 overflow-hidden rounded-full bg-slate-100">
                <div
                  className="h-full rounded-full bg-gradient-to-r from-sky-500 via-cyan-500 to-emerald-500 transition-[width] duration-500"
                  style={{ width: `${overview.capacityPercent}%` }}
                  aria-hidden="true"
                />
              </div>
              <div className="mt-3 flex items-center justify-between gap-3">
                <p className="text-sm font-black text-slate-700">
                  {overview.capacityPercent}% Full
                </p>
                <p className="text-sm font-semibold text-slate-500">
                  Capacity is the story here
                </p>
              </div>
            </div>
          </section>

          <section className="rounded-[1.75rem] border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-[0.68rem] font-black uppercase tracking-[0.16em] text-slate-400">
                  Recent Registrations
                </p>
                <h3 className="mt-1 text-xl font-black tracking-tight text-slate-950">
                  Who just signed up?
                </h3>
              </div>
              <span className="rounded-full bg-slate-100 px-3 py-1 text-sm font-black text-slate-700">
                {overview.recentRegistrations.length}
              </span>
            </div>

            <div className="mt-4 grid gap-2">
              {overview.recentRegistrations.length > 0 ? (
                overview.recentRegistrations.map((registration) => (
                  <article
                    key={`${registration.id}-${registration.createdAt}`}
                    className="flex items-center gap-3 rounded-2xl border border-slate-200 bg-slate-50 px-3 py-2.5"
                  >
                    <Avatar
                      name={registration.name}
                      imageUrl={registration.profileImageUrl}
                      size="sm"
                    />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-black text-slate-950">
                        {registration.name}
                      </p>
                      <p className="text-xs font-semibold text-slate-500">
                        {registration.relativeTime}
                      </p>
                    </div>
                    <span className="rounded-full bg-white px-2.5 py-1 text-[0.68rem] font-black uppercase tracking-[0.08em] text-slate-500">
                      {formatInterestStatusLabel(registration.status)}
                    </span>
                  </article>
                ))
              ) : (
                <p className="rounded-2xl border border-dashed border-slate-200 bg-slate-50 px-3 py-4 text-sm font-semibold text-slate-500">
                  No recent registrations yet.
                </p>
              )}
            </div>
          </section>
        </div>
      </div>
    </section>
  );
}

function HuckjamSidebarSummary({
  overview,
}: {
  overview: ReturnType<typeof getHuckjamOverview>;
}) {
  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-3 shadow-sm">
      <p className="text-[0.68rem] font-black uppercase tracking-[0.16em] text-slate-400">
        Huckjam Summary
      </p>
      <div className="mt-3 grid gap-2">
        <div className="grid grid-cols-3 gap-2">
          <HuckjamSidebarMetric label="Confirmed" value={overview.confirmedCount} />
          <HuckjamSidebarMetric label="Waitlist" value={overview.waitlistCount} />
          <HuckjamSidebarMetric label="Declined" value={overview.declinedCount} />
        </div>
      </div>
    </section>
  );
}

function HuckjamMetricCard({
  label,
  value,
  detail,
  icon,
}: {
  label: string;
  value: string | number;
  detail: string;
  icon: React.ReactNode;
}) {
  return (
    <div className="flex min-h-28 flex-col justify-between rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-[0.68rem] font-black uppercase tracking-[0.16em] text-slate-400">
            {label}
          </p>
          <p className="mt-2 text-2xl font-black tracking-tight text-slate-950">
            {value}
          </p>
        </div>
        <div className="grid size-10 place-items-center rounded-2xl bg-slate-100 text-sky-700">
          {icon}
        </div>
      </div>
      <p className="mt-3 text-sm font-semibold leading-6 text-slate-500">
        {detail}
      </p>
    </div>
  );
}

function HuckjamSidebarMetric({
  label,
  value,
}: {
  label: string;
  value: string | number;
}) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-slate-50 px-3 py-2 text-center">
      <p className="text-[0.64rem] font-black uppercase tracking-[0.14em] text-slate-400">
        {label}
      </p>
      <p className="mt-1 text-xl font-black tracking-tight text-slate-950">
        {value}
      </p>
    </div>
  );
}

function StatCard({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="rounded-xl bg-slate-50 px-3 py-2">
      <p className="text-xs font-black uppercase tracking-[0.12em] text-slate-400">
        {label}
      </p>
      <p className="mt-1 text-2xl font-black text-slate-950">{value}</p>
    </div>
  );
}

function FlightCapacityCard({
  hasTimetable,
  bookedMinutes,
  availableMinutes,
}: {
  hasTimetable: boolean;
  bookedMinutes: number;
  availableMinutes: number;
}) {
  if (!hasTimetable) {
    return (
      <div className="rounded-xl bg-slate-50 px-3 py-2">
        <p className="text-xs font-black uppercase tracking-[0.12em] text-slate-400">
          Flight Capacity
        </p>
        <p className="mt-1 text-2xl font-black text-slate-950">N/A</p>
        <p className="mt-2 text-xs font-black text-slate-500">
          No timetable created yet.
        </p>
      </div>
    );
  }

  const totalMinutes = bookedMinutes + availableMinutes;
  const bookedPercent =
    totalMinutes > 0 ? Math.min((bookedMinutes / totalMinutes) * 100, 100) : 0;
  const bookedLabel = `${bookedPercent.toFixed(bookedPercent % 1 === 0 ? 0 : 1)}% booked`;

  return (
    <div className="rounded-xl bg-slate-50 px-3 py-2">
      <p className="text-xs font-black uppercase tracking-[0.12em] text-slate-400">
        Flight Capacity
      </p>
      <p className="mt-1 text-2xl font-black text-slate-950">
        {bookedMinutes} / {totalMinutes} min
      </p>
      <div className="mt-2 h-2 overflow-hidden rounded-full bg-slate-200" aria-hidden="true">
        <div
          className="h-full rounded-full bg-sky-600"
          style={{ width: `${bookedPercent}%` }}
        />
      </div>
      <p className="mt-2 text-xs font-black text-slate-500">{bookedLabel}</p>
    </div>
  );
}

function CompactMetric({
  label,
  value,
  tone = "slate",
}: {
  label: string;
  value: string;
  tone?: "slate" | "success";
}) {
  const toneStyles =
    tone === "success"
      ? "border-emerald-200 bg-emerald-50 text-emerald-700"
      : "border-slate-200 bg-slate-50 text-slate-700";

  return (
    <div className={`rounded-xl border px-3 py-2 ${toneStyles}`}>
      <p className="text-[0.64rem] font-black uppercase tracking-[0.12em] text-slate-400">
        {label}
      </p>
      <p className="mt-1 text-sm font-black text-slate-950">{value}</p>
    </div>
  );
}

function DashboardField({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <label className="grid gap-1 text-xs font-black uppercase tracking-[0.08em] text-slate-500">
      {label}
      {children}
    </label>
  );
}

const dashboardInputClass =
  "min-h-10 w-full min-w-0 rounded-xl border border-slate-200 bg-white px-3 text-sm font-bold text-slate-950 outline-none focus:border-sky-400";

function useWorkspaceViewport(): WorkspaceViewport | null {
  const [viewport, setViewport] = useState<WorkspaceViewport | null>(null);

  useEffect(() => {
    const desktopQuery = window.matchMedia("(min-width: 1280px)");
    const tabletQuery = window.matchMedia("(min-width: 768px)");
    const updateViewport = () => {
      setViewport(
        desktopQuery.matches
          ? "desktop"
          : tabletQuery.matches
            ? "tablet"
            : "mobile",
      );
    };

    // Keep the server and first client render identical, then remove the
    // CSS-hidden workspace tree as soon as the viewport is known.
    updateViewport();
    desktopQuery.addEventListener("change", updateViewport);
    tabletQuery.addEventListener("change", updateViewport);

    return () => {
      desktopQuery.removeEventListener("change", updateViewport);
      tabletQuery.removeEventListener("change", updateViewport);
    };
  }, []);

  return viewport;
}

function getVisibleTimetableDays(
  camp: CampWorkspace,
  slots: TimetableSlot[],
) {
  const slotsByDate = new Map(
    groupTimetableSlotsByDay(slots).map((day) => [day.date, day.slots]),
  );
  const dates = getDateRange(camp.startDate, camp.endDate);

  return dates.map((date) => ({
    date,
    slots: (slotsByDate.get(date) ?? []).sort((a, b) =>
      a.startTime.localeCompare(b.startTime),
    ),
  }));
}

function groupBookedSlotsByDay<T extends { date: string; time: string }>(
  slots: T[],
) {
  const groups = new Map<string, T[]>();

  for (const slot of slots) {
    const daySlots = groups.get(slot.date) ?? [];
    daySlots.push(slot);
    groups.set(slot.date, daySlots);
  }

  return [...groups.entries()]
    .sort(([dateA], [dateB]) => dateA.localeCompare(dateB))
    .map(([date, daySlots]) => ({
      date,
      slots: daySlots.sort((a, b) => a.time.localeCompare(b.time)),
    }));
}

function buildParticipantColorMap(participants: Participant[]) {
  const map = new Map<string, (typeof participantColors)[number]>();
  participants
    .filter((participant) => participant.status === "accepted" && participant.userId)
    .sort((a, b) => a.name.localeCompare(b.name))
    .forEach((participant, index) => {
      map.set(participant.userId, participantColors[index % participantColors.length]);
    });

  return map;
}

function buildWorkspaceIndexes(camp: CampWorkspace) {
  const participantsById = new Map<string, Participant>();
  const participantsByUserId = new Map<string, Participant>();

  for (const participant of camp.participants) {
    participantsById.set(participant.id, participant);
    if (!participantsByUserId.has(participant.userId)) {
      participantsByUserId.set(participant.userId, participant);
    }
  }

  const bookedMinutesByUserId = new Map<string, number>();
  const bookedMinutesByDateAndUserId = new Map<
    string,
    Map<string, number>
  >();

  for (const slot of camp.timetableSlots) {
    let bookedMinutesForDate = bookedMinutesByDateAndUserId.get(slot.slotDate);
    if (!bookedMinutesForDate) {
      bookedMinutesForDate = new Map<string, number>();
      bookedMinutesByDateAndUserId.set(slot.slotDate, bookedMinutesForDate);
    }

    for (const booking of slot.bookings) {
      bookedMinutesByUserId.set(
        booking.userId,
        (bookedMinutesByUserId.get(booking.userId) ?? 0) + booking.minutes,
      );
      bookedMinutesForDate.set(
        booking.userId,
        (bookedMinutesForDate.get(booking.userId) ?? 0) + booking.minutes,
      );
    }
  }

  const preferenceByParticipantAndDay = new Map<string, CampPreference>();
  for (const preference of camp.preferences) {
    const preferenceKey = `${preference.participantId}:${preference.dayId}`;
    if (!preferenceByParticipantAndDay.has(preferenceKey)) {
      preferenceByParticipantAndDay.set(preferenceKey, preference);
    }
  }

  const dayIdByDate = new Map(
    getDateRange(camp.startDate, camp.endDate).map((date, index) => [
      date,
      index + 1,
    ]),
  );
  const acceptedParticipants = camp.participants
    .filter(
      (participant) =>
        participant.status === "accepted" && participant.userId,
    )
    .sort((left, right) => left.name.localeCompare(right.name));
  const assignableParticipantsByDate = new Map<
    string,
    AssignSlotParticipant[]
  >();

  for (const slotDate of new Set(
    camp.timetableSlots.map((slot) => slot.slotDate),
  )) {
    const dayId = dayIdByDate.get(slotDate) ?? 0;
    const dayLabel =
      dayId > 0
        ? formatCampDayPreferenceLabel(camp.startDate, camp.endDate, dayId)
        : formatTimetableDate(slotDate);
    const bookedMinutesForDate = bookedMinutesByDateAndUserId.get(slotDate);

    assignableParticipantsByDate.set(
      slotDate,
      acceptedParticipants.map((participant) => {
        const preference =
          dayId > 0
            ? preferenceByParticipantAndDay.get(
                `${participant.userId}:${dayId}`,
              )
            : undefined;
        const preferredMinutes = preference?.preferredMinutes;
        const assignedMinutes =
          bookedMinutesForDate?.get(participant.userId) ?? 0;
        const progressPercent =
          typeof preferredMinutes === "number" && preferredMinutes > 0
            ? Math.round((assignedMinutes / preferredMinutes) * 100)
            : null;
        const remainingMinutes =
          typeof preferredMinutes === "number" &&
          preferredMinutes > assignedMinutes
            ? preferredMinutes - assignedMinutes
            : typeof preferredMinutes === "number"
              ? 0
              : null;
        const overAssignedMinutes =
          typeof preferredMinutes === "number" &&
          assignedMinutes > preferredMinutes
            ? assignedMinutes - preferredMinutes
            : null;
        const dayStatus: AssignSlotParticipant["dayStatus"] =
          typeof preferredMinutes !== "number"
            ? "no_preference"
            : preferredMinutes <= 0
              ? "no_flying"
              : assignedMinutes === preferredMinutes
                ? "complete"
                : assignedMinutes < preferredMinutes
                  ? "needs_time"
                  : "over_assigned";

        return {
          id: participant.userId,
          name: participant.name,
          isDummy: participant.isDummy,
          bookedMinutes: bookedMinutesByUserId.get(participant.userId) ?? 0,
          dayLabel,
          dayAssignedMinutes: assignedMinutes,
          dayPreferredMinutes:
            typeof preferredMinutes === "number" ? preferredMinutes : null,
          dayRemainingMinutes: remainingMinutes,
          dayOverAssignedMinutes: overAssignedMinutes,
          dayProgressPercent: progressPercent,
          dayStatus,
        };
      }),
    );
  }

  const assignableParticipantsBySlotId = new Map<
    string,
    AssignSlotParticipant[]
  >();
  for (const slot of camp.timetableSlots) {
    const bookedUserIds = new Set(
      slot.bookings.map((booking) => booking.userId),
    );
    assignableParticipantsBySlotId.set(
      slot.id,
      (assignableParticipantsByDate.get(slot.slotDate) ??
        emptyAssignableParticipants).filter(
        (participant) => !bookedUserIds.has(participant.id),
      ),
    );
  }

  return {
    participantsById,
    participantsByUserId,
    participantColorMap: buildParticipantColorMap(camp.participants),
    assignableParticipantsBySlotId,
  };
}

function getAttentionItems(camp: CampWorkspace) {
  const items: AttentionItem[] = [];
  const pendingParticipants = camp.participants.filter(
    (item) => item.status === "pending",
  );
  const accepted = camp.participants.filter((item) => item.status === "accepted");
  const waitlistParticipants = camp.participants.filter(
    (item) => item.status === "waitlist",
  );

  if (camp.type === "huck_jam") {
    const declinedParticipants = camp.participants.filter(
      (item) => item.status === "declined",
    );

    if (pendingParticipants.length > 0) {
      items.push({
        label: `${pendingParticipants.length} new applicants`,
        tone: "amber",
        target: "applicants",
        count: pendingParticipants.length,
        participantId: pendingParticipants[0]?.id,
      });
    }
    if (waitlistParticipants.length > 0) {
      items.push({
        label: `${waitlistParticipants.length} waitlist registrations`,
        tone: "slate",
        target: "participant",
        count: waitlistParticipants.length,
        participantId: waitlistParticipants[0]?.id,
      });
    }
    if (declinedParticipants.length > 0) {
      items.push({
        label: `${declinedParticipants.length} declined registrations`,
        tone: "slate",
        target: "participant",
        count: declinedParticipants.length,
        participantId: declinedParticipants[0]?.id,
      });
    }

    return items;
  }

  const participantsWithSlots = new Set(
    camp.timetableSlots.flatMap((slot) =>
      slot.bookings.map((booking) => booking.userId),
    ),
  );
  const participantsMissingSlots = accepted.filter(
    (item) => !item.selfBookingEnabled,
  ).filter(
    (item) => item.userId && !participantsWithSlots.has(item.userId),
  );
  const participantsMissingTunnelTime = accepted.filter(
    (item) => !item.tunnelTimeStatus,
  );
  const openSlots = camp.summary.openSlots;

  if (pendingParticipants.length > 0) {
    items.push({
      label: `${pendingParticipants.length} new applicants`,
      tone: "amber",
      target: "applicants",
      count: pendingParticipants.length,
      participantId: pendingParticipants[0]?.id,
    });
  }
  if (participantsMissingSlots.length > 0) {
    items.push({
      label: `${participantsMissingSlots.length} participants missing slots`,
      tone: "amber",
      target: "participant",
      count: participantsMissingSlots.length,
      participantId: participantsMissingSlots[0]?.id,
    });
  }
  if (participantsMissingTunnelTime.length > 0) {
    items.push({
      label: `${participantsMissingTunnelTime.length} participants missing tunnel time`,
      tone: "amber",
      target: "participant",
      count: participantsMissingTunnelTime.length,
      participantId: participantsMissingTunnelTime[0]?.id,
    });
  }
  if (camp.status === "published" && !camp.tunnelSharedAt) {
    items.push({
      label: "Tunnel not informed",
      tone: "amber",
      target: "share",
      count: 1,
    });
  }
  if (openSlots > 0) {
    items.push({
      label: `${openSlots} open slots`,
      tone: "slate",
      target: "timetable",
      count: openSlots,
    });
  }
  if (waitlistParticipants.length > 0) {
    items.push({
      label: `${waitlistParticipants.length} waitlist items`,
      tone: "slate",
      target: "participant",
      count: waitlistParticipants.length,
      participantId: waitlistParticipants[0]?.id,
    });
  }

  return items;
}

function getHuckjamOverview(camp: CampWorkspace) {
  const confirmedParticipants = camp.participants.filter(
    (participant) => participant.status === "accepted",
  );
  const waitlistCount = camp.participants.filter(
    (participant) => participant.status === "waitlist",
  ).length;
  const declinedCount = camp.participants.filter(
    (participant) => participant.status === "declined",
  ).length;
  const confirmedCount = confirmedParticipants.length;
  const availableSpots = Math.max(camp.totalCapacity - confirmedCount, 0);
  const revenue = confirmedCount * camp.price;
  const capacityPercent =
    camp.totalCapacity > 0
      ? Math.min(Math.round((confirmedCount / camp.totalCapacity) * 100), 100)
      : 0;

  return {
    confirmedCount,
    waitlistCount,
    declinedCount,
    availableSpots,
    revenue,
    capacityPercent,
    daysRemaining: getDaysRemainingUntil(camp.startDate),
    recentRegistrations: getRecentRegistrations(camp.participants),
  };
}

function getRecentRegistrations(participants: Participant[]): HuckjamRegistration[] {
  const activeRegistrations = participants.filter(
    (participant) =>
      participant.status !== "declined" && participant.status !== "withdrawn",
  );
  const source = activeRegistrations.length > 0 ? activeRegistrations : participants;

  return [...source]
    .sort((a, b) => {
      const left = new Date(b.createdAt).getTime();
      const right = new Date(a.createdAt).getTime();
      return left - right;
    })
    .slice(0, 3)
    .map((participant) => ({
      id: participant.id,
      name: participant.name,
      profileImageUrl: participant.profileImageUrl,
      createdAt: participant.createdAt,
      relativeTime: formatRelativeTime(participant.createdAt),
      status: participant.status,
    }));
}

function getDaysRemainingUntil(dateValue: string, now = new Date()) {
  const target = new Date(`${dateValue}T00:00:00`);
  const today = new Date(now);
  today.setHours(0, 0, 0, 0);
  target.setHours(0, 0, 0, 0);

  if (Number.isNaN(target.getTime())) {
    return 0;
  }

  return Math.max(
    Math.ceil((target.getTime() - today.getTime()) / (1000 * 60 * 60 * 24)),
    0,
  );
}

function formatRelativeTime(value: string, now = new Date()) {
  const timestamp = new Date(value).getTime();
  if (Number.isNaN(timestamp)) {
    return "Recently";
  }

  const deltaMs = timestamp - now.getTime();
  const absMinutes = Math.abs(deltaMs) / (1000 * 60);

  if (absMinutes < 60) {
    const rounded = Math.max(1, Math.round(absMinutes));
    return `${rounded} minute${rounded === 1 ? "" : "s"} ${
      deltaMs < 0 ? "ago" : "from now"
    }`;
  }

  const absHours = absMinutes / 60;
  if (absHours < 24) {
    const rounded = Math.max(1, Math.round(absHours));
    return `${rounded} hour${rounded === 1 ? "" : "s"} ${
      deltaMs < 0 ? "ago" : "from now"
    }`;
  }

  const absDays = absHours / 24;
  if (absDays < 7) {
    const rounded = Math.max(1, Math.round(absDays));
    return `${rounded} day${rounded === 1 ? "" : "s"} ${
      deltaMs < 0 ? "ago" : "from now"
    }`;
  }

  return new Intl.DateTimeFormat("en", {
    month: "short",
    day: "numeric",
  }).format(new Date(value));
}

function formatBookedTimeSummary(totalMinutes: number) {
  const minutes = Math.max(0, Math.round(totalMinutes));
  const hours = Math.floor(minutes / 60);
  const remainder = minutes % 60;

  const compact =
    hours === 0
      ? `${remainder}min`
      : remainder === 0
        ? `${hours}h`
        : `${hours}h ${remainder}min`;

  return `${compact} (${minutes}min)`;
}


